'use strict';

const modbus = require('jsmodbus');
const net = require('net');
const { NodeSSH } = require('node-ssh');
const deviceType = require('./deviceType.js');
const config = require('./const.js');
const HomeyEventEmitter = require('./homeyEventEmitter.js');
const utilFunctions = require('./util.js');

class VictronGX extends HomeyEventEmitter {
    constructor(options) {
        super();
        var self = this;
        if (options == null) { options = {} };
        self.options = options;

        self.pollIntervals = [];
        self.connected = false;
        self.shouldBeConnected = false;
        // Used for setting modbus settings
        self.deviceType = null;
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
        if (self.options.vebusUnitId) {
            self.options.vebusUnitId = Number(self.options.vebusUnitId);
        } else {
            self._logMessage('INFO', `vebusUnitId is mandatory input`);
            return;
        }

        if (self.options.batteryUnitId) {
            self.options.batteryUnitId = Number(self.options.batteryUnitId);
        }

        self.options.systemUnitId = config.gxSystemUnitId;

        self._logMessage('DEBUG', 'Setting up ModBus connecting with parameters');
        self._logMessage('DEBUG', self.options);

        self.#initListenersAndConnect();
    }

    #setupReconnectOptions() {
        this.reconnectOptions = {
            attempts: 0,
            lastAttempt: null,
            maxAttemptDelay: 60, //1h
            interval: 2000
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
        // Default client is 100, all GX devices have it
        self.#setupModbusClientWithUnitId(config.gxSystemUnitCode, config.gxSystemUnitId);
        // Get vebus unitId from settings
        self.#setupModbusClientWithUnitId(config.gxVEBusUnitCode, self.options.vebusUnitId);
        // Might not have a battery unitId
        if (self.options.batteryUnitId && !isNaN(self.options.batteryUnitId) && self.options.batteryUnitId > 0) {
            self.#setupModbusClientWithUnitId(config.gxBatteryUnitCode, self.options.batteryUnitId);
        }
        // Might not have a grid unitId
        if (self.options.gridUnitId && !isNaN(self.options.gridUnitId) && self.options.gridUnitId > 0) {
            self.#setupModbusClientWithUnitId(config.gxGridUnitCode, self.options.gridUnitId);
        }

        self.socket.on('connect', function () {
            self._logMessage('INFO', `Modbus client connected on IP '${self.options.host}'`);
            self.connected = true;
            self.shouldBeConnected = true;
            // Connect successful, reset options
            self.#setupReconnectOptions();

            self.#readProperties();
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
            }, 1000 * self.options.refreshInterval));

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
        self.deviceType = 'GX';
        self._logMessage('INFO', `Setting device type to '${self.deviceType}'`);

        self.modbusSettings = deviceType.getModbusRegistrySettings(self.deviceType);

        self.#readModbus(deviceType.getInfoRegistries(self.modbusSettings))
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

