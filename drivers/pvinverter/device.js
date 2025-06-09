'use strict';

const PVInverter = require('../../lib/devices/pvInverter.js');
const BaseDevice = require('../baseDevice.js');

class PVInverterDevice extends BaseDevice {

    async setupGXSession(host, port, modbus_unitId, refreshInterval) {
        this.api = new PVInverter({
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
            await this._updatePVInverterProperties(message);
        } catch (error) {
            this.error('Failed to process PV inverter readings event:', error);
        }
    }

    async _updatePVInverterProperties(message) {
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
            this._updateProperty('measure_voltage.L3', message.voltageL3 ? Math.round(message.voltageL3) : 0)
        ]);
    }
}
module.exports = PVInverterDevice;
