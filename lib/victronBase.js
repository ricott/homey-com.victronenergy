'use strict';

const deviceType = require('./deviceType.js');
const HomeyEventEmitter = require('./homeyEventEmitter.js');
const utilFunctions = require('./util.js');
const ModbusManager = require('./modbusManager.js');

class VictronBase extends HomeyEventEmitter {
    modbusSettings = null;
    options = {};
    socketOptions = {};
    deviceRegistryType = null;

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
        ModbusManager.closeConnection(
            this.options.host, 
            this.options.port, 
            this.options.modbus_unitId,
            this.deviceRegistryType
        );
    }

    #initListenersAndConnect() {
        const config = {
            deviceType: this.deviceRegistryType,
            infoRegistries: deviceType.getInfoRegistries(this.deviceRegistryType),
            readingRegistries: deviceType.getReadingRegistries(this.deviceRegistryType),
            refreshInterval: this.options.refreshInterval,
            eventName: `readings_${this.options.host}_${this.options.port}_${this.options.modbus_unitId}_${this.deviceRegistryType}`,
            device: this.options.device
        };

        // Set up event listeners before creating connection
        ModbusManager.on(config.eventName, (readings) => {
            const processedReadings = deviceType.getReadingValues(this.deviceRegistryType, readings);
            this.emit('readings', processedReadings);
        });

        ModbusManager.on(`${config.eventName}_info`, (readings) => {
            const processedInfo = deviceType.getInfoValues(this.deviceRegistryType, readings);
            this.emit('properties', processedInfo);
        });

        // Create the connection
        ModbusManager.createConnection(
            this.options.host, 
            this.options.port, 
            this.options.modbus_unitId,
            config
        );
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
}

module.exports = VictronBase;
