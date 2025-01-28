'use strict';
const { Battery } = require('../modbus/registry/battery.js');
const VictronBase = require('../victronBase.js');

class BatterySensor extends VictronBase {
    constructor(options) {
        super(Battery, options);
    }

}

module.exports = BatterySensor;