'use strict';

const BaseDriver = require('../baseDriver.js');
const { Battery } = require('../../lib/modbus/registry/battery.js');

class BatteryDriver extends BaseDriver {

    async onPair(session) {
        return await super.pair(Battery.capacity, 'Battery', session, true);
    }

}
module.exports = BatteryDriver;
