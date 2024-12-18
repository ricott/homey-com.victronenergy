'use strict';

const modbus = require('jsmodbus');
const net = require('net');
const deviceType = require('./deviceType.js');
const config = require('./const.js');
const HomeyEventEmitter = require('./homeyEventEmitter.js');
const utilFunctions = require('./util.js');

class VictronBase extends HomeyEventEmitter {
    modbusClient = null;
    socket = null;
    modbusSettings = null;
    shouldBeConnected = true;
    connected = false;
    pollIntervals = [];
    options = {};
    socketOptions = {};
    deviceRegistryType = null;
    reconnectOptions = {
        attempts: 0,
        lastAttempt: null,
        maxAttemptDelay: 180, // 3h
        interval: 30000
    };

    /**
     * Constructor for the VictronBase class
     * @param {object} deviceRegistryType - The device registry type to connect to
     * @param {object} options - The options for the class
     * @param {string} options.host - The host to connect to
     * @param {number} options.port - The port to connect to
     * @param {number} options.modbus_unitId - The unitId to connect to
     * @param {number} options.refreshInterval - The refresh interval in minutes
     * @param {object} options.device - The device object from Homey
     * @returns {void}
     */
    constructor(deviceRegistryType, options) {
        super();

        if (!deviceRegistryType) {
            this._logError('deviceRegistryType is mandatory input');
            return;
        }
        this.deviceRegistryType = deviceRegistryType;

        this.options = this.#validateOptions(options);
        if (!this.options) {
            return;
        }

        this._logMessage('DEBUG', 'Setting up ModBus, connecting with parameters');
        this._logMessage('DEBUG', this.options);

        this.#initListenersAndConnect();
    }

    disconnect() {
        this.shouldBeConnected = false;

        for (const timer of this.pollIntervals) {
            this._clearInterval(timer);
        }

        if (this.socket) {
            this.socket.end();
        }
    }

    #initListenersAndConnect() {
        let self = this;
        self.socketOptions = {
            host: self.options.host,
            port: self.options.port
        };
        self.socket = new net.Socket();
        self.modbusClient = new modbus.client.TCP(self.socket, self.options.modbus_unitId);

        self.socket.on('connect', function () {
            self._logMessage('INFO', `Connected Modbus client on IP '${self.options.host}' using unitId '${self.options.modbus_unitId}'`);
            self.connected = true;

            self.#readProperties();
            self.#refreshReadings();
            self.#initilializeTimers();
        });

        self.socket.on('error', function (err) {
            self.emit('error', err);
        });

        self.socket.on('close', function () {
            self._logMessage('INFO', `Closed Modbus client on IP '${self.options.host}' using unitId '${self.options.modbus_unitId}'`);
            self.connected = false;

            if (self.shouldBeConnected === true) {
                self._logError('Modbus client closed unexpected!');
            }
        });

        self.socket.connect(self.socketOptions);
    }

    #initilializeTimers() {
        var self = this;
        // If refresh interval is set, and we don't have timers
        // initialized already - then create them
        if (self.options.refreshInterval && self.pollIntervals.length === 0) {
            self._logMessage('INFO', 'Timers initialized');
            self.pollIntervals.push(self._setInterval(() => {
                self.#refreshReadings();
            }, 1000 * self.options.refreshInterval));

            self.pollIntervals.push(self._setInterval(() => {
                self.#monitorSocket();
            }, self.reconnectOptions.interval));
        }
    }

    // Called on a timer to make sure we reconnect if we get disconnected
    #monitorSocket() {
        var self = this;

        if (self.shouldBeConnected === true) {
            if (!self.connected) {
                // Connection dropped
                if (((Date.now() - self.reconnectOptions.lastAttempt) > self.reconnectOptions.maxAttemptDelay * 1000)
                    || ((Date.now() - self.reconnectOptions.lastAttempt) > self.reconnectOptions.attempts * self.reconnectOptions.interval)) {
                    // We are beyond maxAttemptDelay or
                    let now = Date.now();
                    self._logMessage('INFO', `Socket closed, reconnecting for '${self.reconnectOptions.attempts}' time. Last attempt '${(now - (self.reconnectOptions.lastAttempt || now))}' s`);
                    self.reconnectOptions.attempts++;
                    self.reconnectOptions.lastAttempt = now;
                    try {
                        self.#initListenersAndConnect();
                    } catch (error) {
                        self._logError(error);
                    }   
                }
            }
        }
    }

    #refreshReadings() {
        let self = this;

        if (!self.connected) {
            self._logError('Cant read readings since socket is not connected!');
            return;
        }

        self.#readModbus(self, deviceType.getReadingRegistries(self.deviceRegistryType))
            .then((result) => {
                let readings = deviceType.getReadingValues(self.deviceRegistryType, result);
                self.emit('readings', readings);
            });
    }

    #readProperties() {
        let self = this;
        self.#readModbus(self, deviceType.getInfoRegistries(self.deviceRegistryType))
            .then((result) => {
                let properties = deviceType.getInfoValues(self.deviceRegistryType, result);
                self.emit('properties', properties);
            });
    }

    #validateOptions(options) {
        let self = this;
        if (!options) {
            self._logError('Missing input options!');
            return null;
        }

        if (options.modbus_unitId) {
            // Make sure unitId exists and is a number
            options.modbus_unitId = Number(options.modbus_unitId);
        } else {
            self._logError('modbus_unitId is mandatory input');
            return null;
        }

        if (options.host && !utilFunctions.validateIPaddress(options.host)) {
            self._logError(`Invalid IP address '${options.host}'`);
            return null;
        }

        utilFunctions.isPortAvailable(options.host, options.port)
            .then(function (available) {
                if (!available) {
                    let errMsg = `Port '${options.port}' on IP Address '${options.host}' is NOT reachable`;
                    self._logError(errMsg);
                    self.emit('error', new Error(errMsg));
                    return null;
                }
            });

        return options;
    }

    // Iterates all modbus registries and returns their value
    async #readModbus(self, modbusRegistries) {
        const requests = modbusRegistries.map((registry) => {
            return this.#modbusReading(self, registry)
                .then((reading) => {
                    return reading;
                });
        });
        // Waiting for all the readings to get resolved
        return Promise.all(requests);
    }

    // Function to fetch values from modbus
    async #modbusReading(self, registry) {
        try {
            const result = await self.modbusClient.readHoldingRegisters(registry.registryId, registry.count);
            return result.response._body._valuesAsBuffer;

        } catch (err) {
            self._logError(err);
            //self.emit('error', new Error(`Failed to read '${registry.comment}' (${registry.registryId}) using unitId '${self.clientCodeToUnitIdMap[registry.unitCode]}' (${registry.unitCode})`));
            return null;
        }
    }

    getModbusClient() {
        return this.modbusClient;
    }
}
module.exports = VictronBase;
