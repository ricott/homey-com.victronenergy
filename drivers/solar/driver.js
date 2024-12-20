'use strict';

const BaseDriver = require('../baseDriver.js');
const { SolarCharger } = require('../../lib/devices/solar.js');

class SolarChargerDriver extends BaseDriver {

    async onPair(session) {
        return await super.pair(SolarCharger.totalYield, 'Solar Charger', session, true);
    }
}
module.exports = SolarChargerDriver;
