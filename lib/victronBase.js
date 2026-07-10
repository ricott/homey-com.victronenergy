'use strict';

const deviceType = require('./deviceType.js');
const HomeyEventEmitter = require('./homeyEventEmitter.js');
const utilFunctions = require('./util.js');
const logger = require('./logger.js');
const net = require('net');
const Modbus = require('jsmodbus');

class VictronBase extends HomeyEventEmitter {
    options = {};
    deviceRegistryType = null;
    #connectionTimeout = 5000; // Default timeout in milliseconds (5 seconds), overridden by the 'timeout' setting
    #socket = null;
    #modbusClient = null;
    #systemModbusClient = null;
    #pollIntervalId = null;
    #healthCheckIntervalId = null;
    #infoRegistriesRead = false;
    #backoff = new Map(); // key => { attempts, nextRetryTime }
    // Sliding window of recent Modbus error timestamps, used to detect a
    // sustained failure state and report it (rate-limited) for blast-radius
    // telemetry. Never affects device operation.
    #readErrorTimestamps = [];

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
            // Detach socket listeners so a pending 'close'/'error' won't fire after disconnect
            this.#socket.removeAllListeners();
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

        const timeoutMs = this.#resolveTimeoutMs();

        this.#socket = new net.Socket();
        this.#modbusClient = new Modbus.client.TCP(
            this.#socket,
            this.options.modbus_unitId,
            timeoutMs
        );

        // If this client also has system registries, create the system client
        if (deviceType.getSystemRegistries(this.deviceRegistryType)?.length) {
            this.#systemModbusClient = new Modbus.client.TCP(
                this.#socket,
                100,
                timeoutMs
            );
        }

        return new Promise((resolve, reject) => {
            this.#socket.connect({
                host: this.options.host,
                port: this.options.port,
                timeout: timeoutMs
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
            this.#recordReadErrorForTelemetry(err, 'system');
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
            this.#recordReadErrorForTelemetry(err, 'device');
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
            this.#recordReadErrorForTelemetry(err, 'info');
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
                this.#recordReadErrorForTelemetry(err, 'reconnect');
                this.#backoff.set(this.deviceTypeName, { attempts, nextRetryTime });
            });
        }, 20_000); // Run every 20s
    }

    #isConnected(client) {
        return client && client._socket && client._socket.readable && client._socket.writable && !client._socket.destroyed && !client._socket.connecting;
    }

    // Modbus request/connection timeout in milliseconds. Derived from the
    // per-device 'timeout' setting (in seconds), falling back to 5s when unset
    // or invalid. Raising it helps GX devices that respond slowly (responses
    // arriving after the default 5s otherwise time out and desync the connection).
    #resolveTimeoutMs() {
        const seconds = Number(this.options.timeout);
        if (Number.isFinite(seconds) && seconds > 0) {
            return Math.round(seconds * 1000);
        }
        return this.#connectionTimeout;
    }

    // Telemetry: records a Modbus error and, when errors arrive in bursts (a
    // sustained failure rather than an occasional glitch), reports one event per
    // device per interval so we can see across installs which device types and
    // Homey firmware versions are affected. The logger rate-limits and is a
    // no-op when Sentry is not configured; this must never throw.
    #recordReadErrorForTelemetry(error, source) {
        try {
            const now = Date.now();
            const windowMs = 10 * 60 * 1000; // 10 minutes
            const threshold = 15; // errors within the window that indicate a sustained problem

            this.#readErrorTimestamps.push(now);
            this.#readErrorTimestamps = this.#readErrorTimestamps.filter(t => now - t <= windowMs);

            if (this.#readErrorTimestamps.length < threshold) {
                return;
            }

            const device = this.options.device;
            let deviceId = 'unknown';
            let driverId = this.deviceTypeName;
            let homeyVersion = 'unknown';
            try { deviceId = device?.getData?.().id || 'unknown'; } catch (_) { /* ignore */ }
            try { driverId = device?.driver?.id || this.deviceTypeName; } catch (_) { /* ignore */ }
            try { homeyVersion = device?.homey?.version || 'unknown'; } catch (_) { /* ignore */ }

            logger.report(
                `modbus-sustained-failure:${this.deviceTypeName}:${deviceId}`,
                'Sustained Modbus failures',
                {
                    level: 'warning',
                    tags: {
                        deviceType: this.deviceTypeName,
                        driver: driverId,
                        homeyVersion,
                        modbusUnitId: String(this.options.modbus_unitId),
                        // As tags (not just extra) so affected devices can be
                        // grouped/filtered by their refresh / timeout values.
                        refreshInterval: String(this.options.refreshInterval),
                        timeout: String(this.options.timeout ?? '')
                    },
                    extra: {
                        errorsInWindow: this.#readErrorTimestamps.length,
                        windowMinutes: 10,
                        source,
                        refreshInterval: this.options.refreshInterval,
                        timeoutSetting: this.options.timeout,
                        lastError: utilFunctions.formatError(error)
                    }
                }
            );
        } catch (_) {
            // Telemetry must never affect device operation.
        }
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
