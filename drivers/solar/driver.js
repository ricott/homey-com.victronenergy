'use strict';

const BaseDriver = require('../baseDriver.js');
const { Solar } = require('../../lib/modbus/registry/solar.js');

class SolarChargerDriver extends BaseDriver {

    async onPair(session) {
        return await super.pair(Solar.state, 'Solar Charger', session, true);
    }
}
module.exports = SolarChargerDriver;
