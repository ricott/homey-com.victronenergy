'use strict';

const BaseDriver = require('../baseDriver.js');
const { Temperature } = require('../../lib/modbus/registry/temperature.js');

class TemperatureDriver extends BaseDriver {

    async onInit() {
        this._sensor_status_changed = this.homey.flow.getDeviceTriggerCard('sensor_status_changed');
    }

    async triggerSensorStatusChanged(device, tokens) {
        await this._sensor_status_changed.trigger(device, tokens, {}).catch(this.error);
    }

    async onPair(session) {
        return await super.pair(Temperature.productId, 'Temperature', session);
    }

}
module.exports = TemperatureDriver;