'use strict';

const TempSensor = require('../../lib/tempSensor.js');
const utilFunctions = require('../../lib/util.js');
const enums = require('../../lib/enums');
const BaseDevice = require('../baseDevice.js');

class TemperatureDevice extends BaseDevice {

    async setupGXSession(host, port, modbus_unitId, refreshInterval) {
        this.api = new TempSensor({
            host: host,
            port: port,
            modbus_unitId: modbus_unitId,
            refreshInterval: Math.max(60, refreshInterval),
            device: this
        });

        await this._initializeEventListeners();
    }

    async _initializeEventListeners() {
        let self = this;

        self.api.on('properties', message => {
            self.updateSetting('productId', message.productId);
            self.updateSetting('type', enums.decodeTemperatureType(message.type));
        });

        self.api.on('readings', message => {

            self._updateProperty('measure_temperature', message.temperature || 0);
            self._updateProperty('measure_humidity', message.humidity || 0);
            self._updateProperty('measure_pressure', message.pressure || 0);
            self._updateProperty('measure_voltage', message.batteryVoltage || 0);
            self._updateProperty('sensor_status', enums.decodeSensorStatus(message.status));
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

    _updateProperty(key, value) {
        let self = this;
        //Ignore unknown capabilities
        if (self.hasCapability(key)) {
            //All trigger logic only applies to changed values
            if (self.isCapabilityValueChanged(key, value)) {
                self.setCapabilityValue(key, value)
                    .then(function () {
                        if (key == 'sensor_status') {
                            const tokens = {
                                status: value
                            }
                            self.driver.triggerSensorStatusChanged(self, tokens);
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
}
module.exports = TemperatureDevice;
