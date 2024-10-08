'use strict';

const modbus = require('jsmodbus');
const net = require('net');
const deviceType = require('./deviceType.js');
const config = require('./const.js');
const HomeyEventEmitter = require('./homeyEventEmitter.js');
const utilFunctions = require('./util.js');

class VictronEvCharger extends HomeyEventEmitter {
    constructor(options) {
        super();
        var self = this;
        if (options == null) { options = {} };
        self.options = options;

        self.pollIntervals = [];
        self.connected = false;
        self.shouldBeConnected = false;
        // Used for setting modbus settings
        self.modbusSettings = null;
        self.modbusClients = {};
        self.clientCodeToUnitIdMap = {};

        if (self.options.host && !utilFunctions.validateIPaddress(self.options.host)) {
            self._logMessage('INFO', `Invalid IP address '${self.options.host}'`);
            return;
        }

        utilFunctions.isPortAvailable(self.options.host, self.options.port)
            .then(function (available) {
                if (!available) {
                    let errMsg = `Port '${self.options.port}' on IP Address '${self.options.host}' is NOT reachable`;
                    self._logMessage('INFO', errMsg);
                    self.emit('error', new Error(errMsg));
                    return;
                }
            });

        // Make sure vebusUnitId exists and is a number
        if (self.options.modbus_unitId) {
            self.options.modbus_unitId = Number(self.options.modbus_unitId);
        } else {
            self._logMessage('INFO', `modbus_unitId is mandatory input`);
            return;
        }

        self.options.deviceType = 'EvCharger';

        self._logMessage('DEBUG', 'Setting up ModBus connecting with parameters');
        self._logMessage('DEBUG', self.options);

        self.#initListenersAndConnect();
    }

