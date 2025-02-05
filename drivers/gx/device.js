'use strict';

const VictronGX = require('../../lib/devices/victronGX.js');
const { GX } = require('../../lib/modbus/registry/gx.js');
const enums = require('../../lib/enums.js');
const utilFunctions = require('../../lib/util.js');
const BaseDevice = require('../baseDevice.js');

class GXDevice extends BaseDevice {

    async onInit() {

        await this.upgradeDevice();
        await super.onInit();

        this._switch_position_changed = this.homey.flow.getDeviceTriggerCard('switch_position_changed');
        this._vebus_status_changed = this.homey.flow.getDeviceTriggerCard('vebus_status_changed');
        this._alarm_status_changed = this.homey.flow.getDeviceTriggerCard('alarm_status_changed');
        this._input_source_changed = this.homey.flow.getDeviceTriggerCard('input_source_changed');
        
        this.logMessage(`Control charge current: ${this.getSettings().controlChargeCurrent}`);

        await this.registerFlowTokens();
    }

    async setupGXSession(host, port, modbus_unitId, refreshInterval) {
        this.api = new VictronGX({
            host: host,
            port: port,
            modbus_unitId: modbus_unitId,
            refreshInterval: refreshInterval,
            device: this
        });

        await this.api.initialize();
        await this._initializeEventListeners();
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

        if (!this.getSettings().modbus_unitId || this.getSettings().modbus_unitId == -1) {
            this.getSettings().modbus_unitId = this.getSettings().modbus_vebus_unitId;
        }

        // Big refactoring, removed lots of capabilities that now goes into their own devices
        await this.removeCapabilityHelper('battery_status');
        await this.removeCapabilityHelper('measure_battery');
        await this.removeCapabilityHelper('battery_capacity');
        await this.removeCapabilityHelper('measure_voltage.battery');
        await this.removeCapabilityHelper('measure_current.battery');
        await this.removeCapabilityHelper('meter_power');
        await this.removeCapabilityHelper('meter_power.export');
        // await this.removeCapabilityHelper('measure_power.grid');
        // await this.removeCapabilityHelper('measure_power.PV');
        // await this.removeCapabilityHelper('measure_power.battery');
        // await this.removeCapabilityHelper('measure_power.genset');

        await this.addCapabilityHelper('measure_power.gridSetpoint');
        await this.addCapabilityHelper('measure_power.maxGridFeedin');
        await this.addCapabilityHelper('measure_power.maxDischarge');
        await this.addCapabilityHelper('measure_current.maxCharge');
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

    async _initializeEventListeners() {
        let self = this;

        self.api.on('properties', message => {
            // self.updateSetting('vrmId', message.vrmId);
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

            // Calculate power by phase for grid, genset and PV
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
            self._updateProperty('switch_position', enums.decodeSwitchPosition(message.switchPosition));

            self._updateProperty('measure_power.gridSetpoint', message.gridSetpointPower);
            self._updateProperty('measure_power.maxGridFeedin', message.maxGridFeedinPower);
            self._updateProperty('measure_power.maxDischarge', message.maxDischargePower);
            self._updateProperty('measure_current.maxCharge', message.maxChargeCurrent);

            self.setSettings({
                vrmId: message.vrmId,
                minimumSOC: `${message.minimumSOC}%`,
                essMode: enums.decodeESSState(message.essMode)
            }).catch(err => {
                self.error(`Failed to update settings`, err);
            });

            self.adjustChargeCurrent(message.batterySOC, message.maxChargeCurrent);

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

                        } else if (key == 'vebus_status') {
                            const tokens = {
                                status: value
                            }
                            self._vebus_status_changed.trigger(self, tokens, {}).catch(error => { self.error(error) });

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

module.exports = GXDevice;
