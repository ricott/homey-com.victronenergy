'use strict';

const deviceType = require('./deviceType.js');
const HomeyEventEmitter = require('./homeyEventEmitter.js');
const utilFunctions = require('./util.js');
const net = require('net');
const Modbus = require('jsmodbus');

class VictronBase extends HomeyEventEmitter {
    options = {};
    deviceRegistryType = null;
    #connectionTimeout = 5000; // Connection timeout in milliseconds (5 seconds)
    #socket = null;
    #modbusClient = null;
    #systemModbusClient = null;
    #pollIntervalId = null;
    #healthCheckIntervalId = null;
    #infoRegistriesRead = false;
    #backoff = new Map(); // key => { attempts, nextRetryTime }

    constructor(deviceRegistryType, options) {
        super();

        if (!deviceRegistryType) {
            this._logError('deviceRegistryType is mandatory input');
            throw new Error('deviceRegistryType is mandatory input');
        }
        this.deviceRegistryType = deviceRegistryType;
        this.deviceTypeName = deviceRegistryType.name || deviceRegistryType.constructor.name;
        this.options = options;
    }

    async initialize() {
        this.options = await this.#validateOptions(this.options);
        this._logMessage('DEBUG', 'Setting up ModBus, connecting with parameters');

        try {
            await this.#initListenersAndConnect();
        } catch (error) {
            this._logError('Failed to initialize device', error);
        }

        // Start health check even if initialization fails, we'll try to reconnect
        this.#startHealthCheck();
    }

    disconnect() {
        this._logMessage('INFO', 'Disconnecting from device');
        if (this.#pollIntervalId) {
            this._clearInterval(this.#pollIntervalId);
        }
        if (this.#healthCheckIntervalId) {
            this._clearInterval(this.#healthCheckIntervalId);
        }
        if (this.#socket) {
            this.#socket.destroy();
        }
        this.#socket = null;
        this.#modbusClient = null;
        this.#systemModbusClient = null;
        this.#pollIntervalId = null;
        this.#healthCheckIntervalId = null;
        this.#infoRegistriesRead = false;
        this.#backoff.delete(this.deviceTypeName);
    }

    async #initListenersAndConnect() {

        this.#socket = new net.Socket();
        this.#modbusClient = new Modbus.client.TCP(
            this.#socket,
            this.options.modbus_unitId,
            this.#connectionTimeout
        );

        // If this client also has system registries, create the system client
        if (deviceType.getSystemRegistries(this.deviceRegistryType)?.length) {
            this.#systemModbusClient = new Modbus.client.TCP(
                this.#socket,
                100,
                this.#connectionTimeout
            );
        }

        return new Promise((resolve, reject) => {
            this.#socket.connect({
                host: this.options.host,
                port: this.options.port,
                timeout: this.#connectionTimeout
            }, () => {
                this._logMessage('INFO', `Socket connected`);
                this.#backoff.delete(this.deviceTypeName);

                this.#pollIntervalId = this._setInterval(() => {
                    this.#pollDevice();
                }, this.options.refreshInterval * 1000);

