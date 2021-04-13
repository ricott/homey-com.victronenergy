'use strict';

var modbus = require('jsmodbus');
var net = require('net');
var EventEmitter = require('events');
var util = require('util');
const deviceType = require('./deviceType.js');
const config = require('./const.js');

class VictronGX {
  constructor(options) {
    var self = this;
    EventEmitter.call(self);
    self.pollIntervals = [];
    self.connected = false;
    self.shouldBeConnected = false;
    self.setupReconnectOptions();
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

    self.options = options;
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
    self.modbusClients[config.gxSystemUnitId] = new modbus.client.TCP(self.socket, config.gxSystemUnitId);
    self.modbusClients[config.gxVEBusUnitId] = new modbus.client.TCP(self.socket, config.gxVEBusUnitId);

    self.socket.on('connect', function () {
      console.log(`Modbus client connected on IP '${self.options.host}'`);
      self.connected = true;
      self.shouldBeConnected = true;
      //Connect successful, reset options
      self.setupReconnectOptions();

      self.readProperties();

      //No point in initializing timers if we close connection immediately
      if (self.options.autoClose) {
        //Wait 3 seconds to allow properties to be read
        sleep(3000).then(() => {
          self.disconnect();
        });
      } else {
        self.initilializeTimers();
      }
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
    var self = this;
    self.shouldBeConnected = false;

    self.pollIntervals.forEach(timer => {
      clearInterval(timer);
    });

    if (self.socket) {
      self.socket.destroy();
    }
  }

  isConnected = function () {
    var self = this;

    if (self.connected) {
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
    self.deviceType = 'n/a';
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
    return this.modbusClients[config.gxSystemUnitId].writeMultipleRegisters(2700, createBuffer(power, 1))
      .then((result) => {
        return true;
      }).catch(reason => {
        return Promise.reject(reason);
      });
  }

  //Scale factor 0.1
  limitInverterPower(power) {
    return this.modbusClients[config.gxSystemUnitId].writeMultipleRegisters(2704, createBuffer(power, 0.1))
      .then((result) => {
        return true;
      }).catch(reason => {
        return Promise.reject(reason);
      });
  }

  //Works only on DVCC
  limitChargerCurrent(current) {
    return this.modbusClients[config.gxSystemUnitId].writeMultipleRegisters(2705, createBuffer(current, 1))
      .then((result) => {
        return true;
      }).catch(reason => {
        return Promise.reject(reason);
      });
  }

  //Scale factor 0.01
  limitGridFeedInPower(power) {
    return this.modbusClients[config.gxSystemUnitId].writeMultipleRegisters(2706, createBuffer(power, 0.01))
      .then((result) => {
        return true;
      }).catch(reason => {
        return Promise.reject(reason);
      });
  }

  //Scale factor 10
  writeESSMinimumSOC(percentage) {
    return this.modbusClients[config.gxSystemUnitId].writeMultipleRegisters(2901, createBuffer(percentage, 10))
      .then((result) => {
        return true;
      }).catch(reason => {
        return Promise.reject(reason);
      });
  }

  //Doesn't work on DVCC (set charger current to 0 instead)
  disableCharger() {
    return this.modbusClients[config.gxSystemUnitId].writeMultipleRegisters(2701, createBuffer(0, 1))
      .then((result) => {
        return true;
      }).catch(reason => {
        return Promise.reject(reason);
      });
  }

  //Doesn't work on DVCC
  enableCharger() {
    return this.modbusClients[config.gxSystemUnitId].writeMultipleRegisters(2701, createBuffer(100, 1))
      .then((result) => {
        return true;
      }).catch(reason => {
        return Promise.reject(reason);
      });
  }

  disableInverter() {
    return this.modbusClients[config.gxSystemUnitId].writeMultipleRegisters(2702, createBuffer(0, 1))
      .then((result) => {
        return true;
      }).catch(reason => {
        return Promise.reject(reason);
      });
  }

  enableInverter() {
    return this.modbusClients[config.gxSystemUnitId].writeMultipleRegisters(2702, createBuffer(100, 1))
      .then((result) => {
        return true;
      }).catch(reason => {
        return Promise.reject(reason);
      });
  }
}
util.inherits(VictronGX, EventEmitter);
module.exports = VictronGX;

function createBuffer(numValue, factor) {
  let buffer = Buffer.alloc(2);
  buffer.writeInt16BE(numValue * factor);
  return buffer;
}

// Function to fetch values from modbus
const modbusReading = async (self, registry) => {
  try {
    //Read using the correct client
    const result = await self.modbusClients[registry.unitId].readHoldingRegisters(registry.registryId, registry.count);
    return result.response._body._valuesAsBuffer;
  } catch (err) {
    console.log(err);
    self.emit('error', new Error(`Failed to read '${registry.registryId}' with unitId '${registry.unitId}' for device type '${self.deviceType}'`));
    return [0, 0];
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
