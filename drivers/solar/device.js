'use strict';

const SolarCharger = require('../../lib/devices/solarCharger.js');
const utilFunctions = require('../../lib/util.js');
const BaseDevice = require('../baseDevice.js');
const enums = require('../../lib/enums.js');

class SolarChargerDevice extends BaseDevice {

    async onInit() {
        await this.setupCapabilities();
        await super.onInit();
    }

    async setupGXSession(host, port, modbus_unitId, refreshInterval) {
        this.api = new SolarCharger({
            host: host,
            port: port,
            modbus_unitId: modbus_unitId,
            refreshInterval: refreshInterval,
            device: this
        });

        await this.api.initialize();
        await this._initializeEventListeners();
    }

    async setupCapabilities() {
        this.logMessage('Setting up capabilities');

        // Rename meter_power.total to meter_power
        await this.removeCapabilityHelper('meter_power.total');
        await this.addCapability('meter_power');
    }

    async _initializeEventListeners() {
        let self = this;

        // self.api.on('properties', message => {
        //     self.updateSetting('serial', message.serial);
        // });

        self.api.on('readings', message => {

            self._updateProperty('sensor_status', message.mode == 1 ? 'On' : 'Off');
            self._updateProperty('vebus_status', enums.decodeVEBusStatus(message.state));
            self._updateProperty('measure_power', message.power || 0);
            self._updateProperty('measure_current', message.current || 0);
            self._updateProperty('measure_voltage', message.voltage ? Math.round(message.voltage) : 0);
            self._updateProperty('meter_power.daily', message.dailyYield || 0);
            self._updateProperty('meter_power', message.totalYield || 0);

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
module.exports = SolarChargerDevice;
