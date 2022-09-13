'use strict';

const modbus = require('jsmodbus');
const net = require('net');
var EventEmitter = require('events');
const util = require('util');
const fs = require('fs');
const { NodeSSH } = require('node-ssh');
const deviceType = require('./deviceType.js');
const config = require('./const.js');

class VictronGX {
    constructor(options) {
        var self = this;
        EventEmitter.call(self);
        self.pollIntervals = [];
        self.connected = false;
        self.shouldBeConnected = false;
        //used for setting modbus settings
        self.deviceType = null;
        self.modbusSettings = null;
        self.modbusClients = {};

        if (options == null) { options = {} };

        if (options.host && !validateIPaddress(options.host)) {
            console.log(`Invalid IP address '${options.host}'`);
            return;
        }

        isPortAvailable(options.host, options.port)
            .then(function (available) {
                if (!available) {
                    let errMsg = `Port '${options.port}' on IP Address '${options.host}' is NOT reachable`;
                    console.log(errMsg);
                    self.emit('error', new Error(errMsg));
                    return;
                }
            });

        //Make sure vebusUnitId exists and is a number
        if (options.vebusUnitId) {
            options.vebusUnitId = Number(options.vebusUnitId);
        } else {
            console.log(`vebusUnitId is mandatory input`);
            return;
        }

        if (options.batteryUnitId) {
            options.batteryUnitId = Number(options.batteryUnitId);
        }

        options.systemUnitId = config.gxSystemUnitId;

        self.options = options;
        console.log('Setting up ModBus connecting with parameters');
        console.log(self.options);

        self.initListenersAndConnect();
    }

    setupReconnectOptions() {
        this.reconnectOptions = {
            attempts: 0,
            lastAttempt: null,
            maxAttemptDelay: 60, //1h
            interval: 2000
        }
    }

    initListenersAndConnect() {
        var self = this;
        self.socket = new net.Socket();
        //Default client is 100, all GX devices have it
        self.modbusClients[config.gxSystemUnitCode] = new modbus.client.TCP(self.socket, config.gxSystemUnitId);
        //Get vebus unitId from settings
        self.modbusClients[config.gxVEBusUnitCode] = new modbus.client.TCP(self.socket, self.options.vebusUnitId);
        //Might not have a battery unitId
        if (self.options.batteryUnitId && !isNaN(self.options.batteryUnitId) && self.options.batteryUnitId > 0) {
            self.modbusClients[config.gxBatteryUnitCode] = new modbus.client.TCP(self.socket, self.options.batteryUnitId);
        }

        self.socket.on('connect', function () {
            console.log(`Modbus client connected on IP '${self.options.host}'`);
            self.connected = true;
            self.shouldBeConnected = true;
            //Connect successful, reset options
            self.setupReconnectOptions();

            self.readProperties();
            self.initilializeTimers();
        });

        self.socket.on('error', function (err) {
            self.emit('error', err);
        });

        self.socket.on('close', function () {
            if (self.connected) {
                console.log(`Client closed for IP '${self.options.host}'`);
                self.connected = false;

                if (self.shouldBeConnected === true) {
                    console.log('Client closed unexpected!');
                }
            }
        });

        self.socket.connect(self.options);
    }

    initilializeTimers() {
        var self = this;
        //If refresh interval is set, and we don't have timers
        //initialized already - then create them
        if (self.options.refreshInterval && self.pollIntervals.length === 0) {
            console.log('Timers initialized');
            self.pollIntervals.push(setInterval(() => {
                self.refreshReadings();
            }, 1000 * self.options.refreshInterval));

            self.pollIntervals.push(setInterval(() => {
                self.monitorSocket();
            }, self.reconnectOptions.interval));

        }
    }

    disconnect() {
        this.shouldBeConnected = false;

        for (const timer of this.pollIntervals) {
            clearInterval(timer);
        }

        if (this.socket) {
            this.socket.destroy();
        }
    }

    isConnected() {
        if (this.connected) {
            return true;
        } else {
            return false;
        }
    }

