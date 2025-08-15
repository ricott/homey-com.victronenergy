'use strict';
const Homey = require('homey');
const VRM = require('../../lib/devices/vrm.js');

class VRMDriver extends Homey.Driver {

    async onPair(session) {
        const vrm = new VRM();
        let devices = [];
        let loginResponse = null;

        session.setHandler('login', async (data) => {
            if (data.username == '' || data.password == '') {
                throw new Error('User name and password is mandatory!');
            }

            loginResponse = await vrm.login(data.username, data.password, data.mfa_token || null);

            try {
                session.nextView();
            } catch (error) {
                this.error('Error:', error);
            }
        });

        session.setHandler('list_devices', async (data) => {
            const installations = await vrm.getInstallations(loginResponse.token, loginResponse.userId);
            installations.forEach(installation => {
                devices.push({
                    name: installation.name,
                    data: {
                        id: installation.idSite,
                        userId: loginResponse.userId
                    },
                    store: {
                        token: loginResponse.token
                    }
                });
            });
            return devices;
        });
    }

    async onRepair(session, device) {
        const vrm = new VRM();

        session.setHandler('repair', async (data) => {
            if (data.username == '' || data.password == '') {
                throw new Error('User name and password is mandatory!');
            }

            try {
                // Authenticate with new credentials
                const loginResponse = await vrm.login(data.username, data.password, data.mfa_token || null);
                
                // Update the device's stored token
                await device.setStoreValue('token', loginResponse.token);
                
                // Mark the device as available again
                await device.setAvailable();
                
                // Clear any previous error messages
                await device.setSettings({ last_error: '' });
                
                this.log(`Token refreshed successfully for device: ${device.getName()}`);
                
                return true;
            } catch (error) {
                this.error('Repair failed:', error);
                throw new Error(error.message || 'Failed to re-authenticate. Please check your credentials.');
            }
        });
    }
}
module.exports = VRMDriver;
