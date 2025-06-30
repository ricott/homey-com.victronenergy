'use strict';

const BaseDriver = require('../baseDriver.js');
const { Energy } = require('../../lib/modbus/registry/energy.js');

class EnergyMeterDriver extends BaseDriver {

    async onInit() {
        this._grid_surplus_changed = this.homey.flow.getDeviceTriggerCard('grid_surplus_changed');
    }

    async triggerGridSurplusChanged(device, tokens) {
        await this._grid_surplus_changed.trigger(device, tokens, {}).catch(error => { this.error(error) });
    }

    async onPair(session) {
        return await super.pair(Energy.serial, 'Energy Meter', session);
    }

}
module.exports = EnergyMeterDriver;