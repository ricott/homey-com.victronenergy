'use strict';

const { Device } = require('homey');
const VictronGX = require('../../lib/victron.js');
const { GX_v1 } = require('../../lib/devices/gx_v1.js');
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
            refreshInterval: this.getSettings().refreshInterval,
            modbus_vebus_unitId: this.getSettings().modbus_vebus_unitId,
            vebusAlarms: '',
            vebusWarnings: ''
        };

        this.setupGXSession();
    }

    setupGXSession() {
        this.gx.api = new VictronGX({
            host: this.gx.address,
            port: this.gx.port,
            vebusUnitId: this.gx.modbus_vebus_unitId,
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

    updateSettingIfChanged(key, newValue, oldValue) {
        if (newValue != oldValue) {
            this.updateSetting(key, newValue);
        }
    }

    handleAlarmStatuses(message) {
        let alarmArr = [];
        let warningArr = [];
        Object.keys(message).forEach(function (key) {
            if (key.startsWith('alarm')) {
                if (message[key] == 1) {
                    //We have a warning
                    warningArr.push(GX_v1[key].comment);
                } else if (message[key] == 2) {
                    //We have an alarm
                    alarmArr.push(GX_v1[key].comment);
                }
            }
        });

        let alarmMsg = 'Ok'
        if (alarmArr.length > 0) {
            alarmMsg = alarmArr.join(', ');
        }
        this.updateSettingIfChanged('vebusAlarms', alarmMsg, this.gx.vebusAlarms);
        this.gx.vebusAlarms = alarmMsg;

        let warningMsg = 'Ok'
        if (warningArr.length > 0) {
            warningMsg = warningArr.join(', ');
        }
        this.updateSettingIfChanged('vebusWarnings', warningMsg, this.gx.vebusWarnings);
        this.gx.vebusWarnings = warningMsg;

        let status = 'Ok';
        if (alarmArr.length > 0) {
            status = 'Alarm';
        } else if (warningArr.length > 0) {
            status = 'Warning';
        }

        return status;
    }

    _initializeEventListeners() {
        let self = this;

        self.gx.api.on('properties', message => {
            this.updateSetting('vrmId', message.vrmId);
            this.updateSetting('essMode', enums.decodeESSState(message.essMode));
        });

        self.gx.api.on('readings', message => {

            let grid = message.gridL1 + message.gridL2 + message.gridL3;
            let pvPower = message.acPVInputL1 + message.acPVInputL2 + message.acPVInputL3;
            pvPower += message.acPVOutputL1 + message.acPVOutputL2 + message.acPVOutputL3;
            pvPower += message.dcPV;

            //Calculate self consumption
            let consumption = pvPower - message.batteryPower + grid;
            self._updateProperty('measure_power.consumption', consumption);
            self._updateProperty('measure_power.grid', grid);
            self._updateProperty('measure_power.PV', pvPower);
            self._updateProperty('measure_power.battery', message.batteryPower);
            self._updateProperty('vebus_status', enums.decodeVEBusStatus(message.veBusStatus));
            let alarmStatus = self.handleAlarmStatuses(message);
            self._updateProperty('alarm_status', alarmStatus);
            self._updateProperty('battery_status', enums.decodeBatteryStatus(message.batteryStatus));
            self._updateProperty('battery_capacity', message.batterySOC);
            self._updateProperty('measure_voltage.battery', message.batteryVoltage);
            self._updateProperty('measure_current.battery', message.batteryCurrent);
            self._updateProperty('switch_position', enums.decodeSwitchPosition(message.switchPosition));
            
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

                if (key == 'battery_status') {
                    let tokens = {
                        status: value
                    }
                    this.driver.triggerDeviceFlow('battery_status_changed', tokens, this);

                } else if (key == 'vebus_status') {
                    let tokens = {
                        status: value
                    }
                    this.driver.triggerDeviceFlow('vebus_status_changed', tokens, this);

                } else if (key == 'battery_capacity') {
                    let tokens = {
                        soc: value
                    }
                    this.driver.triggerDeviceFlow('soc_changed', tokens, this);

                } else if (key == 'alarm_status') {
                    let tokens = {
                        status: value,
                        alarms: this.gx.vebusAlarms,
                        warnings: this.gx.vebusWarnings
                    }
                    this.driver.triggerDeviceFlow('alarm_status_changed', tokens, this);

                } else if (key == 'switch_position') {
                    let tokens = {
                        mode: value
                    }
                    this.driver.triggerDeviceFlow('switch_position_changed', tokens, this);
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

        if (changedKeysArr.indexOf("modbus_vebus_unitId") > -1) {
            this.log('Modbus UnitId for VEBus value was change to:', newSettings.modbus_vebus_unitId);
            this.gx.modbus_vebus_unitId = newSettings.modbus_vebus_unitId;
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
