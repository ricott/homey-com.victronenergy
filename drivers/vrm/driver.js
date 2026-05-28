'use strict';
const Homey = require('homey');
const VRM = require('../../lib/devices/vrm.js');

class VRMDriver extends Homey.Driver {

    async onPair(session) {
        const vrm = new VRM();
        let devices = [];
        let accessTokenCredentials = null;
        let userId = null;

        session.setHandler('login', async (data) => {
            if (data.username == '' || data.password == '') {
                throw new Error('User name and password is mandatory!');
            }

            // 1) Log in with username/password to obtain a short-lived bearer token
            const loginResponse = await vrm.login(data.username, data.password, data.mfa_token || null);
            const bearerCredentials = { token: loginResponse.token, type: VRM.AUTH_BEARER };
            userId = loginResponse.userId;

            // 2) Mint a long-lived personal access token for use after Bearer is deprecated
            try {
                const tokenName = `Homey - ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
                const created = await vrm.createAccessToken(bearerCredentials, userId, tokenName);
                accessTokenCredentials = {
                    token: created.token,
                    type: VRM.AUTH_ACCESS_TOKEN,
                    idAccessToken: created.idAccessToken,
                    name: tokenName
                };
            } catch (error) {
                this.error('Failed to create access token, falling back to bearer:', error);
                // Fallback so existing accounts that don't yet support access tokens
                // can still pair. After June 1, 2026 this fallback will stop working.
                accessTokenCredentials = bearerCredentials;
            }

            try {
                session.nextView();
            } catch (error) {
                this.error('Error:', error);
            }
        });

        session.setHandler('list_devices', async (data) => {
            const installations = await vrm.getInstallations(accessTokenCredentials, userId);
            installations.forEach(installation => {
                devices.push({
                    name: installation.name,
                    data: {
                        id: installation.idSite,
                        userId: userId
                    },
                    store: {
                        token: accessTokenCredentials.token,
                        tokenType: accessTokenCredentials.type,
                        idAccessToken: accessTokenCredentials.idAccessToken || null,
                        accessTokenName: accessTokenCredentials.name || null
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
                // 1) Authenticate with new credentials to get a bootstrap bearer token
                const loginResponse = await vrm.login(data.username, data.password, data.mfa_token || null);
                const bearerCredentials = { token: loginResponse.token, type: VRM.AUTH_BEARER };

                // 2) Best-effort revoke any previous access token we created for this device
                const previousIdAccessToken = device.getStoreValue('idAccessToken');
                if (previousIdAccessToken) {
                    try {
                        await vrm.deleteAccessToken(bearerCredentials, loginResponse.userId, previousIdAccessToken);
                    } catch (revokeError) {
                        this.log(`Failed to revoke previous access token (continuing): ${revokeError.message || revokeError}`);
                    }
                }

                // 3) Mint a fresh access token
                const tokenName = `Homey - ${device.getName()} - ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
                let credentialsToStore;
                try {
                    const created = await vrm.createAccessToken(bearerCredentials, loginResponse.userId, tokenName);
                    credentialsToStore = {
                        token: created.token,
                        type: VRM.AUTH_ACCESS_TOKEN,
                        idAccessToken: created.idAccessToken,
                        name: tokenName
                    };
                } catch (createError) {
                    this.error('Failed to create access token during repair, falling back to bearer:', createError);
                    credentialsToStore = bearerCredentials;
                }

                // 4) Persist on the device
                await device.setStoreValue('token', credentialsToStore.token);
                await device.setStoreValue('tokenType', credentialsToStore.type);
                await device.setStoreValue('idAccessToken', credentialsToStore.idAccessToken || null);
                await device.setStoreValue('accessTokenName', credentialsToStore.name || null);

                // 5) Mark the device as available again and clear errors
                await device.setAvailable();
                await device.setSettings({ last_error: '' });

                this.log(`Token refreshed successfully for device: ${device.getName()} (type: ${credentialsToStore.type})`);

                return true;
            } catch (error) {
                this.error('Repair failed:', error);
                throw new Error(error.message || 'Failed to re-authenticate. Please check your credentials.');
            }
        });
    }
}
module.exports = VRMDriver;
