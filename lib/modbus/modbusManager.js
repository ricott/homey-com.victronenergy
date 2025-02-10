'use strict';

const modbus = require('jsmodbus');
const net = require('net');
const EventEmitter = require('events');
const { formatSocketError, getModbusExceptionMessage } = require('./utils.js');

class ModbusManager extends EventEmitter {
    static activeSockets = new Map(); // Maps host:port to {socket, refCount}
    static activeClients = new Map(); // Maps host:port:unitId to {modbusClient, refCount, config}
    static retryAttempts = new Map(); // Maps host:port:unitId to {attempts, nextRetryTime}
    static connectionQueue = []; // Queue for pending connection requests
    static isProcessingQueue = false; // Flag to track if we're currently processing the queue
    static socketOperationInProgress = new Map(); // Maps host:port to Promise for ongoing socket operation
    #connectionMonitorTimer = null;
    #maxRetryAttempts = 500; // Maximum number of retry attempts
    #baseRetryDelay = 5000; // Base delay in milliseconds (5 seconds)
    #connectionTimeout = 10000; // Connection timeout in milliseconds (10 seconds)

    constructor() {
        super();
        this.#startConnectionMonitor();
    }

    #startConnectionMonitor() {
        // Clear existing timer if any
        if (this.#connectionMonitorTimer) {
            clearInterval(this.#connectionMonitorTimer);
        }

        // Check connections every 30 seconds
        this.#connectionMonitorTimer = setInterval(() => {
            this.#checkAndRestoreConnections();
        }, 30000); // 30 seconds instead of 60
    }

    async #checkAndRestoreConnections() {
        console.log('DEBUG', 'Checking all socket connections...');

        // Get all unique socket configurations
        const socketConfigs = new Set();
        ModbusManager.activeClients.forEach((_, clientKey) => {
            const [host, port] = clientKey.split(':');
            socketConfigs.add(`${host}:${port}`);
        });

        // Check each socket's TCP connection
        for (const socketKey of socketConfigs) {
            const [host, port] = socketKey.split(':');
            const socketInfo = ModbusManager.activeSockets.get(socketKey);

            if (socketInfo && (!socketInfo.socket.readable || !socketInfo.socket.writable || socketInfo.socket.destroyed)) {
                console.log('WARN', `Socket ${socketKey} is in bad state, destroying`);
                socketInfo.socket.destroy();
                ModbusManager.activeSockets.delete(socketKey);
            }
        }

        // Now check and restore client connections
        const clientConfigs = Array.from(ModbusManager.activeClients.entries());
        const currentTime = Date.now();

        for (const [clientKey, client] of clientConfigs) {
            const [host, port, unitId] = clientKey.split(':');
            const retryInfo = ModbusManager.retryAttempts.get(clientKey);

            if (!this.#isConnected(host, port)) {
                // Initialize retry info if not exists
                if (!retryInfo) {
                    ModbusManager.retryAttempts.set(clientKey, {
                        attempts: 0,
                        nextRetryTime: 0
                    });
                }

                const currentRetryInfo = ModbusManager.retryAttempts.get(clientKey);

                // Skip if we need to wait longer before next retry
                if (currentTime < currentRetryInfo.nextRetryTime) {
                    console.log('DEBUG', `Skipping retry for ${clientKey}, next retry in ${Math.ceil((currentRetryInfo.nextRetryTime - currentTime) / 1000)}s`);
                    continue;
                }

                // Increment attempts before trying
                currentRetryInfo.attempts++;
                console.log('WARN', `Connection lost for ${clientKey}, attempt ${currentRetryInfo.attempts}/${this.#maxRetryAttempts}`);

                try {
                    // Store existing configs before recreating connection
                    const deviceConfigs = Array.from(client.configs.entries());

                    // Recreate connection for each device type configuration
                    for (const [deviceTypeName, config] of deviceConfigs) {
                        await this.createConnection(host, parseInt(port), parseInt(unitId), {
                            deviceType: config.deviceType,
                            infoRegistries: config.infoRegistries,
                            readingRegistries: config.readingRegistries,
                            systemRegistries: config.systemRegistries,
                            refreshInterval: config.refreshInterval,
                            eventName: config.eventName,
                            device: config.device
                        });
                    }

                    console.log('INFO', `Successfully restored connection for ${clientKey}`);
                    // Reset retry attempts on successful connection
                    ModbusManager.retryAttempts.delete(clientKey);
                } catch (error) {
                    console.error(`Failed to restore connection for ${clientKey}:`, error);

                    if (currentRetryInfo.attempts >= this.#maxRetryAttempts) {
                        console.error(`Max retry attempts (${this.#maxRetryAttempts}) reached for ${clientKey}`);
                        ModbusManager.retryAttempts.delete(clientKey);
                    } else {
                        // Calculate next retry time with exponential backoff
                        const backoffDelay = Math.min(
                            this.#baseRetryDelay * Math.pow(2, currentRetryInfo.attempts - 1),
                            300000 // Cap at 5 minutes
                        );
                        currentRetryInfo.nextRetryTime = currentTime + backoffDelay;
                        console.log('INFO', `Next retry for ${clientKey} in ${backoffDelay / 1000}s`);
                    }
                }
            } else if (ModbusManager.retryAttempts.has(clientKey)) {
                // Connection is restored, clear retry attempts
                ModbusManager.retryAttempts.delete(clientKey);
            }
        }
    }

    async createConnection(host, port, unitId, config) {
        const baseClientKey = `${host}:${port}:${unitId}`;
        const existingClient = ModbusManager.activeClients.get(baseClientKey);
        const deviceTypeName = config.deviceType.name || config.deviceType.constructor.name;

        console.log('DEBUG', 'Queueing connection request:', {
            baseClientKey,
            deviceType: deviceTypeName,
            hasExistingClient: !!existingClient
        });

        // Add request to queue and process
        return new Promise((resolve, reject) => {
            ModbusManager.connectionQueue.push({
                params: { host, port, unitId, config, baseClientKey, existingClient, deviceTypeName },
                resolve,
                reject
            });
            this.#processConnectionQueue();
        });
    }

    async #processConnectionQueue() {
        // If already processing or queue is empty, return
        if (ModbusManager.isProcessingQueue || ModbusManager.connectionQueue.length === 0) {
            return;
        }

        ModbusManager.isProcessingQueue = true;

        try {
            // Get all requests for the same socket (host:port) to process together
            const request = ModbusManager.connectionQueue[0];
            const { host, port } = request.params;
            const socketKey = `${host}:${port}`;
            const socketRequests = ModbusManager.connectionQueue.filter(req => 
                `${req.params.host}:${req.params.port}` === socketKey
            );

            // Remove these requests from the queue
            ModbusManager.connectionQueue = ModbusManager.connectionQueue.filter(req => 
                `${req.params.host}:${req.params.port}` !== socketKey
            );

            try {
                // Process all requests for this socket together
                const socket = new net.Socket();
                socket.setKeepAlive(true, 1000);
                socket.setNoDelay(true);
                socket.setTimeout(this.#connectionTimeout);

                // Create all Modbus clients first
                const clients = new Map();
                let hasSystemClient = false;

                // First, check if we need a system client
                for (const req of socketRequests) {
                    const { config } = req.params;
                    if (config.systemRegistries && config.systemRegistries.length > 0) {
                        hasSystemClient = true;
                        break;
                    }
                }

                // Create system client first if needed
                if (hasSystemClient) {
                    const systemClient = new modbus.client.TCP(socket, 100);
                    clients.set(100, { modbusClient: systemClient, isSystem: true });
                }

                // Then create other clients
                for (const req of socketRequests) {
                    const { unitId, config } = req.params;
                    const modbusClient = new modbus.client.TCP(socket, unitId);
                    clients.set(unitId, { modbusClient, config });
                }

                // Now connect the socket
                await new Promise((resolve, reject) => {
                    let connectTimeout = setTimeout(() => {
                        socket.destroy();
                        reject(new Error(`Connection timeout to ${host}:${port}`));
                    }, this.#connectionTimeout);

                    socket.once('connect', () => {
                        clearTimeout(connectTimeout);
                        resolve();
                    });

                    socket.once('error', (error) => {
                        clearTimeout(connectTimeout);
                        reject(error);
                    });

                    socket.connect({ host, port });
                });

                // Store the socket
                ModbusManager.activeSockets.set(socketKey, { socket, refCount: socketRequests.length + (hasSystemClient ? 1 : 0) });

                // Store system client if needed
                if (hasSystemClient) {
                    const systemClientKey = `${host}:${port}:100`;
                    const { modbusClient } = clients.get(100);
                    ModbusManager.activeClients.set(systemClientKey, {
                        modbusClient,
                        refCount: 1,
                        configs: new Map()
                    });
                }

                // Process each request with its pre-created client
                for (const req of socketRequests) {
                    const { params, resolve } = req;
                    const { unitId, config, baseClientKey, deviceTypeName } = params;
                    const { modbusClient } = clients.get(unitId);

                    const newClient = {
                        modbusClient,
                        refCount: 1,
                        configs: new Map([[deviceTypeName, {
                            deviceType: config.deviceType,
                            infoRegistries: config.infoRegistries,
                            readingRegistries: config.readingRegistries,
                            systemRegistries: config.systemRegistries,
                            refreshInterval: config.refreshInterval,
                            eventName: config.eventName,
                            device: config.device,
                            timer: null
                        }]])
                    };

                    ModbusManager.activeClients.set(baseClientKey, newClient);

                    if (config.refreshInterval) {
                        this.#startPolling(baseClientKey, deviceTypeName);
                    }
                    resolve();
                }

            } catch (error) {
                // Reject all requests if there's an error
                for (const req of socketRequests) {
                    req.reject(error);
                }
            }
        } finally {
            ModbusManager.isProcessingQueue = false;
            
            // Process next batch if any
            if (ModbusManager.connectionQueue.length > 0) {
                setTimeout(() => this.#processConnectionQueue(), 1000);
            }
        }
    }

    async #readInfoRegistries(clientKey, deviceTypeName) {
        const client = ModbusManager.activeClients.get(clientKey);
        if (!client) return;

        const config = client.configs.get(deviceTypeName);
        if (!config || !config.infoRegistries || config.infoRegistries.length === 0) return;

        const { modbusClient } = client;
        const { infoRegistries, eventName } = config;
        const [host, port, unitId] = clientKey.split(':');

        if (!this.#isConnected(host, port)) {
            console.log('WARN', `Client ${clientKey} not connected, skipping info registry read`);
            return;
        }

        try {
            // First try to read the first registry to validate connection
            const firstRegistry = infoRegistries[0];
            console.log('DEBUG', `Validating Modbus connection for ${clientKey} by reading registry ${firstRegistry.registryId}`);
            
            // Try up to 3 times with increasing delays
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    // Add longer delay between retries
                    if (attempt > 0) {
                        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
                        console.log('DEBUG', `Retry ${attempt + 1} for ${clientKey} after ${attempt * 2}s delay`);
                    }
                    await modbusClient.readHoldingRegisters(firstRegistry.registryId, firstRegistry.count);
                    break; // Success, exit retry loop
                } catch (error) {
                    if (attempt === 2) throw error; // Last attempt, propagate error
                }
            }

            // Add delay before reading all registries
            await new Promise(resolve => setTimeout(resolve, 1000));

            // If validation succeeds, read all registries
            const readings = [];
            for (const registry of infoRegistries) {
                const result = await modbusClient.readHoldingRegisters(registry.registryId, registry.count);
                readings.push(result.response._body._valuesAsBuffer);
                // Add small delay between registry reads
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            this.emit(`${eventName}_info`, readings);
        } catch (error) {
            console.error('Error reading info registries:', error);
            if (error.message === 'no connection to modbus server') {
                // Destroy socket to force reconnection
                const socketKey = `${host}:${port}`;
                const socketInfo = ModbusManager.activeSockets.get(socketKey);
                if (socketInfo && socketInfo.socket) {
                    console.log('DEBUG', `Destroying socket for ${socketKey} due to Modbus protocol error`);
                    socketInfo.socket.destroy();
                }
            }
            throw error;
        }
    }

    async #startPolling(clientKey, deviceTypeName) {
        const client = ModbusManager.activeClients.get(clientKey);
        if (!client) return;

        const config = client.configs.get(deviceTypeName);
        if (!config) return;

        // Clear existing timer if any
        if (config.timer) {
            config.device.homey.clearInterval(config.timer);
        }

        // Only do initial read if refresh interval is greater than 10 seconds
        if (config.refreshInterval > 10) {
            await this.#pollReadings(clientKey, deviceTypeName);
        }

        // Set up polling interval
        config.timer = config.device.homey.setInterval(
            async () => {
                await this.#pollReadings(clientKey, deviceTypeName);
            },
            config.refreshInterval * 1000
        );
    }

    async #pollReadings(clientKey, deviceTypeName) {
        const client = ModbusManager.activeClients.get(clientKey);
        if (!client) {
            console.log('ERROR', `Client ${clientKey} not found for polling`);
            return;
        }

        const config = client.configs.get(deviceTypeName);
        if (!config) {
            console.log('ERROR', `Config for device type ${deviceTypeName} not found in client ${clientKey}`);
            return;
        }

        const { modbusClient } = client;
        const { deviceType, readingRegistries, eventName, systemRegistries } = config;
        const [host, port, unitId] = clientKey.split(':');

        if (!this.#isConnected(host, port)) {
            console.log('WARN', `Client ${clientKey} not connected, skipping poll`);
            return;
        }

        try {
            console.log('DEBUG', `Polling ${readingRegistries.length} registries for ${clientKey} device type ${deviceTypeName}`);
            const readings = [];
            for (const registry of readingRegistries) {
                try {
                    const result = await modbusClient.readHoldingRegisters(registry.registryId, registry.count);
                    readings.push(result.response._body._valuesAsBuffer);
                } catch (error) {
                    // Check for both connection errors and Modbus gateway errors
                    const isConnectionError = error.message === 'no connection to modbus server' || error.message === 'Req timed out';
                    const isGatewayError = error.response && error.response._body && error.response._body._code === 10;
                    
                    if (isConnectionError || isGatewayError) {
                        const socketKey = `${host}:${port}`;
                        const socketInfo = ModbusManager.activeSockets.get(socketKey);
                        if (socketInfo && socketInfo.socket) {
                            console.log('DEBUG', `Destroying socket for ${socketKey} due to error: ${isGatewayError ? 'Gateway Path Unavailable' : error.message}`);
                            
                            // First, clear all polling timers and store configs for recreation
                            const clientsToRestore = new Map();
                            for (const [key, value] of ModbusManager.activeClients.entries()) {
                                if (key.startsWith(socketKey)) {
                                    console.log('DEBUG', `Storing config for client ${key} for restoration`);
                                    // Store all device configs for this client
                                    const deviceConfigs = Array.from(value.configs.entries()).map(([devType, cfg]) => {
                                        // Clear the timer if it exists
                                        if (cfg.timer) {
                                            console.log('DEBUG', `Clearing timer for ${key} device type ${devType}`);
                                            cfg.device.homey.clearInterval(cfg.timer);
                                            cfg.timer = null;
                                        }
                                        return [devType, cfg];
                                    });
                                    clientsToRestore.set(key, deviceConfigs);
                                }
                            }

                            // Now destroy the socket and clear clients
                            socketInfo.socket.destroy();
                            ModbusManager.activeSockets.delete(socketKey);
                            
                            // Clear all clients using this socket
                            for (const [key, value] of ModbusManager.activeClients.entries()) {
                                if (key.startsWith(socketKey)) {
                                    console.log('DEBUG', `Removing client ${key} due to socket destruction`);
                                    ModbusManager.activeClients.delete(key);
                                }
                            }

                            // Add a delay before recreating clients to allow server to stabilize
                            setTimeout(() => {
                                // Queue recreation of all clients
                                for (const [clientKey, deviceConfigs] of clientsToRestore.entries()) {
                                    const [host, port, unitId] = clientKey.split(':');
                                    for (const [deviceTypeName, config] of deviceConfigs) {
                                        console.log('DEBUG', `Queueing recreation of client ${clientKey} device type ${deviceTypeName}`);
                                        this.createConnection(host, parseInt(port), parseInt(unitId), {
                                            deviceType: config.deviceType,
                                            infoRegistries: config.infoRegistries,
                                            readingRegistries: config.readingRegistries,
                                            systemRegistries: config.systemRegistries,
                                            refreshInterval: config.refreshInterval,
                                            eventName: config.eventName,
                                            device: config.device
                                        }).catch(err => {
                                            console.error(`Failed to recreate client ${clientKey}:`, err);
                                        });
                                    }
                                }
                            }, 2000); // 2 second delay before recreating clients
                        }
                    }
                    throw error;
                }
            }

            // Handle system registries if configured
            let systemReadings = [];
            if (systemRegistries && systemRegistries.length > 0) {
                const systemClientKey = `${host}:${port}:100`;
                const systemClient = ModbusManager.activeClients.get(systemClientKey);

                if (systemClient) {
                    for (const registry of systemRegistries) {
                        try {
                            const result = await systemClient.modbusClient.readHoldingRegisters(registry.registryId, registry.count);
                            systemReadings.push(result.response._body._valuesAsBuffer);
                        } catch (error) {
                            // Error handling for system client is handled by the main error handler above
                            throw error;
                        }
                    }
                } else {
                    console.log('WARN', `System client not found for ${systemClientKey}`);
                }
            }

            this.emit(eventName, { deviceReadings: readings, systemReadings });
        } catch (error) {
            console.error(`Error polling readings for ${clientKey}:`, error);
            if (error.response && error.response._body && error.response._body._code !== undefined) {
                const exceptionMessage = getModbusExceptionMessage(error.response._body._code);
                console.error(`Modbus Exception for ${clientKey} (Registry: ${error.request._body._start}): ${exceptionMessage}`);
            }
        }
    }

    async #createOrGetSocket(host, port, unitId) {
        const socketKey = `${host}:${port}`;
        console.log('DEBUG', `Creating/getting socket for ${socketKey} (unitId: ${unitId})`);

        // Wait for any ongoing socket operation to complete
        const ongoingOperation = ModbusManager.socketOperationInProgress.get(socketKey);
        if (ongoingOperation) {
            console.log('DEBUG', `Waiting for ongoing socket operation for ${socketKey}`);
            try {
                await ongoingOperation;
            } catch (error) {
                console.log('DEBUG', `Previous socket operation failed for ${socketKey}`);
            }
        }

        // Create new operation promise
        const operationPromise = (async () => {
            const existingSocket = ModbusManager.activeSockets.get(socketKey);
            
            // If we have an existing socket that's not destroyed, try to use it
            if (existingSocket && !existingSocket.socket.destroyed) {
                console.log('DEBUG', `Found existing socket for ${socketKey}`);
                existingSocket.refCount++;
                ModbusManager.activeSockets.set(socketKey, existingSocket);
                const modbusClient = new modbus.client.TCP(existingSocket.socket, unitId, {
                    timeout: 5000,
                    retryOnException: true,
                    maxConcurrentRequests: 1
                });
                return { socket: existingSocket.socket, modbusClient };
            }

            // Create new socket but don't connect yet
            console.log('INFO', `Creating new socket for '${socketKey}'`);
            const socket = new net.Socket();
            socket.setKeepAlive(true, 1000);
            socket.setNoDelay(true);
            socket.setTimeout(this.#connectionTimeout);

            // Create the Modbus client before connecting
            const modbusClient = new modbus.client.TCP(socket, unitId, {
                timeout: 5000,
                retryOnException: true,
                maxConcurrentRequests: 1
            });

            return new Promise((resolve, reject) => {
                let connectTimeout = setTimeout(() => {
                    socket.destroy();
                    reject(new Error(`Connection timeout to ${host}:${port}`));
                }, this.#connectionTimeout);

                socket.once('connect', () => {
                    clearTimeout(connectTimeout);
                    console.log('INFO', `Socket connected for '${socketKey}'`);
                    
                    // Store socket after successful connection
                    ModbusManager.activeSockets.set(socketKey, { socket, refCount: 1 });
                    
                    socket.on('error', (error) => {
                        console.error('ERROR', `Socket error for ${socketKey}:`, error.message);
                        socket.destroy();
                    });

                    socket.once('close', () => {
                        console.log('DEBUG', `Socket closed for ${socketKey}`);
                        ModbusManager.activeSockets.delete(socketKey);
                    });

                    resolve({ socket, modbusClient });
                });

                socket.once('error', (error) => {
                    clearTimeout(connectTimeout);
                    const errorMessage = formatSocketError(error, host, port);
                    console.error('ERROR', `Initial socket error for ${socketKey}:`, errorMessage);
                    reject(error);
                });

                socket.once('close', () => {
                    clearTimeout(connectTimeout);
                    console.log('DEBUG', `Socket closed for ${socketKey}`);
                    ModbusManager.activeSockets.delete(socketKey);
                });

                // Now connect the socket after all clients are created
                console.log('DEBUG', `Initiating socket connection to ${host}:${port}`);
                socket.connect({ host, port });
            });
        })();

        // Store and track the operation
        ModbusManager.socketOperationInProgress.set(socketKey, operationPromise);
        try {
            const result = await operationPromise;
            return result;
        } finally {
            ModbusManager.socketOperationInProgress.delete(socketKey);
        }
    }

    getConnection(host, port, unitId) {
        const clientKey = `${host}:${port}:${unitId}`;
        const client = ModbusManager.activeClients.get(clientKey);

        if (!client) {
            throw new Error(`No active connection found for ${clientKey}`);
        }

        if (!this.#isConnected(host, port)) {
            throw new Error(`Connection is not active for ${clientKey}`);
        }

        return client.modbusClient;
    }

    closeConnection(host, port, unitId, deviceType) {
        const clientKey = `${host}:${port}:${unitId}`;
        const socketKey = `${host}:${port}`;
        const deviceTypeName = deviceType.name || deviceType.constructor.name;

        // Clear any retry attempts when explicitly closing
        ModbusManager.retryAttempts.delete(clientKey);

        console.log('DEBUG', `Starting cleanup for ${deviceTypeName} on ${clientKey}`);

        const client = ModbusManager.activeClients.get(clientKey);
        const socketInfo = ModbusManager.activeSockets.get(socketKey);

        if (client) {
            client.refCount--;
            console.log('DEBUG', `Decreased client refCount to ${client.refCount}`);

            // Get the config for this device type
            const config = client.configs.get(deviceTypeName);
            if (config) {
                console.log('DEBUG', `Found config for ${deviceTypeName}, cleaning up resources`);

                // Remove event listeners
                console.log('DEBUG', `Removing event listeners for ${config.eventName}`);
                this.removeAllListeners(config.eventName);
                this.removeAllListeners(`${config.eventName}_info`);

                // Clear timer if exists
                if (config.timer) {
                    console.log('DEBUG', `Clearing polling timer for ${deviceTypeName}`);
                    config.device.homey.clearInterval(config.timer);
                }

                // Remove this device type's configuration
                client.configs.delete(deviceTypeName);
                console.log('DEBUG', `Removed config for ${deviceTypeName}`);
            } else {
                console.log('WARN', `No config found for ${deviceTypeName} in client ${clientKey}`);
            }

            if (client.refCount === 0) {
                console.log('DEBUG', `Last reference to client ${clientKey}, removing client`);
                ModbusManager.activeClients.delete(clientKey);

                if (socketInfo) {
                    socketInfo.refCount--;
                    console.log('DEBUG', `Decreased socket refCount to ${socketInfo.refCount}`);

                    if (socketInfo.refCount === 0) {
                        console.log('DEBUG', `Closing last connection for ${socketKey}`);
                        socketInfo.socket.end();
                        ModbusManager.activeSockets.delete(socketKey);
                    } else {
                        console.log('DEBUG', `Socket ${socketKey} still has ${socketInfo.refCount} active references`);
                    }
                }
            } else {
                console.log('DEBUG', `Client ${clientKey} still has ${client.refCount} active references`);
            }
        } else {
            console.log('WARN', `No client found for ${clientKey}`);
        }

        // If this was the last client, clear the connection monitor
        if (ModbusManager.activeClients.size === 0) {
            if (this.#connectionMonitorTimer) {
                clearInterval(this.#connectionMonitorTimer);
                this.#connectionMonitorTimer = null;
            }
        }
    }

    #isConnected(host, port) {
        const socketKey = `${host}:${port}`;
        const socketInfo = ModbusManager.activeSockets.get(socketKey);

        const isConnected = socketInfo && 
            socketInfo.socket && 
            socketInfo.socket.readable && 
            socketInfo.socket.writable && 
            !socketInfo.socket.destroyed && 
            !socketInfo.socket.connecting;

        console.log('DEBUG', `Connection check for ${socketKey}`, {
            hasSocketInfo: !!socketInfo,
            hasSocket: socketInfo ? !!socketInfo.socket : false,
            readable: socketInfo ? socketInfo.socket.readable : false,
            writable: socketInfo ? socketInfo.socket.writable : false,
            destroyed: socketInfo ? socketInfo.socket.destroyed : true,
            connecting: socketInfo ? socketInfo.socket.connecting : false,
            isConnected
        });

        return isConnected;
    }
}

//Singleton
module.exports = new ModbusManager();