        self.#readModbus(deviceType.getReadingRegistries(self.modbusSettings))
            .then((result) => {
                let readings = deviceType.getReadingValues(self.modbusSettings, result);
                self.emit('readings', readings);
            });
    }

    // Actions described here (section 2.1), https://www.victronenergy.com/live/ess:ess_mode_2_and_3
    writeGridSetpoint(power) {
        return this.getModbusClient(config.gxSystemUnitCode).writeMultipleRegisters(2700, createBuffer(power, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    // Scale factor 0.1
    limitInverterPower(power) {
        //We may get a 'W' for Watt (as unit), depending on where the invocation comes from
        if (isNaN(power) && power.indexOf('W') > -1) {
            power = power.replace('W', '');
        }

        return this.getModbusClient(config.gxSystemUnitCode).writeMultipleRegisters(2704, createBuffer(power, 0.1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    // Works only on DVCC
    limitChargerCurrent(current) {
        return this.getModbusClient(config.gxSystemUnitCode).writeMultipleRegisters(2705, createBuffer(current, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    // Scale factor 0.01
    limitGridFeedInPower(power) {
        return this.getModbusClient(config.gxSystemUnitCode).writeMultipleRegisters(2706, createBuffer(power, 0.01))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    // Scale factor 10
    writeESSMinimumSOC(percentage) {
        return this.getModbusClient(config.gxSystemUnitCode).writeMultipleRegisters(2901, createBuffer(percentage, 10))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    // Doesn't work on DVCC (set charger current to 0 instead)
    disableCharger() {
        return this.getModbusClient(config.gxSystemUnitCode).writeMultipleRegisters(2701, createBuffer(0, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    // Doesn't work on DVCC
    enableCharger() {
        return this.getModbusClient(config.gxSystemUnitCode).writeMultipleRegisters(2701, createBuffer(100, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    disableInverter() {
        return this.getModbusClient(config.gxSystemUnitCode).writeMultipleRegisters(2702, createBuffer(0, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    enableInverter() {
        return this.getModbusClient(config.gxSystemUnitCode).writeMultipleRegisters(2702, createBuffer(100, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    // 1=Charger Only;2=Inverter Only;3=On;4=Off
    setSwitchPosition(mode) {
        return this.getModbusClient(config.gxVEBusUnitCode).writeMultipleRegisters(33, createBuffer(mode, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    turnOffGXRelay1() {
        return this.getModbusClient(config.gxSystemUnitCode).writeMultipleRegisters(806, createBuffer(0, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    turnOnGXRelay1() {
        return this.getModbusClient(config.gxSystemUnitCode).writeMultipleRegisters(806, createBuffer(1, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    turnOffGXRelay2() {
        return this.getModbusClient(config.gxSystemUnitCode).writeMultipleRegisters(807, createBuffer(0, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    turnOnGXRelay2() {
        return this.getModbusClient(config.gxSystemUnitCode).writeMultipleRegisters(807, createBuffer(1, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    // 1=Optimized (With Batterylife);9=Keep batteries charged;10=Optimized (Without Batterylife)
    setBatteryLifeState(state) {
        return this.getModbusClient(config.gxSystemUnitCode).writeMultipleRegisters(2900, createBuffer(state, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    // 1=ESS with Phase Compensation;2=ESS without phase compensation;3=Disabled/External Control
    setMultiphaseRegulation(state) {
        return this.getModbusClient(config.gxSystemUnitCode).writeMultipleRegisters(2902, createBuffer(state, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    isChargingScheduleEnabled(user, privateKey, schedule) {
        const command = `dbus -y com.victronenergy.settings /Settings/CGwacs/BatteryLife/Schedule/Charge/${schedule}/Day GetValue`;
        return this.#executeSSHCommand(user, privateKey, this.options.host, command).then(response => {
            return response != '-7';
        }).catch(reason => {
            return Promise.reject(reason);
        });
    }

    enableChargingSchedule(user, privateKey, schedule) {
        const command = `dbus -y com.victronenergy.settings /Settings/CGwacs/BatteryLife/Schedule/Charge/${schedule}/Day SetValue 7`;
        return this.#executeSSHCommand(user, privateKey, this.options.host, command).then(response => {
            return true;
        }).catch(reason => {
            return Promise.reject(reason);
        });
    }

    disableChargingSchedule(user, privateKey, schedule) {
        //Need the % sign to pass negative value via dbus
        const command = `dbus -y com.victronenergy.settings /Settings/CGwacs/BatteryLife/Schedule/Charge/${schedule}/Day SetValue %-7`;
        return this.#executeSSHCommand(user, privateKey, this.options.host, command).then(response => {
            return true;
        }).catch(reason => {
            return Promise.reject(reason);
        });
    }

    async createChargingSchedule(user, privateKey, schedule, day, start, duration, soc) {

        if (privateKey.trim().length <= 0) {
            throw new Error(`Please configure a SSH key before using this action`);
        }

        //start = 22:00, convert to seconds since midnight
        const startSeconds = Number(start.substring(0, 2)) * 3600 + Number(start.substring(3, 5)) * 60
        //duration = 01:00, convert to seconds
        const durationSeconds = Number(duration.substring(0, 2)) * 3600 + Number(duration.substring(3, 5)) * 60

        const ssh = new NodeSSH();
        return ssh.connect({
            host: this.options.host,
            username: user,
            privateKey: privateKey
        }).then(async function () {

            let response = await ssh.execCommand(`dbus -y com.victronenergy.settings /Settings/CGwacs/BatteryLife/Schedule/Charge/${schedule}/Start SetValue ${startSeconds}`);
            if (response.stdout != '0') {
                throw new Error(`Failed to set start time for schedule ${schedule}, got response '${response.stdout}'`);
            }
            response = await ssh.execCommand(`dbus -y com.victronenergy.settings /Settings/CGwacs/BatteryLife/Schedule/Charge/${schedule}/Duration SetValue ${durationSeconds}`);
            if (response.stdout != '0') {
                throw new Error(`Failed to set duration for schedule ${schedule}, got response '${response.stdout}'`);
            }
            response = await ssh.execCommand(`dbus -y com.victronenergy.settings /Settings/CGwacs/BatteryLife/Schedule/Charge/${schedule}/Soc SetValue ${soc}`);
            if (response.stdout != '0') {
                throw new Error(`Failed to set SoC for schedule ${schedule}, got response '${response.stdout}'`);
            }
            if (day == '-7') {
                day = '%-7';
            }
            response = await ssh.execCommand(`dbus -y com.victronenergy.settings /Settings/CGwacs/BatteryLife/Schedule/Charge/${schedule}/Day SetValue ${day}`);
            if (response.stdout != '0') {
                throw new Error(`Failed to enable schedule ${schedule}, got response '${response.stdout}'`);
            }

            return true;

        }).catch(reason => {
            return Promise.reject(reason);
        });
    }

    #executeSSHCommand(user, privateKey, host, command) {
        var self = this;

        if (privateKey.trim().length <= 0) {
            throw new Error(`Please configure a SSH key before using this action`);
        }

        const ssh = new NodeSSH();
        return ssh.connect({
            host: host,
            username: user,
            privateKey: privateKey
        }).then(function () {
            return ssh.execCommand(command).then(function (result) {
                self._logMessage('INFO', 'STDOUT: ' + result.stdout)
                self._logMessage('INFO', 'STDERR: ' + result.stderr)
                return result.stdout;
            }).catch(reason => {
                return Promise.reject(reason);
            });
        }).catch(reason => {
            return Promise.reject(reason);
        });
    }

    // Iterates all modbus registries and returns their value
    #readModbus(modbusRegistries) {
        const requests = modbusRegistries.map((registry) => {
            return this.#modbusReading(registry)
                .then((reading) => {
                    return reading;
                });
        });
        // Waiting for all the readings to get resolved
        return Promise.all(requests);
    }

    // Function to fetch values from modbus
    #modbusReading(registry) {
        // Read using the correct client
        // Check if we have the client, if not ignore reading the value
        const client = this.getModbusClient(registry.unitCode);
        if (client) {
            return client.readHoldingRegisters(registry.registryId, registry.count)
                .then((result) => {
                    return result.response._body._valuesAsBuffer
                })
                .catch((reason) => {
                    // console.log(reason);
                    this.emit('error', new Error(`Failed to read '${registry.comment}' (${registry.registryId}) using unitId '${this.clientCodeToUnitIdMap[registry.unitCode]}' (${registry.unitCode})`));
                    return null;
                });
        } else {
            return null;
        }
    }
}
module.exports = VictronGX;

function createBuffer(numValue, factor) {
    let buffer = Buffer.alloc(2);
    buffer.writeInt16BE(numValue * factor);
    return buffer;
}
