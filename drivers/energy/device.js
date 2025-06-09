'use strict';

const EnergyMeter = require('../../lib/devices/energyMeter.js');
const BaseDevice = require('../baseDevice.js');
const minGridSuplusPower = 300;

class EnergyMeterDevice extends BaseDevice {

    async onInit() {
        await super.onInit();
        await this.setStoreValue('grid_surplus', 0);
    }

    async _handlePropertyTriggers(key, value) {
        if (key === 'measure_power') {
            await this._handleGridSurplusChange(value);
        }
    }

    async _handleGridSurplusChange(powerValue) {
        const surplusPower = powerValue < 0 ? Math.abs(powerValue) : 0;
        const currentSurplus = this.getStoreValue('grid_surplus');

        if (currentSurplus !== surplusPower) {
            // Filter out false positives when surplus is bouncing (e.g., grid setpoint is set to 0)
            if (surplusPower === 0 || surplusPower > minGridSuplusPower) {
                this.setStoreValue('grid_surplus', surplusPower);

                const tokens = {
                    power: surplusPower,
                    single_phase: Math.round(surplusPower / 230),
                    three_phase: Math.round(surplusPower / 3 / 230)
                };

                try {
                    await this.driver.triggerGridSurplusChanged(this, tokens);
                } catch (error) {
                    this.error('Failed to trigger grid surplus changed:', error);
                }
            }
        }
    }

    async setupGXSession(host, port, modbus_unitId, refreshInterval) {
        this.api = new EnergyMeter({
            host: host,
            port: port,
            modbus_unitId: modbus_unitId,
            refreshInterval: refreshInterval,
            device: this
        });

        await this.api.initialize();
        await this._initializeEventListeners();
    }

    async _initializeEventListeners() {
        this.api.on('properties', this._handlePropertiesEvent.bind(this));
        this.api.on('readings', this._handleReadingsEvent.bind(this));
        this.api.on('error', this._handleErrorEvent.bind(this));
    }

    _handlePropertiesEvent(message) {
        this.updateSetting('serial', message.serial);
    }

    async _handleReadingsEvent(message) {
        try {
            await this._updateEnergyMeterProperties(message);
        } catch (error) {
            this.error('Failed to process energy meter readings event:', error);
        }
    }

    async _updateEnergyMeterProperties(message) {
        const totalPower = message.powerL1 + message.powerL2 + message.powerL3;

        await Promise.all([
            // Total power measurement
            this._updateProperty('measure_power', totalPower),

            // Phase L1 measurements
            this._updateProperty('measure_power.L1', message.powerL1 || 0),
            this._updateProperty('measure_current.L1', message.currentL1 || 0),
            this._updateProperty('measure_voltage.L1', message.voltageL1 ? Math.round(message.voltageL1) : 0),

            // Phase L2 measurements
            this._updateProperty('measure_power.L2', message.powerL2 || 0),
            this._updateProperty('measure_current.L2', message.currentL2 || 0),
            this._updateProperty('measure_voltage.L2', message.voltageL2 ? Math.round(message.voltageL2) : 0),

            // Phase L3 measurements
            this._updateProperty('measure_power.L3', message.powerL3 || 0),
            this._updateProperty('measure_current.L3', message.currentL3 || 0),
            this._updateProperty('measure_voltage.L3', message.voltageL3 ? Math.round(message.voltageL3) : 0),

            // Energy meters
            this._updateProperty('meter_power', message.lifeTimeImport || 0),
            this._updateProperty('meter_power.export', message.lifeTimeExport || 0)
        ]);
    }

}
module.exports = EnergyMeterDevice;
