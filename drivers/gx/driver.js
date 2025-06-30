'use strict';

const BaseDriver = require('../baseDriver.js');
const { GX } = require('../../lib/modbus/registry/gx.js');
const enums = require('../../lib/enums.js');

class GXDriver extends BaseDriver {

    async onInit() {

        this._switch_position_changed = this.homey.flow.getDeviceTriggerCard('switch_position_changed');
        this._vebus_status_changed = this.homey.flow.getDeviceTriggerCard('vebus_status_changed');
        this._alarm_status_changed = this.homey.flow.getDeviceTriggerCard('alarm_status_changed');
        this._input_source_changed = this.homey.flow.getDeviceTriggerCard('input_source_changed');

        this._dynamic_ess_mode_changed = this.homey.flow.getDeviceTriggerCard('dynamic_ess_mode_changed');
        this._dynamic_ess_mode_changed.registerRunListener(async (args, state) => {
            this.log(`Comparing '${args.mode.name}' with '${state.mode}'`);
            return args.mode.name == state.mode;
        });
        this._dynamic_ess_mode_changed.registerArgumentAutocompleteListener('mode',
            async (query, args) => {
                return enums.getDynamicESSMode();
            }
        );
    }

    async triggerDynamicESSModeChanged(device, tokens) {
        await this._dynamic_ess_mode_changed.trigger(device, tokens, {}).catch(error => { this.error(error) });
    }

    async triggerSwitchPositionChanged(device, tokens) {
        await this._switch_position_changed.trigger(device, tokens, {}).catch(error => { this.error(error) });
    }

    async triggerVebusStatusChanged(device, tokens) {
        await this._vebus_status_changed.trigger(device, tokens, {}).catch(error => { this.error(error) });
    }

    async triggerAlarmStatusChanged(device, tokens) {
        await this._alarm_status_changed.trigger(device, tokens, {}).catch(error => { this.error(error) });
    }

    async triggerInputSourceChanged(device, tokens) {
        await this._input_source_changed.trigger(device, tokens, {}).catch(error => { this.error(error) });
    }

    async onPair(session) {
        return await super.pair(GX.inputL1, 'GX', session, true);
    }

}
module.exports = GXDriver;