    #setupReconnectOptions() {
        this.reconnectOptions = {
            attempts: 0,
            lastAttempt: null,
            maxAttemptDelay: 180, // 3h
            interval: 30000
        }
    }

    getModbusClient(code) {
        return this.modbusClients[this.clientCodeToUnitIdMap[code]];
    }

    #setupModbusClientWithUnitId(code, unitId) {
        this.clientCodeToUnitIdMap[code] = unitId;

        if (!this.modbusClients[unitId]) {
            console.log(`Creating client for Unit ID '${unitId}' (Code: '${code}').`);
            this.modbusClients[unitId] = new modbus.client.TCP(this.socket, unitId);
        } else {
            console.log(`Client for Unit ID '${unitId}' already exists (Code: '${code}').`);
        }
    }

    #initListenersAndConnect() {
        var self = this;
        self.socket = new net.Socket();
        // Get unitId from settings
        self.#setupModbusClientWithUnitId(config.gxEvChargerUnitCode, self.options.modbus_unitId);

        self.socket.on('connect', function () {
            self._logMessage('INFO', `Modbus client connected on IP '${self.options.host}'`);
            self.connected = true;
            self.shouldBeConnected = true;
            // Connect successful, reset options
            self.#setupReconnectOptions();

            self.#readProperties();
            self.#refreshReadings();
            self.#initilializeTimers();
        });

        self.socket.on('error', function (err) {
            self.emit('error', err);
        });

        self.socket.on('close', function () {
            if (self.isConnected()) {
                self._logMessage('INFO', `GX client closed for IP '${self.options.host}'`);
                self.connected = false;

                if (self.shouldBeConnected === true) {
                    self._logMessage('INFO', 'GX client closed unexpected!');
                }
            }
        });

        self.socket.connect(self.options);
    }

    #initilializeTimers() {
        var self = this;
        // If refresh interval is set, and we don't have timers
        // initialized already - then create them
        if (self.options.refreshInterval && self.pollIntervals.length === 0) {
            self._logMessage('INFO', 'GX timers initialized');
            self.pollIntervals.push(self._setInterval(() => {
                self.#refreshReadings();
            }, 60 * 1000 * self.options.refreshInterval));

            self.pollIntervals.push(self._setInterval(() => {
                self.#monitorSocket();
            }, self.reconnectOptions.interval));

        }
    }

    disconnect() {
        this.shouldBeConnected = false;

        for (const timer of this.pollIntervals) {
            this._clearInterval(timer);
        }

        if (this.socket) {
            this.socket.destroy();
        }
    }

    isConnected() {
        return this.connected;
    }

    // Called on a timer to make sure we reconnect if we get disconnected
    #monitorSocket() {
        var self = this;

        if (self.shouldBeConnected === true) {
            if (!self.isConnected()) {
                // Connection dropped
                if (((Date.now() - self.reconnectOptions.lastAttempt) > self.reconnectOptions.maxAttemptDelay * 1000)
                    || ((Date.now() - self.reconnectOptions.lastAttempt) > self.reconnectOptions.attempts * self.reconnectOptions.interval)) {
                    // We are beyond maxAttemptDelay or
                    let now = Date.now();
                    self._logMessage('INFO', `Socket closed, reconnecting for '${self.reconnectOptions.attempts}' time. Last attempt '${(now - (self.reconnectOptions.lastAttempt || now))}' s`);
                    self.reconnectOptions.attempts++;
                    self.reconnectOptions.lastAttempt = now;
                    self.#initListenersAndConnect();
                }
            }
        }
    }

    #readProperties() {
        var self = this;
        self._logMessage('INFO', `Setting device type to '${self.options.deviceType}'`);

        self.modbusSettings = deviceType.getModbusRegistrySettings(self.options.deviceType);

        readModbus(self, deviceType.getInfoRegistries(self.modbusSettings))
            .then((result) => {
                let properties = deviceType.getInfoValues(self.modbusSettings, result);
                self.emit('properties', properties);
            });
    }

    #refreshReadings() {
        var self = this;

        if (!self.isConnected()) {
            self._logMessage('INFO', 'Cant read readings since socket is not connected!');
            return;
        }

        if (!self.modbusSettings) {
            self._logMessage('INFO', 'Modbus settings object is null!');
            return;
        }

        readModbus(self, deviceType.getReadingRegistries(self.modbusSettings))
            .then((result) => {
                let readings = deviceType.getReadingValues(self.modbusSettings, result);
                self.emit('readings', readings);
            });
    }

    setChargerMode(mode) {
        // 0=Manual;1=Auto
        return this.getModbusClient(config.gxEvChargerUnitCode).writeMultipleRegisters(3815, utilFunctions.createBuffer(mode, 1))
            .then((result) => {
                return Promise.resolve(true);
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    setChargerCurrent(current) {
        return this.getModbusClient(config.gxEvChargerUnitCode).writeMultipleRegisters(3825, utilFunctions.createBuffer(current, 1))
            .then((result) => {
                return Promise.resolve(true);
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    startCharging() {
        return this.getModbusClient(config.gxEvChargerUnitCode).writeMultipleRegisters(3826, utilFunctions.createBuffer(1, 1))
            .then((result) => {
                return Promise.resolve(true);
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    stopCharging() {
        return this.getModbusClient(config.gxEvChargerUnitCode).writeMultipleRegisters(3826, utilFunctions.createBuffer(0, 1))
            .then((result) => {
                return Promise.resolve(true);
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }
}
module.exports = VictronEvCharger;

// Function to fetch values from modbus
const modbusReading = async (self, registry) => {
    let client;
    try {
        //Read using the correct client
        let retVal = null;
        //Check if we have the client, if not ignore reading the value
        client = self.getModbusClient(registry.unitCode);
        if (client) {
            const result = await client.readHoldingRegisters(registry.registryId, registry.count);
            retVal = result.response._body._valuesAsBuffer;
        }
        return retVal;
    } catch (err) {
        console.log(err);
        self.emit('error', new Error(`Failed to read '${registry.comment}' (${registry.registryId}) using unitId '${self.clientCodeToUnitIdMap[registry.unitCode]}' (${registry.unitCode})`));
        return null;
    }
}

// Iterates all modbus registries and returns their value
const readModbus = async (self, modbusRegistries) => {
    const requests = modbusRegistries.map((registry) => {
        return modbusReading(self, registry)
            .then((reading) => {
                return reading;
            });
    });
    return Promise.all(requests); // Waiting for all the readings to get resolved.
}