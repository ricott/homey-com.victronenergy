'use strict';
const { Solar } = require('./devices/solar.js');
const VictronBase = require('./victronBase.js');

class SolarCharger extends VictronBase {
    constructor(options) {
        super(Solar, options);
    }
}

module.exports = SolarCharger;