    //Called on a timer to make sure we reconnect if we get disconnected
    monitorSocket() {
        var self = this;

        if (self.shouldBeConnected === true) {
            if (!self.connected) {
                //Connection dropped
                if (((Date.now() - self.reconnectOptions.lastAttempt) > self.reconnectOptions.maxAttemptDelay * 1000)
                    || ((Date.now() - self.reconnectOptions.lastAttempt) > self.reconnectOptions.attempts * self.reconnectOptions.interval)) {
                    //We are beyond maxAttemptDelay or
                    let now = Date.now();
                    console.log(`Socket closed, reconnecting for '${self.reconnectOptions.attempts}' time. Last attempt '${(now - (self.reconnectOptions.lastAttempt || now))}' s`);
                    self.reconnectOptions.attempts++;
                    self.reconnectOptions.lastAttempt = now;
                    self.initListenersAndConnect();
                }
            }
        }
    }

    readProperties() {
        var self = this;
        if (self.modbusClients[config.gxBatteryUnitCode]) {
            self.deviceType = 'GX';
        } else {
            self.deviceType = 'GX_no_battery';
        }
        console.log(`Setting device type to '${self.deviceType}'`);

        self.modbusSettings = deviceType.getModbusRegistrySettings(self.deviceType);

        readModbus(self, deviceType.getInfoRegistries(self.modbusSettings))
            .then((result) => {
                let properties = deviceType.getInfoValues(self.modbusSettings, result);
                self.emit('properties', properties);
            });
    }

    refreshReadings() {
        var self = this;

        if (!self.isConnected()) {
            console.log('Cant read readings since socket is not connected!');
            return;
        }

        if (!self.modbusSettings) {
            console.log('Modbus settings object is null!');
            return;
        }

        readModbus(self, deviceType.getReadingRegistries(self.modbusSettings))
            .then((result) => {
                let readings = deviceType.getReadingValues(self.modbusSettings, result);
                self.emit('readings', readings);
            });
    }

