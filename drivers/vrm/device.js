'use strict';
const Homey = require('homey');
const VRM = require('../../lib/devices/vrm.js');
const utilFunctions = require('../../lib/util.js');

const deviceClass = 'service';

class VRMDevice extends Homey.Device {

    async onInit() {
        this.logMessage(`VRM device initiated`);

        // Change device class to service if not already
        if (this.getClass() !== deviceClass) {
            await this.setClass(deviceClass);
        }

        await this.setupCapabilities();

        //App was restarted, Zero out last error field
        this.updateSetting('last_error', '');

        await this.refreshForecast();

        this._initializeTimers();
    }

    async refreshForecast() {
        const vrm = new VRM();
        const token = this.getToken();
        const deviceId = this.getData().id;

        const forecastRequests = [
            { method: 'getPVForecastRestOfToday', capability: 'measure_pv_forecast_today' },
            { method: 'getPVForecastNextDay', capability: 'measure_pv_forecast_tomorrow' },
            { method: 'getConsumptionForecastRestOfToday', capability: 'measure_consumption_forecast_today' },
            { method: 'getConsumptionForecastNextDay', capability: 'measure_consumption_forecast_tomorrow' }
        ];

        // Process all forecasts concurrently
        await Promise.allSettled(
            forecastRequests.map(request => this._processForecastRequest(vrm, request, token, deviceId))
        );
    }

    async _processForecastRequest(vrm, request, token, deviceId) {
        try {
            const forecast = await vrm[request.method](token, deviceId);
            if (!isNaN(forecast)) {
                await this._updateProperty(request.capability, forecast / 1000);
            }
        } catch (error) {
            this.logError(error);
            
            // Check if error is related to unauthorized access (expired token)
            const errorMessage = error.message || '';
            if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('Invalid token')) {
                this.logMessage('Token appears to be expired or invalid - marking device as unavailable');
                await this.setUnavailable('VRM token has expired. Please use the repair function to re-authenticate.');
                this.updateSetting('last_error', 'VRM token has expired. Please use the repair function to re-authenticate.');
            }
        }
    }



    _initializeTimers() {
        this.logMessage('Adding timers');

        // Refresh forecasts every 30 minutes
        this.homey.setInterval(async () => {
            await this.refreshForecast();
        }, 30 * 60 * 1000);
    }

    getToken() {
        return this.getStoreValue('token');
    }

    setToken(token) {
        this.setStoreValue('token', token);
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

    async updateCapabilityOptions(capability, options) {
        if (this.hasCapability(capability)) {
            try {
                this.logMessage(`Updating capability options '${capability}'`);
                await this.setCapabilityOptions(capability, options);
            } catch (reason) {
                this.error(`Failed to update capability options for '${capability}'`);
                this.error(reason);
            }
        }
    }

    fetchCapabilityOptions(capability) {
        let options = {};
        if (this.hasCapability(capability)) {
            try {
                //this.logMessage(`Trying to fetch capability options for '${capability}'`);
                options = this.getCapabilityOptions(capability);
            } catch (reason) {
                this.logError(`Failed to fetch capability options for '${capability}', even if it exists!!!`);
                this.logError(reason);
            }
        }
        return options;
    }

    async setupCapabilities() {
        this.logMessage('Setting up capabilities');

        await this.addCapabilityHelper('measure_consumption_forecast_today');
        await this.addCapabilityHelper('measure_consumption_forecast_tomorrow');
    }

    updateSetting(key, value) {
        const obj = {
            [key]: typeof value === 'string' ? value : String(value)
        };

        this.setSettings(obj).catch(err => {
            this.error(`Failed to update setting '${key}' with value '${value}'`, err);
        });
    }

    logError(error) {
        this.error(error);

        const errorMessage = this._formatErrorMessage(error);
        const dateTime = new Date().toISOString();
        this.updateSetting('last_error', `${dateTime}\n${errorMessage}`);
    }

    _formatErrorMessage(error) {
        if (utilFunctions.isError(error)) {
            return error.stack;
        }

        try {
            return JSON.stringify(error, null, '  ');
        } catch (stringifyError) {
            this.error('Failed to stringify error object:', stringifyError);
            return error.toString();
        }
    }



    async _updateProperty(key, value) {
        // Check if capability exists
        if (!this.hasCapability(key)) {
            this.logMessage(`Trying to set value for missing capability '${key}'`);
            return;
        }

        // Check if value is valid
        if (typeof value === 'undefined' || value === null) {
            this.logMessage(`Value for capability '${key}' is 'undefined'`);
            return;
        }

        try {
            const oldValue = this.getCapabilityValue(key);
            await this.setCapabilityValue(key, value);

            // Trigger flows only for changed values
            if (oldValue !== null && oldValue !== value) {
                await this._handlePropertyTriggers(key, value);
            }
        } catch (error) {
            this.logError(error);
        }
    }

    async _handlePropertyTriggers(key, value) {
        // Placeholder for future VRM-specific triggers
        // Example:
        // if (key === 'measure_pv_forecast_today') {
        //     await this.driver.triggerPVForecastChanged(this, { forecast: value });
        // }
    }

    onDeleted() {
        this.log(`Deleting VRM device '${this.getName()}' from Homey.`);
    }

    logMessage(message) {
        this.log(`[${this.getName()}] ${message}`);
    }
}
module.exports = VRMDevice;
