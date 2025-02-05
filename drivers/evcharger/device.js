'use strict';

const { Device } = require('homey');
const VehicleCharger = require('../../lib/devices/vehicleCharger.js');
const utilFunctions = require('../../lib/util.js');
const enums = require('../../lib/enums.js');

const deviceClass = 'evcharger';

class EvChargerDevice extends Device {

    async onInit() {
        this.api = null;
        this.logMessage(`Victron EV Charger device initiated`);

        // Change device class to evcharger if not already
        if (this.getClass() !== deviceClass) {
            await this.setClass(deviceClass);
        }

        await this.setupCapabilities();

        await this.setupGXSession(
            this.getSettings().address,
            this.getSettings().port,
            this.getSettings().modbus_unitId,
            this.getSettings().refreshInterval
        );

        await this.setupCapabilityListeners();
    }

    async setupCapabilities() {
        this.logMessage('Setting up capabilities');

        // Don't want the option of single click in mobile app to start/stop charging
        await this.updateCapabilityOptions('onoff', { uiQuickAction: false });
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

    async destroyGXSession() {
        if (this.api) {
            await this.api.disconnect();
        }
    }

    async reinitializeGXSession(host, port, modbus_unitId, refreshInterval) {
        await this.destroyGXSession();
        await this.setupGXSession(host, port, modbus_unitId, refreshInterval);
    }

    async setupCapabilityListeners() {
        this.registerCapabilityListener('onoff', async (value) => {
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
            if (statusText == enums.decodeEvChargerStatusType('Charging')) {
                self._updateProperty('onoff', true);
            } else {
                self._updateProperty('onoff', false);
            }

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

    isCapabilityValueChanged(key, value) {
        let oldValue = this.getCapabilityValue(key);
        // If oldValue===null then it is a newly added device, lets not trigger flows on that
        if (oldValue !== null && oldValue != value) {
            return true;
        } else {
            return false;
        }
    }

    onDeleted() {
        this.logMessage(`Deleting Victron Temperature device from Homey.`);
        this.api.disconnect();
        this.api = null;
    }

    async onSettings({ oldSettings, newSettings, changedKeys }) {
        let changeConn = false;
        let host, port, modbus_unitId, refreshInterval;
        if (changedKeys.indexOf("address") > -1) {
            this.logMessage(`Address value was change to: '${newSettings.address}'`);
            host = newSettings.address;
            changeConn = true;
        }

        if (changedKeys.indexOf("port") > -1) {
            this.logMessage(`Port value was change to: '${newSettings.port}'`);
            port = newSettings.port;
            changeConn = true;
        }

        if (changedKeys.indexOf("modbus_unitId") > -1) {
            this.logMessage(`Modbus UnitId was change to: '${newSettings.modbus_unitId}'`);
            modbus_unitId = newSettings.modbus_unitId;
            changeConn = true;
        }

        if (changedKeys.indexOf("refreshInterval") > -1) {
            this.logMessage(`Refresh interval value was change to: '${newSettings.refreshInterval}'`);
            refreshInterval = newSettings.refreshInterval;
            changeConn = true;
        }

        if (changeConn) {
            // We need to re-initialize the GX session since setting(s) are changed
            this.reinitializeGXSession(
                host || this.getSettings().address,
                port || this.getSettings().port,
                modbus_unitId || this.getSettings().modbus_unitId,
                refreshInterval || this.getSettings().refreshInterval
            );
        }
    }

    updateSetting(key, value) {
        let obj = {};
        obj[key] = String(value);
        this.setSettings(obj).catch(err => {
            this.error(`Failed to update setting '${key}' with value '${value}'`, err);
        });
    }

    async updateCapabilityOptions(capability, options) {
        if (this.hasCapability(capability)) {
            try {
                this.logMessage(`Updating capability options '${capability}'`);
                await this.setCapabilityOptions(capability, options);
            } catch (reason) {
                this.error(`Failed to update capability options for '${capability}'`);
                this.error(reason);
            }
        }
    }

    logMessage(message) {
        this.log(`[${this.getName()}] ${message}`);
    }
}
module.exports = EvChargerDevice;
