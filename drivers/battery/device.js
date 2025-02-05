'use strict';

const Battery = require('../../lib/devices/batterySensor.js');
const utilFunctions = require('../../lib/util.js');
const BaseDevice = require('../baseDevice.js');
const enums = require('../../lib/enums.js');

class BatteryDevice extends BaseDevice {

    async onInit() {
        await super.onInit();
        this._battery_status_changed = this.homey.flow.getDeviceTriggerCard('battery_status_changed');
    }

    _updateProperty(key, value) {
        let self = this;
        //Ignore unknown capabilities
        if (self.hasCapability(key)) {
            //All trigger logic only applies to changed values
            if (self.isCapabilityValueChanged(key, value)) {
                self.setCapabilityValue(key, value)
                    .then(function () {
                        if (key == 'battery_status') {
                            const tokens = {
                                status: value
                            }
                            self._battery_status_changed.trigger(self, tokens, {}).catch(error => { self.error(error) });
                        }
                    }).catch(reason => {
                        self.error(reason);
                    });

            } else {
                //Update value to refresh timestamp in app
                self.setCapabilityValue(key, value)
                    .catch(reason => {
                        self.error(reason);
                    });
            }
        }
    }

    async setupGXSession(host, port, modbus_unitId, refreshInterval) {
        this.api = new Battery({
            host: host,
            port: port,
            modbus_unitId: modbus_unitId,
            refreshInterval: refreshInterval,
            device: this
        });

        await this.api.initialize();
        await this._initializeEventListeners();
    }

    async _initializeEventListeners() {
        let self = this;

        self.api.on('properties', message => {
            self.updateSetting('capacity', message.capacity);
        });

        self.api.on('readings', message => {

            self._updateProperty('measure_battery', message.soc);
            self._updateProperty('measure_voltage', message.voltage);
            self._updateProperty('measure_current', message.current);
            self._updateProperty('measure_power', message.power);
            self._updateProperty('measure_temperature', message.temperature);
            self._updateProperty('measure_voltage.minCell', message.minCellVoltage);
            self._updateProperty('measure_voltage.maxCell', message.maxCellVoltage);
            self._updateProperty('battery_status', enums.decodeBatteryStatus(message.status));
            self._updateProperty('alarm_generic', (message.alarm || 0) == 2);

            let tSinceLastFullCharge = '';
            if (message.timeSinceLastFullCharge) {
                tSinceLastFullCharge = `${message.timeSinceLastFullCharge}s`;
            }

            self.setSettings({
                timeSinceLastFullCharge: tSinceLastFullCharge
            }).catch(err => {
                self.error(`Failed to update timeSinceLastFullCharge`, err);
            });

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
module.exports = BatteryDevice;
