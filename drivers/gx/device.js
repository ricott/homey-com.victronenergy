'use strict';

const { Device } = require('homey');
const VictronGX = require('../../lib/devices/victron.js');
const { GX } = require('../../lib/modbus/registry/gx.js');
const enums = require('../../lib/enums.js');
const utilFunctions = require('../../lib/util.js');
const minGridSuplusPower = 200;

class GXDevice extends Device {

    async onInit() {
        this.pollIntervals = [];
        this.api = null;
        this._switch_position_changed = this.homey.flow.getDeviceTriggerCard('switch_position_changed');
        this._battery_status_changed = this.homey.flow.getDeviceTriggerCard('battery_status_changed');
        this._vebus_status_changed = this.homey.flow.getDeviceTriggerCard('vebus_status_changed');
        this._alarm_status_changed = this.homey.flow.getDeviceTriggerCard('alarm_status_changed');
        this._soc_changed = this.homey.flow.getDeviceTriggerCard('soc_changed');
        this._battery_voltage_changed = this.homey.flow.getDeviceTriggerCard('battery_voltage_changed');
        this._grid_surplus_changed = this.homey.flow.getDeviceTriggerCard('grid_surplus_changed');
        this._input_source_changed = this.homey.flow.getDeviceTriggerCard('input_source_changed');

        await this.setStoreValue('grid_surplus', 0);

        this.logMessage(`Victron GX device initiated`);
        this.logMessage(`Control charge current: ${this.getSettings().controlChargeCurrent}`);

        await this.upgradeDevice();
        await this.registerFlowTokens();

        await this.setupGXSession(
            this.getSettings().address,
            this.getSettings().port,
            this.getSettings().modbus_vebus_unitId,
            this.getSettings().modbus_battery_unitId,
            this.getSettings().modbus_grid_unitId,
            this.getSettings().refreshInterval
        );
    }

    async setupGXSession(host, port, vebusUnitId, batteryUnitId, gridUnitId, refreshInterval) {
        this.api = await new VictronGX({
            host: host,
            port: port,
            vebusUnitId: vebusUnitId,
            batteryUnitId: batteryUnitId,
            gridUnitId: gridUnitId,
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

    async reinitializeGXSession(host, port, vebusUnitId, batteryUnitId, gridUnitId, refreshInterval) {
        await this.destroyGXSession();
        await this.setupGXSession(host, port, vebusUnitId, batteryUnitId, gridUnitId, refreshInterval);
    }

    async registerFlowTokens() {
        this.logMessage('Registering flow tokens');
        this.loadsPowerL1 = await this.homey.flow.createToken(`${this.getData().id}.loadsPowerL1`, {
            type: 'number',
            title: `${this.getName()} Loads Power L1`
        });
        this.loadsPowerL2 = await this.homey.flow.createToken(`${this.getData().id}.loadsPowerL2`, {
            type: 'number',
            title: `${this.getName()} Loads Power L2`
        });
        this.loadsPowerL3 = await this.homey.flow.createToken(`${this.getData().id}.loadsPowerL3`, {
            type: 'number',
            title: `${this.getName()} Loads Power L3`
        });
    }

    async upgradeDevice() {
        this.logMessage('Upgrading existing device');
        await this.addCapabilityHelper('measure_power.gridSetpoint');
        await this.addCapabilityHelper('measure_power.maxGridFeedin');
        await this.addCapabilityHelper('measure_power.maxDischarge');
        await this.addCapabilityHelper('measure_current.maxCharge');
        await this.addCapabilityHelper('meter_power');
        await this.addCapabilityHelper('meter_power.export');

        // v1.1.4 switched to Homey built in battery capability
        await this.addCapabilityHelper('measure_battery');
        await this.removeCapabilityHelper('battery_capacity');
    }

    async removeCapabilityHelper(capability) {
        if (this.hasCapability(capability)) {
            try {
                this.logMessage(`Remove existing capability '${capability}'`);
                await this.removeCapability(capability);
            } catch (reason) {
                this.error(`Failed to removed capability '${capability}'`);
                this.error(reason);
            }
        }
    }
    async addCapabilityHelper(capability) {
        if (!this.hasCapability(capability)) {
            try {
                this.logMessage(`Adding missing capability '${capability}'`);
                await this.addCapability(capability);
            } catch (reason) {
                this.error(`Failed to add capability '${capability}'`);
                this.error(reason);
            }
        }
    }

    updateSetting(key, value) {
        let obj = {};
        obj[key] = String(value);
        this.setSettings(obj)
            .catch(err => {
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
                    warningArr.push(GX[key].comment);
                } else if (message[key] == 2) {
                    //We have an alarm
                    alarmArr.push(GX[key].comment);
                }
            }
        });

        let alarmMsg = 'Ok'
        if (alarmArr.length > 0) {
            alarmMsg = alarmArr.join(', ');
        }

        let warningMsg = 'Ok'
        if (warningArr.length > 0) {
            warningMsg = warningArr.join(', ');
        }

        this.setSettings({
            vebusAlarms: alarmMsg,
            vebusWarnings: warningMsg
        }).catch(err => {
            this.error(`Failed to update alarm status settings`, err);
        });

        let status = 'Ok';
        if (alarmArr.length > 0) {
            status = 'Alarm';
        } else if (warningArr.length > 0) {
            status = 'Warning';
        }

        return status;
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
            self.updateSetting('vrmId', message.vrmId);
        });

