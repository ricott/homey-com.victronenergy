'use strict';

const { Device } = require('homey');
const EnergyMeter = require('../../lib/energyMeter.js');
const utilFunctions = require('../../lib/util.js');

class EnergyMeterDevice extends Device {

    async onInit() {
        this.api = null;
        this.logMessage(`Victron Energy Meter device initiated`);

        await this.setupGXSession(
            this.getSettings().address,
            this.getSettings().port,
            this.getSettings().modbus_unitId,
            this.getSettings().refreshInterval
        );
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

    async destroyGXSession() {
        if (this.api) {
            await this.api.disconnect();
        }
    }

    async reinitializeGXSession(host, port, modbus_unitId, refreshInterval) {
        await this.destroyGXSession();
        await this.setupGXSession(host, port, modbus_unitId, refreshInterval);
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
            self._updateProperty('measure_voltage.L1', message.voltageL1 || 0);
            self._updateProperty('measure_power.L2', message.powerL2 || 0);
            self._updateProperty('measure_current.L2', message.currentL2 || 0);
            self._updateProperty('measure_voltage.L2', message.voltageL2 || 0);
            self._updateProperty('measure_power.L3', message.powerL3 || 0);
            self._updateProperty('measure_current.L3', message.currentL3 || 0);
            self._updateProperty('measure_voltage.L3', message.voltageL3 || 0);

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

    isCapabilityValueChanged(key, value) {
        let oldValue = this.getCapabilityValue(key);
        //If oldValue===null then it is a newly added device, lets not trigger flows on that
        if (oldValue !== null && oldValue != value) {
            return true;
        } else {
            return false;
        }
    }

    onDeleted() {
        this.logMessage(`Deleting Victron Energy Meter device from Homey.`);
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
            //We need to re-initialize the GX session since setting(s) are changed
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

    logMessage(message) {
        this.log(`[${this.getName()}] ${message}`);
    }
}
module.exports = EnergyMeterDevice;
