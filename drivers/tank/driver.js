'use strict';

const BaseDriver = require('../baseDriver.js');
const { Tank } = require('../../lib/modbus/registry/tank.js');

class TankDriver extends BaseDriver {

    async onInit() {
        this._sensor_status_changed = this.homey.flow.getDeviceTriggerCard('sensor_status_changed');
        this._tank_level_changed = this.homey.flow.getDeviceTriggerCard('tank_level_changed');
    }

    async triggerSensorStatusChanged(device, tokens) {
        await this._sensor_status_changed.trigger(device, tokens, {}).catch(this.error);
    }

    async triggerTankLevelChanged(device, tokens) {
        await this._tank_level_changed.trigger(device, tokens, {}).catch(this.error);
    }

    async onPair(session) {
        return await super.pair(Tank.productId, 'Tank', session);
    }
}
module.exports = TankDriver;