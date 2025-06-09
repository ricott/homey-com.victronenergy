'use strict';

const TempSensor = require('../../lib/devices/tempSensor.js');
const enums = require('../../lib/enums.js');
const BaseDevice = require('../baseDevice.js');

class TemperatureDevice extends BaseDevice {

    async setupGXSession(host, port, modbus_unitId, refreshInterval) {
        this.api = new TempSensor({
            host: host,
            port: port,
            modbus_unitId: modbus_unitId,
            refreshInterval: Math.max(60, refreshInterval),
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
        this.updateSetting('productId', message.productId);
        this.updateSetting('type', enums.decodeTemperatureType(message.type));
    }

    async _handleReadingsEvent(message) {
        try {
            await this._updateTemperatureSensorProperties(message);
        } catch (error) {
            this.error('Failed to process temperature sensor readings event:', error);
        }
    }

    async _updateTemperatureSensorProperties(message) {
        await Promise.all([
            this._updateProperty('measure_temperature', message.temperature || 0),
            this._updateProperty('measure_humidity', message.humidity || 0),
            this._updateProperty('measure_pressure', message.pressure || 0),
            this._updateProperty('measure_voltage', message.batteryVoltage || 0),
            this._updateProperty('sensor_status', enums.decodeSensorStatus(message.status))
        ]);
    }

    async _handlePropertyTriggers(key, value) {
        if (key === 'sensor_status') {
            try {
                await this.driver.triggerSensorStatusChanged(this, { status: value });
            } catch (error) {
                this.error('Failed to trigger sensor status changed:', error);
            }
        }
    }
}
module.exports = TemperatureDevice;
