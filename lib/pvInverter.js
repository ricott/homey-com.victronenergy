'use strict';
const { Inverter } = require('./devices/inverter.js');
const VictronBase = require('./victronBase.js');

class PVInverter extends VictronBase {
    constructor(options) {
        super(Inverter, options);
    }
}

module.exports = PVInverter;