'use strict';

const EnergyMeter = require('../../lib/devices/energyMeter.js');
const utilFunctions = require('../../lib/util.js');
const BaseDevice = require('../baseDevice.js');
const minGridSuplusPower = 300;

class EnergyMeterDevice extends BaseDevice {

    async onInit() {
        await super.onInit();
        await this.setStoreValue('grid_surplus', 0);
        this._grid_surplus_changed = this.homey.flow.getDeviceTriggerCard('grid_surplus_changed');
    }

    _updateProperty(key, value) {
        let self = this;
        //Ignore unknown capabilities
        if (self.hasCapability(key)) {
            //All trigger logic only applies to changed values
            if (self.isCapabilityValueChanged(key, value)) {
                self.setCapabilityValue(key, value)
                    .then(function () {
                        if (key == 'measure_power') {
                            let power = 0;
                            if (value < 0) {
                                power = value * -1;
                            }

                            if (self.getStoreValue('grid_surplus') != power) {
                                //Filter out most of the "false positives" when surplus is bouncing
                                //eg grid setpoint is set to 0
                                if (power === 0 || power > minGridSuplusPower) {
                                    self.setStoreValue('grid_surplus', power);
                                    const tokens = {
                                        power: power,
                                        single_phase: Math.round(power / 230),
                                        three_phase: Math.round(power / 3 / 230)
                                    }
                                    self._grid_surplus_changed.trigger(self, tokens, {}).catch(error => { self.error(error) });

                                }
                            }
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
        this.api = new EnergyMeter({
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

        self.api.on('properties', message => {
            self.updateSetting('serial', message.serial);
        });

        self.api.on('readings', message => {

            const power = message.powerL1 + message.powerL2 + message.powerL3;
            self._updateProperty('measure_power', power);
            self._updateProperty('measure_power.L1', message.powerL1 || 0);
            self._updateProperty('measure_current.L1', message.currentL1 || 0);
            self._updateProperty('measure_voltage.L1', message.voltageL1 ? Math.round(message.voltageL1) : 0);
            self._updateProperty('measure_power.L2', message.powerL2 || 0);
            self._updateProperty('measure_current.L2', message.currentL2 || 0);
            self._updateProperty('measure_voltage.L2', message.voltageL2 ? Math.round(message.voltageL2) : 0);
            self._updateProperty('measure_power.L3', message.powerL3 || 0);
            self._updateProperty('measure_current.L3', message.currentL3 || 0);
            self._updateProperty('measure_voltage.L3', message.voltageL3 ? Math.round(message.voltageL3) : 0);

            self._updateProperty('meter_power', message.lifeTimeImport || 0);
            self._updateProperty('meter_power.export', message.lifeTimeExport || 0);

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
module.exports = EnergyMeterDevice;
