'use strict';

const deviceType = require('./deviceType.js');
const HomeyEventEmitter = require('./homeyEventEmitter.js');
const utilFunctions = require('./util.js');
const ModbusManager = require('./modbus/modbusManager.js');

class VictronBase extends HomeyEventEmitter {
    modbusSettings = null;
    options = {};
    socketOptions = {};
    deviceRegistryType = null;

    constructor(deviceRegistryType, options) {
        super();

        if (!deviceRegistryType) {
            this._logError('deviceRegistryType is mandatory input');
            throw new Error('deviceRegistryType is mandatory input');
        }
        this.deviceRegistryType = deviceRegistryType;
        this.options = options;
    }

    async initialize() {
        this.options = await this.#validateOptions(this.options);
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
            systemRegistries: deviceType.getSystemRegistries(this.deviceRegistryType),
            refreshInterval: this.options.refreshInterval,
            eventName: `readings_${this.options.host}_${this.options.port}_${this.options.modbus_unitId}_${this.deviceRegistryType}`,
            device: this.options.device
        };

        // Set up event listeners before creating connection
        ModbusManager.on(config.eventName, ({ deviceReadings, systemReadings }) => {
            let processedReadings = deviceType.getReadingValues(this.deviceRegistryType, deviceReadings);
            if (systemReadings && systemReadings.length > 0) {
                const processedSystemReadings = deviceType.getSystemValues(this.deviceRegistryType, systemReadings);
                if (processedSystemReadings) {
                    Object.assign(processedReadings, processedSystemReadings);
                }
            }
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

    getModbusClient(modbus_unitId = this.options.modbus_unitId) {
        return ModbusManager.getConnection(
            this.options.host,
            this.options.port,
            modbus_unitId
        );
    }

    async #validateOptions(options) {
        let self = this;
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
