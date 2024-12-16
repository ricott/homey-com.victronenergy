'use strict';
const { Energy } = require('./devices/energy.js');
const VictronBase = require('./victronBase.js');

class EnergyMeter extends VictronBase {
    constructor(options) {
        super(Energy, options);
    }
}

module.exports = EnergyMeter;