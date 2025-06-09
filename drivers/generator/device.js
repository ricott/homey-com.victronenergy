'use strict';

const Generator = require('../../lib/devices/generator.js');
const BaseDevice = require('../baseDevice.js');
const enums = require('../../lib/enums.js');

class GeneratorDevice extends BaseDevice {

    async setupGXSession(host, port, modbus_unitId, refreshInterval) {
        this.api = new Generator({
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
        // this.api.on('properties', this._handlePropertiesEvent.bind(this));
        this.api.on('readings', this._handleReadingsEvent.bind(this));
        this.api.on('error', this._handleErrorEvent.bind(this));
    }

    // _handlePropertiesEvent(message) {
    //     this.updateSetting('serial', message.serial);
    // }

    async _handleReadingsEvent(message) {
        try {
            await this._updateGeneratorProperties(message);
        } catch (error) {
            this.error('Failed to process generator readings event:', error);
        }
    }

    async _updateGeneratorProperties(message) {
        const gensetPower = message.gensetL1 + message.gensetL2 + message.gensetL3;

        await Promise.all([
            this._updateProperty('sensor_status', enums.decodeGenSetState(message.state)),
            this._updateProperty('measure_power.genset', gensetPower)
        ]);
    }
}
module.exports = GeneratorDevice;