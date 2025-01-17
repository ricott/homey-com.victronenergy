'use strict';

const BaseDriver = require('../baseDriver.js');
const { Inverter } = require('../../lib/modbus/registry/inverter.js');

class PVInverterDriver extends BaseDriver {

    async onPair(session) {
        return await super.pair(Inverter.serial, 'PV Inverter', session);
    }
}
module.exports = PVInverterDriver;
