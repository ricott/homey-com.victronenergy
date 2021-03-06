'use strict';

const { Device } = require('homey');
const VictronGX = require('../../lib/victron');
const { GX_v1 } = require('../../lib/devices/gx_v1');
const enums = require('../../lib/enums');
const minGridSuplusPower = 200;

class GXDevice extends Device {

    async onInit() {
        this.pollIntervals = [];
        this.api = null;
        this.vebusAlarms = '';
        this.vebusWarnings = '';
        this.localLog = [];
        await this.setStoreValue('grid_surplus', 0);

        this.logMessage(`Victron GX device initiated`);
        this.logMessage(`Control charge current: ${this.getSettings().controlChargeCurrent}`);

        await this.setupGXSession(
            this.getSettings().address,
            this.getSettings().port,
            this.getSettings().modbus_vebus_unitId,
            this.getSettings().modbus_battery_unitId,
            this.getSettings().refreshInterval);
        this._initilializeTimers();
    }

    async setupGXSession(host, port, vebusUnitId, batteryUnitId, refreshInterval) {
        this.api = await new VictronGX({
            host: host,
            port: port,
            vebusUnitId: vebusUnitId,
            batteryUnitId: batteryUnitId,
            refreshInterval: refreshInterval
        });

        await this._initializeEventListeners();
    }

    async destroyGXSession() {
        if (this.api) {
            await this.api.disconnect();
        }
    }

    async reinitializeGXSession(host, port, vebusUnitId, batteryUnitId, refreshInterval) {
        await this.destroyGXSession();
        await this.setupGXSession(host, port, vebusUnitId, batteryUnitId, refreshInterval);
    }

    _initilializeTimers() {
        this.logMessage('Adding timers');
        //Update debug info every minute with last 10 messages
        this.pollIntervals.push(setInterval(() => {
            this.updateDebugMessages();
        }, 60 * 1000));
    }

    _deleteTimers() {
        //Kill interval object(s)
        this.logMessage('Removing timers');
        this.pollIntervals.forEach(timer => {
            clearInterval(timer);
        });
    }

    updateSetting(key, value) {
        let obj = {};
        obj[key] = String(value);
        this.setSettings(obj).catch(err => {
            this.error(`Failed to update setting '${key}' with value '${value}'`, err);
        });
    }

    updateSettingIfChanged(key, newValue, oldValue) {
        if (newValue != oldValue) {
            this.updateSetting(key, newValue);
        }
    }

