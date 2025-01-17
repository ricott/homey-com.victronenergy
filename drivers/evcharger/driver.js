'use strict';

const BaseDriver = require('../baseDriver.js');
const { EvCharger } = require('../../lib/modbus/registry/evCharger.js');

class EvChargerDriver extends BaseDriver {

    async onInit() {
        this._sensor_status_changed = this.homey.flow.getDeviceTriggerCard('sensor_status_changed');
    }

    triggerSensorStatusChanged(device, tokens) {
        this._sensor_status_changed.trigger(device, tokens, {}).catch(this.error);
    }

    async onPair(session) {
        return await super.pair(EvCharger.productId, 'EV Charger', session);
    }

}
module.exports = EvChargerDriver;