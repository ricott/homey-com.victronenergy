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
        this.refreshForecast();

        this._initilializeTimers();
    }

    refreshForecast() {
        let self = this;
        const vrm = new VRM();

        vrm.getPVForecastRestOfToday(this.getToken(), this.getData().id)
            .then(function (forecast) {
                if (!isNaN(forecast)) {
                    self._updateProperty('measure_pv_forecast_today', (forecast / 1000));
                }
            })
            .catch(reason => {
                self.logError(reason);
            });

        vrm.getPVForecastNextDay(this.getToken(), this.getData().id)
            .then(function (forecast) {
                if (!isNaN(forecast)) {
                    self._updateProperty('measure_pv_forecast_tomorrow', (forecast / 1000));
                }
            })
            .catch(reason => {
                self.logError(reason);
            });

        vrm.getConsumptionForecastRestOfToday(this.getToken(), this.getData().id)
            .then(function (forecast) {
                if (!isNaN(forecast)) {
                    self._updateProperty('measure_consumption_forecast_today', (forecast / 1000));
                }
            })
            .catch(reason => {
                self.logError(reason);
            });

        vrm.getConsumptionForecastNextDay(this.getToken(), this.getData().id)
            .then(function (forecast) {
                if (!isNaN(forecast)) {
                    self._updateProperty('measure_consumption_forecast_tomorrow', (forecast / 1000));
                }
            })
            .catch(reason => {
                self.logError(reason);
            });
    }

    async refreshToken() {
        this.logMessage('Generating new token');
        try {
            const vrm = new VRM();
            const response = await vrm.login(this.getUsername(), this.getPassword());
            this.setToken(response.token);
            // If we successfully get a token, make sure device is available and clear any retry timer
            await this.setAvailable();
            if (this._mfaRetryTimeout) {
                this.homey.clearTimeout(this._mfaRetryTimeout);
                this._mfaRetryTimeout = null;
            }

        } catch (reason) {
            this.logError(reason);

            // Check if error is MFA related
            if (reason.message && reason.message.includes('MFA enabled')) {
                this.logMessage('MFA is enabled - setting device unavailable');
                await this.setUnavailable('Multi-Factor Authentication is enabled on this VRM account. Please disable MFA or create a separate VRM account without MFA.');

                // Schedule retry in 10 minutes
                this.homey.clearTimeout(this._mfaRetryTimeout);
                this._mfaRetryTimeout = this.homey.setTimeout(async () => {
                    this.logMessage('Retrying login after MFA error...');
                    await this.refreshToken();
                }, 10 * 60 * 1000); // 10 minutes
            }
        }
    }

    _initilializeTimers() {
        this.logMessage('Adding timers');
        // Refresh forecasts
        this.homey.setInterval(() => {
            this.refreshForecast();
        }, 60 * 1000 * 30);

        // Refresh token, once per week (only if device is available)
        this.homey.setInterval(async () => {
            if (this.getAvailable()) {
                await this.refreshToken();
            }
        }, 60 * 1000 * 60 * 24 * 7);
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
        let obj = {};
        if (typeof value === 'string' || value instanceof String) {
            obj[key] = value;
        } else {
            //If not of type string then make it string
            obj[key] = String(value);
        }

        this.setSettings(obj).catch(err => {
            this.error(`Failed to update setting '${key}' with value '${value}'`, err);
        });
    }

    logError(error) {
        this.error(error);
        let message = '';
        if (utilFunctions.isError(error)) {
            message = error.stack;
        } else {
            try {
                message = JSON.stringify(error, null, "  ");
            } catch (e) {
                this.error('Failed to stringify object', e);
                message = error.toString();
            }
        }
        let dateTime = new Date().toISOString();
        this.updateSetting('last_error', dateTime + '\n' + message);
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

    _updateProperty(key, value) {
        let self = this;
        if (self.hasCapability(key)) {
            if (typeof value !== 'undefined' && value !== null) {
                let oldValue = self.getCapabilityValue(key);
                if (oldValue !== null && oldValue != value) {

                    self.setCapabilityValue(key, value)
                        .then(function () {

                            // if (key === 'charger_status') {
                            //     let tokens = {
                            //         status: value
                            //     }
                            //     // New trigger uses state
                            //     self._charger_status_changedv2.trigger(self, {}, tokens).catch(error => { self.error(error) });
                            // }

                        }).catch(reason => {
                            self.logError(reason);
                        });
                } else {
                    self.setCapabilityValue(key, value)
                        .catch(reason => {
                            self.logError(reason);
                        });
                }

            } else {
                self.logMessage(`Value for capability '${key}' is 'undefined'`);
            }
        } else {
            self.logMessage(`Trying to set value for missing capability '${key}'`);
        }
    }

    onDeleted() {
        this.log(`Deleting VRM device '${this.getName()}' from Homey.`);

        // Clear any pending MFA retry timer
        if (this._mfaRetryTimeout) {
            this.homey.clearTimeout(this._mfaRetryTimeout);
        }

        this.homey.settings.unset(`${this.getData().id}.username`);
        this.homey.settings.unset(`${this.getData().id}.password`);
    }

    logMessage(message) {
        this.log(`[${this.getName()}] ${message}`);
    }

    #sleep(time) {
        return new Promise((resolve) => this.homey.setTimeout(resolve, time));
    }

    #isInt(value) {
        return !isNaN(value) && (function (x) { return (x | 0) === x; })(parseFloat(value))
    }
}
module.exports = VRMDevice;