                resolve();
            });

            this.#socket.on('error', (err) => {
                // this._logError(`Socket error: ${err.message}`);
                reject(err);
            });

            this.#socket.on('close', () => {
                this._logMessage('INFO', `Socket closed`);
            });
        });
    }

    async #pollDevice() {
        await this.#readInfoRegistries();

        await this.#readDeviceRegistries();
    }

    async #readSystemRegistries() {

        const systemRegistries = deviceType.getSystemRegistries(this.deviceRegistryType);

        if (!systemRegistries?.length) {
            this._logMessage('DEBUG', 'No system registries');
            return null;
        }

        if (!this.#isConnected(this.#systemModbusClient)) {
            this._logMessage('INFO', 'Skipping system registry read — system modbus client not connected');
            return null;
        }

        try {
            let systemReadings = [];
            for (const registry of systemRegistries) {
                const result = await this.#systemModbusClient.readHoldingRegisters(registry.registryId, registry.count);
                systemReadings.push(result.response._body._valuesAsBuffer);
            }

            const processedSystem = deviceType.getSystemValues(this.deviceRegistryType, systemReadings);
            return processedSystem;
        } catch (err) {
            this._logError(`System registry read failed:`, err);
            return null;
        }
    }

    async #readDeviceRegistries() {

        if (!this.#isConnected(this.#modbusClient)) {
            this._logMessage('INFO', 'Skipping device registry read — device modbus client not connected');
            return;
        }

        try {
            const readingRegistries = deviceType.getReadingRegistries(this.deviceRegistryType);

            let deviceReadings = [];
            for (const registry of readingRegistries) {
                const result = await this.#modbusClient.readHoldingRegisters(registry.registryId, registry.count);
                deviceReadings.push(result.response._body._valuesAsBuffer);
            }

            let processedReadings = deviceType.getReadingValues(this.deviceRegistryType, deviceReadings);

            const systemReadings = await this.#readSystemRegistries();
            if (systemReadings) {
                Object.assign(processedReadings, systemReadings);
            }

            this._logMessage('DEBUG', 'Emitting readings:', processedReadings);
            this.emit('readings', processedReadings);
        } catch (err) {
            this._logError(`Device registry read failed:`, err);
        }
    }

    async #readInfoRegistries() {
        if (this.#infoRegistriesRead) {
            return;
        }

        if (!this.#isConnected(this.#modbusClient)) {
            this._logMessage('INFO', 'Skipping info registry read — device modbus client not connected');
            return;
        }

        try {
            const infoRegistries = deviceType.getInfoRegistries(this.deviceRegistryType);

            let readings = [];
            for (const registry of infoRegistries) {
                const result = await this.#modbusClient.readHoldingRegisters(registry.registryId, registry.count);
                readings.push(result.response._body._valuesAsBuffer);
            }

            const processedInfo = deviceType.getInfoValues(this.deviceRegistryType, readings);
            this._logMessage('DEBUG', 'Emitting properties:', processedInfo);
            this.emit('properties', processedInfo);
            this.#infoRegistriesRead = true;

        } catch (err) {
            this._logError(`Info registry read failed:`, err);
        }
    }

    getModbusClient(modbus_unitId) {
        if (modbus_unitId === 100) {
            return this.#systemModbusClient;
        }
        return this.#modbusClient;
    }

    #startHealthCheck() {
        this.#healthCheckIntervalId = this._setInterval(() => {

            // Check if socket is healthy
            if (this.#socket && !this.#socket.destroyed && this.#socket.readable && this.#socket.writable) {
                this._logMessage('DEBUG', 'Socket healthy');
                return;
            }

            this._logError(`Socket unhealthy, attempting reconnect`);

            const backoffState = this.#backoff.get(this.deviceTypeName) || { attempts: 0, nextRetryTime: 0 };
            const now = Date.now();

            if (now < backoffState.nextRetryTime) {
                this._logMessage('INFO', `Skipping reconnect, next attempt in ${(backoffState.nextRetryTime - now) / 1000}s`);
                return;
            }

            this.#initListenersAndConnect().then(() => {
                this._logMessage('INFO', `Reconnected successfully`);
            }).catch((err) => {
                const attempts = backoffState.attempts + 1;
                const baseDelay = 10_000; // 10 seconds
                const maxDelay = 600_000; // 10 minutes max

                const delay = Math.min(Math.pow(2, attempts) * baseDelay, maxDelay);
                const nextRetryTime = Date.now() + delay;

                this._logMessage('INFO', `Reconnect failed (attempt ${attempts}), retrying in ${delay / 1000}s`);
                this.#backoff.set(this.deviceTypeName, { attempts, nextRetryTime });
            });
        }, 20_000); // Run every 20s
    }

    #isConnected(client) {
        return client && client._socket && client._socket.readable && client._socket.writable && !client._socket.destroyed && !client._socket.connecting;
    }

    async #validateOptions(options) {
        if (!options) {
            throw new Error('Missing input options!');
        }

        if (options.modbus_unitId) {
            // Make sure unitId exists and is a number
            options.modbus_unitId = Number(options.modbus_unitId);
        } else {
            throw new Error('modbus_unitId is mandatory input');
        }

        if (options.host && !utilFunctions.validateIPaddress(options.host)) {
            throw new Error(`Invalid IP address '${options.host}'`);
        }

        const available = await utilFunctions.isPortAvailable(options.host, options.port);
        if (!available) {
            throw new Error(`Port '${options.port}' on IP Address '${options.host}' is NOT reachable`);
        }

        return options;
    }

    createBuffer(numValue, factor) {
        let buffer = Buffer.alloc(2);
        buffer.writeInt16BE(numValue * factor);
        return buffer;
    }
}

module.exports = VictronBase;
