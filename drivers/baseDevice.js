'use strict';

const { Device } = require('homey');
const utilFunctions = require('../lib/util.js');

class BaseDevice extends Device {

    async onInit() {
        this.api = null;
        this.logMessage(`Victron ${this.constructor.name} device initiated`);

        await this.initializeGXSession(
            this.getSettings().address,
            this.getSettings().port,
            this.getSettings().modbus_unitId,
            this.getSettings().refreshInterval
        );
    }

    async destroyGXSession() {
        if (this.api) {
            await this.api.disconnect();
        }
    }

    async initializeGXSession(host, port, modbus_unitId, refreshInterval) {
        try {
            await this.destroyGXSession();
            await this.setupGXSession(host, port, modbus_unitId, refreshInterval);
            // Connection successful, make sure device is marked as available
            await this.setAvailable();
            // Clear any existing retry timer on successful connection
            if (this._retryTimeout) {
                this.homey.clearTimeout(this._retryTimeout);
                this._retryTimeout = null;
            }
        } catch (error) {
            this.error('Failed to initialize device connection:', error);
            // Set device as unavailable with error message
            await this.setUnavailable(error.message || 'Connection failed');

            // Clear any existing retry timer before setting a new one
            if (this._retryTimeout) {
                this.homey.clearTimeout(this._retryTimeout);
            }

            // Schedule a retry after 10 minutes
            this._retryTimeout = this.homey.setTimeout(() => {
                this.logMessage('Retrying connection...');
                this.initializeGXSession(host, port, modbus_unitId, refreshInterval)
                    .catch(err => this.error('Retry failed:', err));
            }, 10 * 60 * 1000); // 10 minutes
        }
    }

    async _updateProperty(key, value) {
        // Ignore unknown capabilities
        if (!this.hasCapability(key)) {
            return;
        }

        try {
            const changed = this.isCapabilityValueChanged(key, value);

            // Update capability value
            await this.setCapabilityValue(key, value);

            // Trigger device-specific events only for changed values
            if (changed) {
                await this._handlePropertyTriggers(key, value);
            }
        } catch (error) {
            this.error(`Failed to update property ${key}:`, error);
        }
    }

    async _handlePropertyTriggers(key, value) {
        // Placeholder method for device-specific event triggers
        // Override this method in child classes to implement custom trigger logic
        // Example:
        // if (key === 'some_capability') {
        //     await this.driver.triggerSomeEvent(this, { value });
        // }
    }

    async _handleErrorEvent(error) {
        this.error('Houston we have a problem', error);

        const errorMessage = this._formatErrorMessage(error);
        const timeString = new Date().toLocaleString('sv-SE', {
            hour12: false,
            timeZone: this.homey.clock.getTimezone()
        });

        try {
            await this.setSettings({
                last_error: `${timeString}\n${errorMessage}`
            });
        } catch (settingsError) {
            this.error('Failed to update error settings:', settingsError);
        }
    }

    _formatErrorMessage(error) {
        if (utilFunctions.isError(error)) {
            return error.stack;
        }

        try {
            return JSON.stringify(error, null, '  ');
        } catch (stringifyError) {
            this.log('Failed to stringify error object:', stringifyError);
            return 'Unknown error';
        }
    }

    isCapabilityValueChanged(key, value) {
        let oldValue = this.getCapabilityValue(key);
        //If oldValue===null then it is a newly added device, lets not trigger flows on that
        if (oldValue !== null && oldValue != value) {
            return true;
        } else {
            return false;
        }
    }

    onDeleted() {
        this.logMessage(`Victron ${this.constructor.name} device deleted`);
        // Clear any pending retry timer
        if (this._retryTimeout) {
            this.homey.clearTimeout(this._retryTimeout);
        }
        this.api.disconnect();
        this.api = null;
    }

    async onSettings({ oldSettings, newSettings, changedKeys }) {
        let changeConn = false;
        let host, port, modbus_unitId, refreshInterval;
        if (changedKeys.indexOf("address") > -1) {
            this.logMessage(`Address value was change to: '${newSettings.address}'`);
            host = newSettings.address;
            changeConn = true;
        }

        if (changedKeys.indexOf("port") > -1) {
            this.logMessage(`Port value was change to: '${newSettings.port}'`);
            port = newSettings.port;
            changeConn = true;
        }

        if (changedKeys.indexOf("modbus_unitId") > -1) {
            this.logMessage(`Modbus UnitId was change to: '${newSettings.modbus_unitId}'`);
            modbus_unitId = newSettings.modbus_unitId;
            changeConn = true;
        }

        if (changedKeys.indexOf("refreshInterval") > -1) {
            this.logMessage(`Refresh interval value was change to: '${newSettings.refreshInterval}'`);
            refreshInterval = newSettings.refreshInterval;
            changeConn = true;
        }

        if (changeConn) {
            //We need to re-initialize the GX session since setting(s) are changed
            this.initializeGXSession(
                host || this.getSettings().address,
                port || this.getSettings().port,
                modbus_unitId || this.getSettings().modbus_unitId,
                refreshInterval || this.getSettings().refreshInterval
            );
        }
    }

    updateSetting(key, value) {
        let obj = {};
        obj[key] = String(value);
        this.setSettings(obj).catch(err => {
            this.error(`Failed to update setting '${key}' with value '${value}'`, err);
        });
    }

    updateSettingIfChanged(key, newValue, oldValue) {
        if (newValue != oldValue) {
            this.updateSetting(key, newValue);
        }
    }

    updateNumericSettingIfChanged(key, newValue, oldValue, suffix) {
        if (!isNaN(newValue)) {
            this.updateSettingIfChanged(key, `${newValue}${suffix}`, `${oldValue}${suffix}`);
        }
    }

    logMessage(message) {
        this.log(`[${this.getName()}] ${message}`);
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
}

module.exports = BaseDevice;
