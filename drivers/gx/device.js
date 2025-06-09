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

        await this.addCapabilityHelper('measure_power.gridSetpoint');
        await this.addCapabilityHelper('measure_power.maxGridFeedin');
        await this.addCapabilityHelper('measure_power.maxDischarge');
        await this.addCapabilityHelper('measure_current.maxCharge');
        await this.addCapabilityHelper('measure_current.importPeakshaving');
        await this.addCapabilityHelper('dynamic_ess_mode');
    }

    async handleAlarmStatuses(message) {
        const { alarms, warnings } = this._extractAlarmData(message);

        const alarmMsg = alarms.length > 0 ? alarms.join(', ') : 'Ok';
        const warningMsg = warnings.length > 0 ? warnings.join(', ') : 'Ok';

        await this._updateAlarmSettings(alarmMsg, warningMsg);

        return this._determineAlarmStatus(alarms, warnings);
    }

    _extractAlarmData(message) {
        const alarms = [];
        const warnings = [];

        Object.entries(message)
            .filter(([key]) => key.startsWith('alarm'))
            .forEach(([key, value]) => {
                const comment = GX[key]?.comment;
                if (!comment) return;

                if (value === 1) {
                    warnings.push(comment);
                } else if (value === 2) {
                    alarms.push(comment);
                }
            });

        return { alarms, warnings };
    }

    async _updateAlarmSettings(alarmMsg, warningMsg) {
        try {
            await this.setSettings({
                vebusAlarms: alarmMsg,
                vebusWarnings: warningMsg
            });
        } catch (error) {
            this.error('Failed to update alarm status settings:', error);
        }
    }

    _determineAlarmStatus(alarms, warnings) {
        if (alarms.length > 0) return 'Alarm';
        if (warnings.length > 0) return 'Warning';
        return 'Ok';
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
        this.api.on('properties', this._handlePropertiesEvent.bind(this));
        this.api.on('readings', this._handleReadingsEvent.bind(this));
        this.api.on('error', this._handleErrorEvent.bind(this));
    }

    _handlePropertiesEvent(message) {
        // Reserved for future property updates
        // this.updateSetting('vrmId', message.vrmId);
    }

    async _handleReadingsEvent(message) {
        try {
            this._initializePreviousReadings();
            await this._updateFlowTokens(message);
            await this._updatePowerMeasurements(message);
            await this._updateStatusProperties(message);
            await this._updateControlProperties(message);
            await this._updateDeviceSettings(message);
            await this.adjustChargeCurrent(message.batterySOC, message.maxChargeCurrent);
            this.setStoreValue('previousReadings', message);
        } catch (error) {
            this.error('Failed to process readings event:', error);
        }
    }

    _initializePreviousReadings() {
        let previousReadings = this.getStoreValue('previousReadings');
        if (previousReadings === null) {
            this.log('Previous readings is null');
            this.setStoreValue('previousReadings', {});
        }
    }

    async _updateFlowTokens(message) {
        // Update flow tokens with power by phase for consumption/loads
        this.loadsPowerL1.setValue(message.consumptionL1 || 0);
        this.loadsPowerL2.setValue(message.consumptionL2 || 0);
        this.loadsPowerL3.setValue(message.consumptionL3 || 0);
    }

    async _updatePowerMeasurements(message) {
        // Calculate power by phase for grid, genset and PV
        const grid = message.gridL1 + message.gridL2 + message.gridL3;
        const genset = message.gensetL1 + message.gensetL2 + message.gensetL3;
        const pvPower = this._calculatePVPower(message);

        // Calculate self consumption
        const consumption = pvPower - message.batteryPower + grid + genset;

        await Promise.all([
            this._updateProperty('measure_power', consumption),
            this._updateProperty('measure_power.grid', grid),
            this._updateProperty('measure_power.PV', pvPower),
            this._updateProperty('measure_power.battery', message.batteryPower),
            this._updateProperty('measure_power.genset', genset)
        ]);
    }

    _calculatePVPower(message) {
        let pvPower = message.acPVInputL1 + message.acPVInputL2 + message.acPVInputL3;
        pvPower += message.acPVOutputL1 + message.acPVOutputL2 + message.acPVOutputL3;
        pvPower += message.dcPV;
        return pvPower;
    }

    async _updateStatusProperties(message) {
        const alarmStatus = await this.handleAlarmStatuses(message);

        await Promise.all([
            this._updateProperty('input_source', enums.decodeInputPowerSource(message.activeInputSource)),
            this._updateProperty('vebus_status', enums.decodeVEBusStatus(message.veBusStatus)),
            this._updateProperty('alarm_status', alarmStatus),
            this._updateProperty('switch_position', enums.decodeSwitchPosition(message.switchPosition))
        ]);
    }

    async _updateControlProperties(message) {
        await Promise.all([
            this._updateProperty('measure_power.gridSetpoint', message.gridSetpointPower),
            this._updateProperty('measure_power.maxGridFeedin', message.maxGridFeedinPower),
            this._updateProperty('measure_power.maxDischarge', message.maxDischargePower),
            this._updateProperty('measure_current.maxCharge', message.maxChargeCurrent),
            this._updateProperty('measure_current.importPeakshaving', message.importPeakshavingCurrent),
            this._updateProperty('dynamic_ess_mode', enums.decodeDynamicESSMode(message.dynamicESSMode))
        ]);
    }

    async _updateDeviceSettings(message) {
        try {
            await this.setSettings({
                vrmId: message.vrmId,
                minimumSOC: `${message.minimumSOC}%`,
                essMode: enums.decodeESSState(message.essMode)
            });
        } catch (error) {
            this.error('Failed to update device settings:', error);
        }
    }

    async _handlePropertyTriggers(key, value) {
        const triggerMap = {
            'input_source': () => this.driver.triggerInputSourceChanged(this, { source: value }),
            'vebus_status': () => this.driver.triggerVebusStatusChanged(this, { status: value }),
            'alarm_status': () => this.driver.triggerAlarmStatusChanged(this, {
                status: value,
                alarms: this.getSetting('vebusAlarms'),
                warnings: this.getSetting('vebusWarnings')
            }),
            'switch_position': () => this.driver.triggerSwitchPositionChanged(this, { mode: value }),
            'dynamic_ess_mode': () => this.driver.triggerDynamicESSModeChanged(this, { mode: value })
        };

        const triggerFunction = triggerMap[key];
        if (triggerFunction) {
            try {
                await triggerFunction();
            } catch (error) {
                this.error(`Failed to trigger flow for ${key}:`, error);
            }
        }
    }

}

module.exports = GXDevice;
