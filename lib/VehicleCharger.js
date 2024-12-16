'use strict';
const { EvCharger } = require('./devices/evCharger.js');
const VictronBase = require('./victronBase.js');
const utilFunctions = require('./util.js');

class VehicleCharger extends VictronBase {
    constructor(options) {
        super(EvCharger, options);
    }

    setChargerMode(mode) {
        // 0=Manual;1=Auto
        return this.getModbusClient().writeMultipleRegisters(3815, utilFunctions.createBuffer(mode, 1))
            .then((result) => {
                return Promise.resolve(true);
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    setChargerCurrent(current) {
        return this.getModbusClient().writeMultipleRegisters(3825, utilFunctions.createBuffer(current, 1))
            .then((result) => {
                return Promise.resolve(true);
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    startCharging() {
        return this.getModbusClient().writeMultipleRegisters(3826, utilFunctions.createBuffer(1, 1))
            .then((result) => {
                return Promise.resolve(true);
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    stopCharging() {
        return this.getModbusClient().writeMultipleRegisters(3826, utilFunctions.createBuffer(0, 1))
            .then((result) => {
                return Promise.resolve(true);
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }
}

module.exports = VehicleCharger;