    //Actions described here (section 2.1), https://www.victronenergy.com/live/ess:ess_mode_2_and_3
    writeGridSetpoint(power) {
        return this.modbusClients[config.gxSystemUnitCode].writeMultipleRegisters(2700, createBuffer(power, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    //Scale factor 0.1
    limitInverterPower(power) {
        //We may get a 'W' for Watt (as unit), depending on where the invocation comes from
        if (isNaN(power) && power.indexOf('W') > -1) {
            power = power.replace('W', '');
        }

        return this.modbusClients[config.gxSystemUnitCode].writeMultipleRegisters(2704, createBuffer(power, 0.1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    //Works only on DVCC
    limitChargerCurrent(current) {
        return this.modbusClients[config.gxSystemUnitCode].writeMultipleRegisters(2705, createBuffer(current, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    //Scale factor 0.01
    limitGridFeedInPower(power) {
        return this.modbusClients[config.gxSystemUnitCode].writeMultipleRegisters(2706, createBuffer(power, 0.01))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    //Scale factor 10
    writeESSMinimumSOC(percentage) {
        return this.modbusClients[config.gxSystemUnitCode].writeMultipleRegisters(2901, createBuffer(percentage, 10))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    //Doesn't work on DVCC (set charger current to 0 instead)
    disableCharger() {
        return this.modbusClients[config.gxSystemUnitCode].writeMultipleRegisters(2701, createBuffer(0, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    //Doesn't work on DVCC
    enableCharger() {
        return this.modbusClients[config.gxSystemUnitCode].writeMultipleRegisters(2701, createBuffer(100, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    disableInverter() {
        return this.modbusClients[config.gxSystemUnitCode].writeMultipleRegisters(2702, createBuffer(0, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    enableInverter() {
        return this.modbusClients[config.gxSystemUnitCode].writeMultipleRegisters(2702, createBuffer(100, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    //1=Charger Only;2=Inverter Only;3=On;4=Off
    setSwitchPosition(mode) {
        return this.modbusClients[config.gxVEBusUnitCode].writeMultipleRegisters(33, createBuffer(mode, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    turnOffGXRelay1() {
        return this.modbusClients[config.gxSystemUnitCode].writeMultipleRegisters(806, createBuffer(0, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    turnOnGXRelay1() {
        return this.modbusClients[config.gxSystemUnitCode].writeMultipleRegisters(806, createBuffer(1, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    turnOffGXRelay2() {
        return this.modbusClients[config.gxSystemUnitCode].writeMultipleRegisters(807, createBuffer(0, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    turnOnGXRelay2() {
        return this.modbusClients[config.gxSystemUnitCode].writeMultipleRegisters(807, createBuffer(1, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    //1=Optimized (With Batterylife);9=Keep batteries charged;10=Optimized (Without Batterylife)
    setBatteryLifeState(state) {
        return this.modbusClients[config.gxSystemUnitCode].writeMultipleRegisters(2900, createBuffer(state, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    isChargingScheduleEnabled(user, password, schedule) {
        const command = `dbus -y com.victronenergy.settings /Settings/CGwacs/BatteryLife/Schedule/Charge/${schedule}/Day GetValue`;
        return executeSSHCommand(user, password, this.options.host, command).then(response => {
            return response != '-7';
        }).catch(reason => {
            return Promise.reject(reason);
        });
    }

    enableChargingSchedule(user, password, schedule) {
        const command = `dbus -y com.victronenergy.settings /Settings/CGwacs/BatteryLife/Schedule/Charge/${schedule}/Day SetValue 7`;
        return executeSSHCommand(user, password, this.options.host, command).then(response => {
            return true;
        }).catch(reason => {
            return Promise.reject(reason);
        });
    }

    disableChargingSchedule(user, password, schedule) {
        //Need the % sign to pass negative value via dbus
        const command = `dbus -y com.victronenergy.settings /Settings/CGwacs/BatteryLife/Schedule/Charge/${schedule}/Day SetValue %-7`;
        return executeSSHCommand(user, password, this.options.host, command).then(response => {
            return true;
        }).catch(reason => {
            return Promise.reject(reason);
        });
    }

    async createChargingSchedule(user, password, schedule, day, start, duration, soc) {

        if (password.trim().length <= 0) {
            throw new Error(`Please configure a SSH password before using this action`);
        }

        //start = 22:00, convert to seconds since midnight
        const startSeconds = Number(start.substring(0, 2))*3600 + Number(start.substring(3, 5))*60
        //duration = 01:00, convert to seconds
        const durationSeconds = Number(duration.substring(0, 2))*3600 + Number(duration.substring(3, 5))*60

        const ssh = new NodeSSH();
        return ssh.connect({
            host: this.options.host,
            username: user,
            password: password
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
}
util.inherits(VictronGX, EventEmitter);
module.exports = VictronGX;

function executeSSHCommand(user, password, host, command) {

    if (password.trim().length <= 0) {
        throw new Error(`Please configure a SSH password before using this action`);
    }

    const ssh = new NodeSSH();
    return ssh.connect({
        host: host,
        username: user,
        password: password
    }).then(function () {
        return ssh.execCommand(command).then(function (result) {
            console.log('STDOUT: ' + result.stdout)
            console.log('STDERR: ' + result.stderr)
            return result.stdout;
        }).catch(reason => {
            return Promise.reject(reason);
        });
    }).catch(reason => {
        return Promise.reject(reason);
    });
}

function createBuffer(numValue, factor) {
    let buffer = Buffer.alloc(2);
    buffer.writeInt16BE(numValue * factor);
    return buffer;
}

// Function to fetch values from modbus
const modbusReading = async (self, registry) => {
    try {
        //Read using the correct client
        let retVal = null;
        //Check if we have the client, if not ignore reading the value
        if (self.modbusClients[registry.unitCode]) {
            const result = await self.modbusClients[registry.unitCode].readHoldingRegisters(registry.registryId, registry.count);
            retVal = result.response._body._valuesAsBuffer;
        }
        return retVal;
    } catch (err) {
        self.emit('error', new Error(`Failed to read '${registry.comment}' (${registry.registryId}) using unitId '${self.modbusClients[registry.unitCode].unitId}' (${registry.unitCode})`));
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

function validateIPaddress(ipaddress) {
    if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ipaddress)) {
        return (true)
    } else {
        return (false)
    }
}

function isPortAvailable(address, port) {
    return new Promise((resolve => {
        const socket = new net.Socket();

        const onError = () => {
            socket.destroy();
            resolve(false);
        };

        socket.setTimeout(1000);
        socket.once('error', onError);
        socket.once('timeout', onError);

        socket.connect(port, address, () => {
            socket.end();
            resolve(true);
        });
    }));
}

// sleep time expects milliseconds
function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}
