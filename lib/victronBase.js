'use strict';

const deviceType = require('./deviceType.js');
const config = require('./const.js');
const HomeyEventEmitter = require('./homeyEventEmitter.js');
const utilFunctions = require('./util.js');
const ModbusManager = require('./modbusManager.js');

class VictronBase extends HomeyEventEmitter {
    // modbusClient = null;
    modbusSettings = null;
    pollIntervals = [];
    options = {};
    socketOptions = {};
    deviceRegistryType = null;

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
        for (const timer of this.pollIntervals) {
            this._clearInterval(timer);
        }

        ModbusManager.closeConnection(this.options.host, this.options.port, this.options.modbus_unitId);
    }

    #initListenersAndConnect() {

        ModbusManager.createConnection(this.options.host, this.options.port, this.options.modbus_unitId)
            .then((modbusClient) => {
                // this.modbusClient = modbusClient;
                this.#readProperties();
                this.#refreshReadings();
                this.#initilializeTimers();
            });
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
        }
    }

    #refreshReadings() {
        let self = this;
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
            //const result = await self.modbusClient.readHoldingRegisters(registry.registryId, registry.count);
            const isConnected = ModbusManager.isConnected(self.options.host, self.options.port, self.options.modbus_unitId);
            if (!isConnected) {
                self._logError('Modbus client is not connected');
                return null;
            }
            const client = ModbusManager.getClient(self.options.host, self.options.port, self.options.modbus_unitId);
            const result = await client.readHoldingRegisters(registry.registryId, registry.count);
            return result.response._body._valuesAsBuffer;

        } catch (err) {
            self._logError(err);
            //self.emit('error', new Error(`Failed to read '${registry.comment}' (${registry.registryId}) using unitId '${self.clientCodeToUnitIdMap[registry.unitCode]}' (${registry.unitCode})`));
            return null;
        }
    }

    // getModbusClient() {
    //     return this.modbusClient;
    // }
}
module.exports = VictronBase;
