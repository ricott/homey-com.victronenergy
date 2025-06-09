'use strict';

const VehicleCharger = require('../../lib/devices/vehicleCharger.js');
const BaseDevice = require('../baseDevice.js');
const enums = require('../../lib/enums.js');

const deviceClass = 'evcharger';

class EvChargerDevice extends BaseDevice {

    async onInit() {
        await this.upgradeDevice();
        await this.setupCapabilityListeners();
        await super.onInit();
    }

    async upgradeDevice() {
        this.logMessage('Upgrading existing device');

        // Change device class to evcharger if not already
        if (this.getClass() !== deviceClass) {
            this.logMessage(`Changing device class to ${deviceClass}`);
            await this.setClass(deviceClass);
        }

        // Homey v12.4.5+ mandatory EV charger capabilities
        await this.addCapabilityHelper('evcharger_charging');
        await this.addCapabilityHelper('evcharger_charging_state');
        await this.removeCapabilityHelper('onoff');
    }

    async setupGXSession(host, port, modbus_unitId, refreshInterval) {
        this.api = new VehicleCharger({
            host: host,
            port: port,
            modbus_unitId: modbus_unitId,
            refreshInterval: refreshInterval,
            device: this
        });

        await this.api.initialize();
        await this._initializeEventListeners();
    }

    async setupCapabilityListeners() {
        this.registerCapabilityListener('evcharger_charging', async (value) => {
            if (value) {
                // Start
                await this.api.startCharging()
                    .catch(reason => {
                        let defaultMsg = 'Failed to start charging!';
                        return Promise.reject(new Error(`${defaultMsg} ${reason.message}`));
                    });

            } else {
                // Stop
                await this.api.stopCharging()
                    .catch(reason => {
                        let defaultMsg = 'Failed to stop charging!';
                        return Promise.reject(new Error(`${defaultMsg} ${reason.message}`));
                    });
            }
        });
    }

    async _initializeEventListeners() {
        this.api.on('properties', this._handlePropertiesEvent.bind(this));
        this.api.on('readings', this._handleReadingsEvent.bind(this));
        this.api.on('error', this._handleErrorEvent.bind(this));
    }

    async _handlePropertiesEvent(message) {
        try {
            await this.setSettings({
                productId: String(message.productId),
                firmware: String(message.firmware),
                serial: String(message.serial),
                model: String(message.model)
            });
        } catch (error) {
            this.error('Failed to update EV charger properties settings:', error);
        }
    }

    async _handleReadingsEvent(message) {
        try {
            await this._updateEvChargerProperties(message);
        } catch (error) {
            this.error('Failed to process EV charger readings event:', error);
        }
    }

    async _updateEvChargerProperties(message) {
        const statusText = enums.decodeEvChargerStatusType(message.status);
        const isCharging = statusText === enums.decodeEvChargerStatusType('Charging');

        await Promise.all([
            // EV charger specific capabilities
            this._updateProperty('evcharger_charging', isCharging),
            this._updateProperty('evcharger_charging_state', enums.decodeEnergyChargerMode(message.mode)),

            // Standard measurements
            this._updateProperty('measure_power', message.power),
            this._updateProperty('measure_current', message.current),
            this._updateProperty('measure_time', message.chargingTime),
            this._updateProperty('measure_current.max', message.maxChargeCurrent),
            this._updateProperty('meter_power', message.lifetimeEnergy),

            // Status information
            this._updateProperty('sensor_status', statusText),
            this._updateProperty('sensor_status.mode', enums.decodeEvChargerModeType(message.mode))
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
module.exports = EvChargerDevice;
