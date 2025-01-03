'use strict';

const BaseDriver = require('../baseDriver.js');
const { Solar } = require('../../lib/devices/solar.js');

class SolarChargerDriver extends BaseDriver {

    async onPair(session) {
        return await super.pair(Solar.totalYield, 'Solar Charger', session, true);
    }
}
module.exports = SolarChargerDriver;
