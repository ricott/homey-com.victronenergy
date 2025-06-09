'use strict';

const TankSensor = require('../../lib/devices/tankSensor.js');
const enums = require('../../lib/enums.js');
const BaseDevice = require('../baseDevice.js');

class TankDevice extends BaseDevice {

    async setupGXSession(host, port, modbus_unitId, refreshInterval) {
        this.api = new TankSensor({
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
        this.updateSetting('type', enums.decodeTankFluidType(message.type));
    }

    async _handleReadingsEvent(message) {
        try {
            await this._updateTankProperties(message);
        } catch (error) {
            this.error('Failed to process tank readings event:', error);
        }
    }

    async _updateTankProperties(message) {
        await Promise.all([
            this._updateProperty('measure_tank_level', message.level),
            this._updateProperty('sensor_status', enums.decodeSensorStatus(message.status))
        ]);
    }

    async _handlePropertyTriggers(key, value) {
        const triggerMap = {
            'sensor_status': () => this.driver.triggerSensorStatusChanged(this, { status: value }),
            'measure_tank_level': () => this.driver.triggerTankLevelChanged(this, { level: value })
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
module.exports = TankDevice;
