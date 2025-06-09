'use strict';
const Homey = require('homey');
const VRM = require('../../lib/devices/vrm.js');
const utilFunctions = require('../../lib/util.js');
const crypto = require('crypto');
const algorithm = 'aes-256-cbc';

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

        if (!this.homey.settings.get(`${this.getData().id}.username`)) {
            //This is a newly added device, lets copy login details to homey settings
            this.logMessage(`Storing credentials for user '${this.getStoreValue('username')}'`);
            this.storeCredentialsEncrypted(this.getStoreValue('username'), this.getStoreValue('password'));
        }

        await this.refreshToken();
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
        }
    }

    async refreshToken() {
        this.logMessage('Generating new token');
        try {
            const vrm = new VRM();
            const response = await vrm.login(this.getUsername(), this.getPassword());
            this.setToken(response.token);
            // If we successfully get a token, make sure device is available and clear any retry timers
            await this.setAvailable();
            this.updateSetting('last_error', '');
            if (this._mfaRetryTimeout) {
                this.homey.clearTimeout(this._mfaRetryTimeout);
                this._mfaRetryTimeout = null;
            }
            if (this._retryTimeout) {
                this.homey.clearTimeout(this._retryTimeout);
                this._retryTimeout = null;
            }

        } catch (reason) {
            this.logError(reason);
            const errorMessage = reason.message || 'Unknown error occurred';

            // Check if error is MFA related
            if (errorMessage.includes('MFA enabled')) {
                this.logMessage('MFA is enabled - setting device unavailable');
                await this.setUnavailable('Multi-Factor Authentication is enabled on this VRM account. Please disable MFA or create a separate VRM account without MFA.');
                this.updateSetting('last_error', 'MFA is enabled on your VRM account. Please disable MFA or create a separate account without MFA.');

                // Schedule retry in 10 minutes
                this.homey.clearTimeout(this._mfaRetryTimeout);
                this._mfaRetryTimeout = this.homey.setTimeout(async () => {
                    this.logMessage('Retrying login after MFA error...');
                    await this.refreshToken();
                }, 10 * 60 * 1000); // 10 minutes
            }
            // Check if error is invalid credentials
            else if (errorMessage.includes('InvalidUserPassword') || errorMessage.includes('Username or password is invalid')) {
                this.logMessage('Invalid credentials - setting device unavailable');
                await this.setUnavailable('Invalid VRM credentials. Please update your username and password in the device settings.');
                this.updateSetting('last_error', 'Invalid VRM credentials. Please update your username and password in the device settings.');
            }
            // Handle other types of errors (network issues, server errors, etc.)
            else {
                this.logMessage(`Login failed: ${errorMessage} - will retry in 5 minutes`);
                await this.setUnavailable(`Temporary login failure: ${errorMessage}`);
                this.updateSetting('last_error', `Temporary login failure: ${errorMessage}`);

                // Schedule retry in 5 minutes for temporary failures
                this.homey.clearTimeout(this._retryTimeout);
                this._retryTimeout = this.homey.setTimeout(async () => {
                    this.logMessage('Retrying login after temporary error...');
                    await this.refreshToken();
                }, 5 * 60 * 1000); // 5 minutes
            }
        }
    }

    _initializeTimers() {
        this.logMessage('Adding timers');

        // Refresh forecasts every 30 minutes
        this.homey.setInterval(async () => {
            await this.refreshForecast();
        }, 30 * 60 * 1000);

        // Refresh token once per week (only if device is available)
        this.homey.setInterval(async () => {
            if (this.getAvailable()) {
                await this.refreshToken();
            }
        }, 7 * 24 * 60 * 60 * 1000);
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

    storeCredentialsEncrypted(plainUser, plainPassword) {
        this.logMessage(`Encrypting credentials for user '${plainUser}'`);
        this.homey.settings.set(`${this.getData().id}.username`, this.encryptText(plainUser));
        this.homey.settings.set(`${this.getData().id}.password`, this.encryptText(plainPassword));

        //Remove unencrypted credentials passed from driver
        this.unsetStoreValue('username');
        this.unsetStoreValue('password');
    }

    getUsername() {
        return this.decryptText(this.homey.settings.get(`${this.getData().id}.username`));
    }

    getPassword() {
        return this.decryptText(this.homey.settings.get(`${this.getData().id}.password`));
    }

    encryptText(text) {
        let iv = crypto.randomBytes(16);
        let cipher = crypto.createCipheriv(algorithm, Buffer.from(Homey.env.ENCRYPTION_KEY), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return { iv: iv.toString('hex'), encryptedData: encrypted.toString('hex') };
    }

    decryptText(text) {
        let iv = Buffer.from(text.iv, 'hex');
        let encryptedText = Buffer.from(text.encryptedData, 'hex');
        let decipher = crypto.createDecipheriv(algorithm, Buffer.from(Homey.env.ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
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

        // Clear any pending retry timers
        if (this._mfaRetryTimeout) {
            this.homey.clearTimeout(this._mfaRetryTimeout);
        }
        if (this._retryTimeout) {
            this.homey.clearTimeout(this._retryTimeout);
        }

        this.homey.settings.unset(`${this.getData().id}.username`);
        this.homey.settings.unset(`${this.getData().id}.password`);
    }

    logMessage(message) {
        this.log(`[${this.getName()}] ${message}`);
    }
}
module.exports = VRMDevice;