        self.api.on('readings', message => {

            let previousReadings = self.getStoreValue('previousReadings');
            if (previousReadings == null) {
                self.log('Previous readings is null');
                previousReadings = {};
            }

            //Update flow tokens with power by phase for consumption/loads
            self.loadsPowerL1.setValue(message.consumptionL1 || 0);
            self.loadsPowerL2.setValue(message.consumptionL2 || 0);
            self.loadsPowerL3.setValue(message.consumptionL3 || 0);

            const grid = message.gridL1 + message.gridL2 + message.gridL3;
            const genset = message.gensetL1 + message.gensetL2 + message.gensetL3;
            let pvPower = message.acPVInputL1 + message.acPVInputL2 + message.acPVInputL3;
            pvPower += message.acPVOutputL1 + message.acPVOutputL2 + message.acPVOutputL3;
            pvPower += message.dcPV;

            //Calculate self consumption
            const consumption = pvPower - message.batteryPower + grid + genset;
            self._updateProperty('measure_power', consumption);
            self._updateProperty('measure_power.grid', grid);
            self._updateProperty('measure_power.PV', pvPower);
            self._updateProperty('measure_power.battery', message.batteryPower);
            self._updateProperty('measure_power.genset', genset);

            self._updateProperty('input_source', enums.decodeInputPowerSource(message.activeInputSource));
            self._updateProperty('vebus_status', enums.decodeVEBusStatus(message.veBusStatus));
            const alarmStatus = self.handleAlarmStatuses(message);
            self._updateProperty('alarm_status', alarmStatus);
            self._updateProperty('battery_status', enums.decodeBatteryStatus(message.batteryStatus));
            self._updateProperty('measure_battery', message.batterySOC);
            self._updateProperty('measure_voltage.battery', message.batteryVoltage);
            self._updateProperty('measure_current.battery', message.batteryCurrent);
            self._updateProperty('switch_position', enums.decodeSwitchPosition(message.switchPosition));

            self._updateProperty('measure_power.gridSetpoint', message.gridSetpointPower);
            self._updateProperty('measure_power.maxGridFeedin', message.maxGridFeedinPower);
            self._updateProperty('measure_power.maxDischarge', message.maxDischargePower);
            self._updateProperty('measure_current.maxCharge', message.maxChargeCurrent);

            self._updateProperty('meter_power', message.totalEnergyForward || 0);
            self._updateProperty('meter_power.export', message.totalEnergyReverse || 0);

            let tSinceLastFullCharge = '';
            if (message.timeSinceLastFullCharge) {
                tSinceLastFullCharge = `${message.timeSinceLastFullCharge}s`;
            }

            self.setSettings({
                minimumSOC: `${message.minimumSOC}%`,
                timeSinceLastFullCharge: tSinceLastFullCharge,
                essMode: enums.decodeESSState(message.essMode)
            }).catch(err => {
                self.error(`Failed to update settings`, err);
            });

            self.adjustChargeCurrent(message.batterySOC, message.maxChargeCurrent);

            //let efficiency = self.calculateEfficiency(message.batteryStatus, message);

            //Store a copy of the json
            self.setStoreValue('previousReadings', message);
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

                        if (key == 'input_source') {
                            const tokens = {
                                source: value
                            }
                            self._input_source_changed.trigger(self, tokens, {}).catch(error => { self.error(error) });

                        } else if (key == 'battery_status') {
                            const tokens = {
                                status: value
                            }
                            self._battery_status_changed.trigger(self, tokens, {}).catch(error => { self.error(error) });

                        } else if (key == 'vebus_status') {
                            const tokens = {
                                status: value
                            }
                            self._vebus_status_changed.trigger(self, tokens, {}).catch(error => { self.error(error) });

                        } else if (key == 'measure_battery') {
                            const tokens = {
                                soc: value
                            }
                            self._soc_changed.trigger(self, tokens, {}).catch(error => { self.error(error) });

                        } else if (key == 'alarm_status') {
                            const tokens = {
                                status: value,
                                alarms: self.getSetting('vebusAlarms'),
                                warnings: self.getSetting('vebusWarnings')
                            }
                            self._alarm_status_changed.trigger(self, tokens, {}).catch(error => { self.error(error) });

                        } else if (key == 'switch_position') {
                            const tokens = {
                                mode: value
                            }
                            self._switch_position_changed.trigger(self, tokens, {}).catch(error => { self.error(error) });

                        } else if (key == 'measure_voltage.battery') {
                            const tokens = {
                                voltage: value
                            }
                            self._battery_voltage_changed.trigger(self, tokens, {}).catch(error => { self.error(error) });

                        } else if (key == 'measure_power.grid') {
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
        this.api.disconnect();
        this.api = null;
    }

    async onSettings({ oldSettings, newSettings, changedKeys }) {
        let changeConn = false;
        let host, port, vebusUnitId, batteryUnitId, gridUnitId, refreshInterval;
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

        if (changedKeys.indexOf("modbus_grid_unitId") > -1) {
            this.logMessage(`Modbus UnitId for grid value was change to: '${newSettings.modbus_grid_unitId}'`);
            gridUnitId = newSettings.modbus_grid_unitId;
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
                gridUnitId || this.getSettings().modbus_grid_unitId,
                refreshInterval || this.getSettings().refreshInterval
            );
        }
    }

    logMessage(message) {
        this.log(`[${this.getName()}] ${message}`);
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

module.exports = GXDevice;
