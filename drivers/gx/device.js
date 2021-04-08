'use strict';

const { Device } = require('homey');
const VictronGX = require('../../lib/victron.js');
const enums = require('../../lib/enums.js');
const dateFormat = require("dateformat");

class GXDevice extends Device {

    async onInit() {
        this.log(`[${this.getName()}] Victron GX device initiated`);

        this.gx = {
            id: this.getData().id,
            name: this.getName(),
            address: this.getSettings().address,
            port: this.getSettings().port,
            refreshInterval: this.getSettings().refreshInterval
        };

        this.setupGXSession();
    }

    setupGXSession() {
        this.gx.api = new VictronGX({
            host: this.gx.address,
            port: this.gx.port,
            refreshInterval: this.gx.refreshInterval
        });

        this._initializeEventListeners();
    }

    destroyGXSession() {
        if (this.gx.api) {
            this.gx.api.disconnect();
        }
    }

    reinitializeGXSession() {
        this.destroyGXSession();
        this.setupGXSession();
    }

    updateSetting(key, value) {
        let obj = {};
        obj[key] = String(value);
        this.setSettings(obj).catch(err => {
            this.error('Failed to update settings', err);
        });
    }

    _initializeEventListeners() {
        let self = this;

        self.gx.api.on('properties', message => {
            this.updateSetting('vrmId', message.vrmId);
        });

        self.gx.api.on('readings', message => {

            let grid = message.gridL1 + message.gridL2 + message.gridL3;
            let pvPower = message.acPVInputL1 + message.acPVInputL2 + message.acPVInputL3;
            pvPower += message.acPVOutputL1 + message.acPVOutputL2 + message.acPVOutputL3;
            pvPower += message.dcPV;

            let consumption = pvPower - message.batteryPower + grid;
            self._updateProperty('measure_power.consumption', consumption);
            self._updateProperty('measure_power.grid', grid);
            self._updateProperty('measure_power.PV', pvPower);
            self._updateProperty('measure_power.battery', message.batteryPower);
            self._updateProperty('operational_status', enums.decodeBatteryState(message.batteryState));
            self._updateProperty('battery_capacity', message.batterySOC);
            self._updateProperty('measure_voltage.battery', message.batteryVoltage);
            self._updateProperty('measure_current.battery', message.batteryCurrent);

        });

        self.gx.api.on('error', error => {
            self.error('Houston we have a problem', error);

            let message = '';
            if (self.isError(error)) {
                message = error.stack;
            } else {
                try {
                    message = JSON.stringify(error, null, "  ");
                } catch (e) {
                    self.log('Failed to stringify object', e);
                    message = error.toString();
                }
            }

            self.setSettings({ last_error: dateFormat(new Date(), 'yyyy-mm-dd HH:MM:ss') + '\n' + message })
                .catch(err => {
                    self.error('Failed to update settings', err);
                });
        });
    }

    isError(err) {
        return (err && err.stack && err.message);
    }

    _updateProperty(key, value) {
        //Ignore unknown capabilities
        if (this.hasCapability(key)) {
            //All trigger logic only applies to changed values
            if (this.isCapabilityValueChanged(key, value)) {
                this.setCapabilityValue(key, value);

                if (key == 'operational_status') {
                    let tokens = {
                        status: value
                    }
                    this.driver.triggerDeviceFlow('operational_status_changed', tokens, this);
                    
                } else if (key == 'battery_capacity') {
                    let tokens = {
                        soc: value
                    }
                    this.driver.triggerDeviceFlow('soc_changed', tokens, this);
                }

            } else {
                //Update value to refresh timestamp in app
                this.setCapabilityValue(key, value);
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
        this.log(`Deleting Victron GX device '${this.getName()}' from Homey.`);
        this.gx.api.disconnect();
        this.gx = null;
    }

    onRenamed(name) {
        this.log(`Renaming Victron GX device from '${this.gx.name}' to '${name}'`);
        this.gx.name = name;
    }

    async onSettings(oldSettings, newSettings, changedKeysArr) {
        let changeConn = false;
        if (changedKeysArr.indexOf("address") > -1) {
            this.log('Address value was change to:', newSettings.address);
            this.gx.address = newSettings.address;
            changeConn = true;
        }

        if (changedKeysArr.indexOf("port") > -1) {
            this.log('Port value was change to:', newSettings.port);
            this.gx.port = newSettings.port;
            changeConn = true;
        }

        if (changedKeysArr.indexOf("refreshInterval") > -1) {
            this.log('Refresh interval value was change to:', newSettings.refreshInterval);
            this.gx.refreshInterval = newSettings.refreshInterval;
            changeConn = true;
        }

        if (changeConn) {
            //We need to re-initialize the GX session since setting(s) are changed
            this.reinitializeGXSession();
        }
    }
}
module.exports = GXDevice;