    updateNumericSettingIfChanged(key, newValue, oldValue, suffix) {
        if (!isNaN(newValue)) {
            this.updateSettingIfChanged(key, `${newValue}${suffix}`, `${oldValue}${suffix}`);
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
        this.updateSettingIfChanged('vebusAlarms', alarmMsg, this.vebusAlarms);
        this.vebusAlarms = alarmMsg;

        let warningMsg = 'Ok'
        if (warningArr.length > 0) {
            warningMsg = warningArr.join(', ');
        }
        this.updateSettingIfChanged('vebusWarnings', warningMsg, this.vebusWarnings);
        this.vebusWarnings = warningMsg;

        let status = 'Ok';
        if (alarmArr.length > 0) {
            status = 'Alarm';
        } else if (warningArr.length > 0) {
            status = 'Warning';
        }

        return status;
    }

    noCarIsCharging() {
        this.logMessage(`No car is charging, resetting discharge power to ${this.getSetting('maxDischargePower')}`);
        this.updateSetting('carCharging', 'false');

        return this.api.limitInverterPower(this.getSetting('maxDischargePower'))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    aCarIsCharging() {
        this.updateSetting('carCharging', 'true');
        //Always limit discharge power, doesnt matter if pv power is there or not
        this.updateNumericSettingIfChanged('maxDischargePower', this.getSetting('activeMaxDischargePower'), 0, 'W');
        this.logMessage(`A car is charging, limiting discharge power to ${this.getSetting('maxDischargePowerWhenCarCharging')}W`);
        return this.api.limitInverterPower(this.getSetting('maxDischargePowerWhenCarCharging'))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    calculateExcessSolar() {
        let pvPower = this.getCapabilityValue('measure_power.PV');
        let consumptionPower = this.getCapabilityValue('measure_power');

        return pvPower - consumptionPower;
    }

    calculateChargeCurrent(soc) {

        let chargeCurrent = this.getSettings().chargeLevel13;
        if (soc < 10) {
            chargeCurrent = this.getSettings().chargeLevel1;
        } else if (soc > 9 && soc < 20) {
            chargeCurrent = this.getSettings().chargeLevel2;
        } else if (soc > 19 && soc < 30) {
            chargeCurrent = this.getSettings().chargeLevel3;
        } else if (soc > 29 && soc < 40) {
            chargeCurrent = this.getSettings().chargeLevel4;
        } else if (soc > 39 && soc < 50) {
            chargeCurrent = this.getSettings().chargeLevel5;
        } else if (soc > 49 && soc < 60) {
            chargeCurrent = this.getSettings().chargeLevel6;
        } else if (soc > 59 && soc < 70) {
            chargeCurrent = this.getSettings().chargeLevel7;
        } else if (soc > 69 && soc < 75) {
            chargeCurrent = this.getSettings().chargeLevel8;
        } else if (soc > 74 && soc < 80) {
            chargeCurrent = this.getSettings().chargeLevel9;
        } else if (soc > 79 && soc < 85) {
            chargeCurrent = this.getSettings().chargeLevel10;
        } else if (soc > 84 && soc < 90) {
            chargeCurrent = this.getSettings().chargeLevel11;
        } else if (soc > 89 && soc < 95) {
            chargeCurrent = this.getSettings().chargeLevel12;
        } else if (soc > 94) {
            chargeCurrent = this.getSettings().chargeLevel13;
        }

        return chargeCurrent;
    }

    async adjustChargeCurrent(soc, activeMaxChargeCurrent) {
        if (this.getSettings().controlChargeCurrent == 'yes') {
            let chargeCurrent = this.calculateChargeCurrent(soc);
            if (activeMaxChargeCurrent != chargeCurrent) {
                this.logMessage(`SoC: ${soc}%, activeCurrent: ${activeMaxChargeCurrent}A, changing charge current to: ${chargeCurrent}A`);
                this.api.limitChargerCurrent(chargeCurrent)
                    .catch(reason => {
                        this.error(`Failed to set charge current to ${chargeCurrent}A`, reason);
                    });
            }
        }
    }
    /*
        calculateEfficiency(status, message) {
    
            let input = message.inputL1 + message.inputL2 + message.inputL3;
            let output = message.outputL1 + message.outputL2 + message.outputL3;
            let total = 0;
    
            let efficiency = 0;
            if (enums.decodeBatteryStatus(status) === enums.decodeBatteryStatus('Charging')) {
                total = input + output;
                efficiency = message.batteryPower / total;
            } else if (enums.decodeBatteryStatus(status) === enums.decodeBatteryStatus('Discharging')) {
                total = input;
                efficiency = total / message.batteryPower;
            }
            //Efficiency cant be higher than 100% and less than 0%
            efficiency = Math.min(efficiency, 100.00);
            //efficiency = Math.max(efficiency, 0);
            efficiency = (efficiency*100).toFixed(2);
    
            this.log(`Input ${input}W (${message.inputL1}/${message.inputL2}/${message.inputL3}) Output ${output}W (${message.outputL1}/${message.outputL2}/${message.outputL3})`);
            this.log(`Currently ${enums.decodeBatteryStatus(message.batteryStatus)}, Used ${total}W Battery ${message.batteryPower}W Efficiency ${efficiency}%`);
    
            return parseFloat(efficiency);
        }
        */

    async _initializeEventListeners() {
        let self = this;

        self.api.on('properties', message => {
            this.updateSetting('vrmId', message.vrmId);
            this.updateSetting('essMode', enums.decodeESSState(message.essMode));
        });

        self.api.on('readings', message => {

            let previousReadings = self.getStoreValue('previousReadings');
            if (previousReadings == null) {
                self.log('Previous readings is null');
                previousReadings = {};
            }

            let grid = message.gridL1 + message.gridL2 + message.gridL3;
            let pvPower = message.acPVInputL1 + message.acPVInputL2 + message.acPVInputL3;
            pvPower += message.acPVOutputL1 + message.acPVOutputL2 + message.acPVOutputL3;
            pvPower += message.dcPV;

            //Calculate self consumption
            let consumption = pvPower - message.batteryPower + grid;
            self._updateProperty('measure_power', consumption);
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

            self.updateNumericSettingIfChanged('activeMaxChargeCurrent', message.maxChargeCurrent, previousReadings.maxChargeCurrent, 'A');
            self.updateNumericSettingIfChanged('activeMaxDischargePower', message.activeMaxDischargePower, previousReadings.activeMaxDischargePower, 'W');
            //maxDischargePower should only be 0 first time
            if (self.getSetting('maxDischargePower').length === 0) {
                self.updateNumericSettingIfChanged('maxDischargePower', message.activeMaxDischargePower, 0, 'W');
            }
            self.updateNumericSettingIfChanged('maxGridFeedinPower', message.maxGridFeedinPower, previousReadings.maxGridFeedinPower, 'W');
            self.updateNumericSettingIfChanged('gridSetpointPower', message.gridSetpointPower, previousReadings.gridSetpointPower, 'W');
            self.updateNumericSettingIfChanged('minimumSOC', message.minimumSOC, previousReadings.minimumSOC, '%');

            //Battery unitId may be empty, thus this value null
            if (message.timeSinceLastFullCharge) {
                self.updateNumericSettingIfChanged('timeSinceLastFullCharge', message.timeSinceLastFullCharge, previousReadings.timeSinceLastFullCharge, 's');
            }

            self.adjustChargeCurrent(message.batterySOC, message.maxChargeCurrent);

            //let efficiency = self.calculateEfficiency(message.batteryStatus, message);

            //Store a copy of the json
            self.setStoreValue('previousReadings', message);
        });

        self.api.on('error', error => {
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

            const timeString = new Date().toLocaleString('sv-SE', { hour12: false, timeZone: self.homey.clock.getTimezone() });
            self.setSettings({ last_error: timeString + '\n' + message })
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
                        alarms: this.vebusAlarms,
                        warnings: this.vebusWarnings
                    }
                    this.driver.triggerDeviceFlow('alarm_status_changed', tokens, this);

                } else if (key == 'switch_position') {
                    let tokens = {
                        mode: value
                    }
                    this.driver.triggerDeviceFlow('switch_position_changed', tokens, this);

                } else if (key == 'measure_voltage.battery') {
                    let tokens = {
                        voltage: value
                    }
                    this.driver.triggerDeviceFlow('battery_voltage_changed', tokens, this);

                } else if (key == 'measure_power.grid') {
                    let power = 0;
                    if (value < 0) {
                        power = value * -1;
                    }

                    if (this.getStoreValue('grid_surplus') != power) {
                        //Filter out most of the "false positives" when surplus is bouncing
                        //eg grid setpoint is set to 0
                        if (power === 0 || power > minGridSuplusPower) {
                            this.setStoreValue('grid_surplus', power);
                            let tokens = {
                                power: power,
                                single_phase: Math.round(power / 230),
                                three_phase: Math.round(power / 3 / 230)
                            }
                            this.driver.triggerDeviceFlow('grid_surplus_changed', tokens, this);
                        }
                    }
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
        this.logMessage(`Deleting Victron GX device '${this.getName()}' from Homey.`);
        this._deleteTimers();
        this.api.disconnect();
        this.api = null;
    }

    async onSettings({ oldSettings, newSettings, changedKeys }) {
        let changeConn = false;
        let host, port, vebusUnitId, batteryUnitId, refreshInterval;
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

        if (changedKeys.indexOf("modbus_vebus_unitId") > -1) {
            this.logMessage(`Modbus UnitId for VEBus value was change to: '${newSettings.modbus_vebus_unitId}'`);
            vebusUnitId = newSettings.modbus_vebus_unitId;
            changeConn = true;
        }

        if (changedKeys.indexOf("modbus_battery_unitId") > -1) {
            this.logMessage(`Modbus UnitId for battery value was change to: '${newSettings.modbus_battery_unitId}'`);
            batteryUnitId = newSettings.modbus_battery_unitId;
            changeConn = true;
        }

        if (changedKeys.indexOf("refreshInterval") > -1) {
            this.logMessage(`Refresh interval value was change to: '${newSettings.refreshInterval}'`);
            refreshInterval = newSettings.refreshInterval;
            changeConn = true;
        }

        if (changedKeys.indexOf("controlChargeCurrent") > -1) {
            this.logMessage(`Control charge current value was change to: '${newSettings.controlChargeCurrent}'`);
        }

        if (changeConn) {
            //We need to re-initialize the GX session since setting(s) are changed
            this.reinitializeGXSession(
                host || this.getSettings().address, 
                port || this.getSettings().port, 
                vebusUnitId || this.getSettings().modbus_vebus_unitId, 
                batteryUnitId || this.getSettings().modbus_battery_unitId, 
                refreshInterval || this.getSettings().refreshInterval
            );
        }
    }
    
    logMessage(message) {
        this.log(`[${this.getName()}] ${message}`);
        if (this.localLog.length > 49) {
            //Remove oldest entry
            this.localLog.shift();
        }
        //Add new entry
        const timeString = new Date().toLocaleString('sv-SE', { hour12: false, timeZone: this.homey.clock.getTimezone() });
        this.localLog.push(timeString + ' ' + message + '\n');
    }

    getLogMessages() {
        return this.localLog.toString();
    }

    updateDebugMessages() {
        let msg = this.getLogMessages();
        if (msg != null) {
            this.setSettings({ log: msg })
                .catch(err => {
                    this.error('Failed to update log messages', err);
                    this.error(`Messages: '${msg}'`);
                });
        }
    }

    removeCapabilityHelper(capability) {
        if (this.hasCapability(capability)) {
            try {
                this.logMessage(`Remove existing capability '${capability}'`);
                this.removeCapability(capability);
            } catch (reason) {
                this.error(`Failed to removed capability '${capability}'`);
                this.error(reason);
            }
        }
    }
    addCapabilityHelper(capability) {
        if (!this.hasCapability(capability)) {
            try {
                this.logMessage(`Adding missing capability '${capability}'`);
                this.addCapability(capability);
            } catch (reason) {
                this.error(`Failed to add capability '${capability}'`);
                this.error(reason);
            }
        }
    }
}

// sleep time expects milliseconds
function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

module.exports = GXDevice;
