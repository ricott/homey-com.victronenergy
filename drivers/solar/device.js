'use strict';

const SolarCharger = require('../../lib/devices/solarCharger.js');
const BaseDevice = require('../baseDevice.js');
const enums = require('../../lib/enums.js');

class SolarChargerDevice extends BaseDevice {

    async onInit() {
        await this.setupCapabilities();
        await super.onInit();
    }

    async setupGXSession(host, port, modbus_unitId, refreshInterval) {
        this.api = new SolarCharger({
            host: host,
            port: port,
            modbus_unitId: modbus_unitId,
            refreshInterval: refreshInterval,
            device: this
        });

        await this.api.initialize();
        await this._initializeEventListeners();
    }

    async setupCapabilities() {
        this.logMessage('Setting up capabilities');

        // Rename meter_power.total to meter_power
        await this.removeCapabilityHelper('meter_power.total');
        await this.addCapability('meter_power');
    }

    async _initializeEventListeners() {
        // this.api.on('properties', this._handlePropertiesEvent.bind(this));
        this.api.on('readings', this._handleReadingsEvent.bind(this));
        this.api.on('error', this._handleErrorEvent.bind(this));
    }

    // _handlePropertiesEvent(message) {
    //     this.updateSetting('serial', message.serial);
    // }

    async _handleReadingsEvent(message) {
        try {
            await this._updateSolarChargerProperties(message);
        } catch (error) {
            this.error('Failed to process solar charger readings event:', error);
        }
    }

    async _updateSolarChargerProperties(message) {
        await Promise.all([
            this._updateProperty('sensor_status', message.mode === 1 ? 'On' : 'Off'),
            this._updateProperty('vebus_status', enums.decodeVEBusStatus(message.state)),
            this._updateProperty('measure_power', message.power || 0),
            this._updateProperty('measure_current', message.current || 0),
            this._updateProperty('measure_voltage', message.voltage ? Math.round(message.voltage) : 0),
            this._updateProperty('meter_power.daily', message.dailyYield || 0),
            this._updateProperty('meter_power', message.totalYield || 0)
        ]);
    }
}
module.exports = SolarChargerDevice;
