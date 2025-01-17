'use strict';

const Generator = require('../../lib/devices/generator.js');
const utilFunctions = require('../../lib/util.js');
const BaseDevice = require('../baseDevice.js');
const enums = require('../../lib/enums.js');

class GeneratorDevice extends BaseDevice {

    async setupGXSession(host, port, modbus_unitId, refreshInterval) {
        this.api = new Generator({
            host: host,
            port: port,
            modbus_unitId: modbus_unitId,
            refreshInterval: refreshInterval,
            device: this
        });

        await this._initializeEventListeners();
    }

    async _initializeEventListeners() {
        let self = this;

        // self.api.on('properties', message => {
        //     self.updateSetting('serial', message.serial);
        // });

        self.api.on('readings', message => {

            self._updateProperty('sensor_status', enums.decodeGenSetState(message.state));
            //self._updateProperty('measure_power.genset', message.power || 0);

        });

        self.api.on('error', error => {
            self.error('Houston we have a problem', error);

            let message = '';
            if (utilFunctions.isError(error)) {
                message = error.stack;
            } else {
                try {
                    message = JSON.stringify(error, null, "  ");
                } catch (e) {
                    self.log('Failed to stringify object', e);
                    message = 'Unknown error';
                }
            }

            const timeString = new Date().toLocaleString('sv-SE', { hour12: false, timeZone: self.homey.clock.getTimezone() });
            self.setSettings({ last_error: timeString + '\n' + message })
                .catch(err => {
                    self.error('Failed to update settings', err);
                });
        });
    }
}
module.exports = GeneratorDevice;