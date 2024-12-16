'use strict';
const { Temperature } = require('./devices/temperature.js');
const VictronBase = require('./victronBase.js');

class TempSensor extends VictronBase {
    constructor(options) {
        super(Temperature, options);
    }
}

module.exports = TempSensor;