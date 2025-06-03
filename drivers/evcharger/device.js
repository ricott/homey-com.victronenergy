'use strict';

const VehicleCharger = require('../../lib/devices/vehicleCharger.js');
const utilFunctions = require('../../lib/util.js');
const BaseDevice = require('../baseDevice.js');
const enums = require('../../lib/enums.js');

const deviceClass = 'evcharger';

class EvChargerDevice extends BaseDevice {

    async onInit() {
        await this.upgradeDevice();
        await this.setupCapabilityListeners();
        await super.onInit();
    }

    async upgradeDevice() {
        this.logMessage('Upgrading existing device');

        // Change device class to evcharger if not already
        if (this.getClass() !== deviceClass) {
            this.logMessage(`Changing device class to ${deviceClass}`);
            await this.setClass(deviceClass);
        }

        // Homey v12.4.5+ mandatory EV charger capabilities
        await this.addCapabilityHelper('evcharger_charging');
        await this.addCapabilityHelper('evcharger_charging_state');
        await this.removeCapabilityHelper('onoff');
    }

    async setupGXSession(host, port, modbus_unitId, refreshInterval) {
        this.api = new VehicleCharger({
            host: host,
            port: port,
            modbus_unitId: modbus_unitId,
            refreshInterval: refreshInterval,
            device: this
        });

        await this.api.initialize();
        await this._initializeEventListeners();
    }

    async setupCapabilityListeners() {
        this.registerCapabilityListener('evcharger_charging', async (value) => {
            if (value) {
                // Start
                await this.api.startCharging()
                    .catch(reason => {
                        let defaultMsg = 'Failed to start charging!';
                        return Promise.reject(new Error(`${defaultMsg} ${reason.message}`));
                    });

            } else {
                // Stop
                await this.api.stopCharging()
                    .catch(reason => {
                        let defaultMsg = 'Failed to stop charging!';
                        return Promise.reject(new Error(`${defaultMsg} ${reason.message}`));
                    });
            }
        });
    }

    async _initializeEventListeners() {
        let self = this;

        self.api.on('properties', message => {

            this.setSettings({
                productId: String(message.productId),
                firmware: String(message.firmware),
                serial: String(message.serial),
                model: String(message.model)
            }).catch(err => {
                this.error(`Failed to update settings`, err);
            });
        });

        self.api.on('readings', message => {
            const statusText = enums.decodeEvChargerStatusType(message.status);
            const isCharging = statusText == enums.decodeEvChargerStatusType('Charging');
            self._updateProperty('evcharger_charging', isCharging);
            self._updateProperty('evcharger_charging_state', enums.decodeEnergyChargerMode(message.mode));

            self._updateProperty('measure_power', message.power);
            self._updateProperty('measure_current', message.current);
            self._updateProperty('measure_time', message.chargingTime);
            self._updateProperty('sensor_status', statusText);
            self._updateProperty('measure_current.max', message.maxChargeCurrent);
            self._updateProperty('sensor_status.mode', enums.decodeEvChargerModeType(message.mode));
            self._updateProperty('meter_power', message.lifetimeEnergy);
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
        // Ignore unknown capabilities
        if (self.hasCapability(key)) {
            // All trigger logic only applies to changed values
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
                // Update value to refresh timestamp in app
                self.setCapabilityValue(key, value)
                    .catch(reason => {
                        self.error(reason);
                    });
            }
        }
    }
}
module.exports = EvChargerDevice;
