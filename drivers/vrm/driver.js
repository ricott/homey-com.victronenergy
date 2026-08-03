'use strict';
const Homey = require('homey');
const VRM = require('../../lib/devices/vrm.js');

class VRMDriver extends Homey.Driver {

    async onPair(session) {
        const vrm = new VRM();
        let devices = [];
        let accessTokenCredentials = null;
        let userId = null;

        // Preferred path: the user pastes a personal access token created in the
        // VRM Portal. This works for accounts where Victron has deprecated
        // email/password login (Victron OneID) and skips MFA entirely.
        session.setHandler('login_token', async (data) => {
            const token = String(data?.access_token || '').trim();
            if (!token) {
                throw new Error('An access token is mandatory!');
            }

            const user = await this.validateAccessToken(vrm, token);
            userId = user.userId;
            accessTokenCredentials = {
                token: token,
                type: VRM.AUTH_ACCESS_TOKEN,
                // Token is owned by the user, not created by us, so we must never revoke it.
                idAccessToken: null,
                name: null
            };

            try {
                session.nextView();
            } catch (error) {
                this.error('Error:', error);
            }

            return true;
        });

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

            return true;
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

    /**
     * Verifies a user supplied personal access token against /v2/users/me and
     * translates the raw API failure into something a user can act on.
     */
    async validateAccessToken(vrm, token) {
        try {
            return await vrm.getCurrentUser({ token, type: VRM.AUTH_ACCESS_TOKEN });
        } catch (error) {
            const message = error.message || '';
            if (message.includes('401') || message.includes('Unauthorized') || message.includes('invalid_token')) {
                throw new Error('VRM rejected this access token. Copy it again from the VRM Portal (Preferences -> Integrations -> Access tokens); the token is only shown once, right after you create it.');
            }
            throw error;
        }
    }

    async onRepair(session, device) {
        const vrm = new VRM();

        session.setHandler('repair_token', async (data) => {
            const token = String(data?.access_token || '').trim();
            if (!token) {
                throw new Error('An access token is mandatory!');
            }

            try {
                await this.validateAccessToken(vrm, token);

                // Revoke the token we minted previously, using the new token, so the
                // old one doesn't linger in the account. Best effort only.
                const previousIdAccessToken = device.getStoreValue('idAccessToken');
                const userId = device.getData().userId;
                if (previousIdAccessToken && userId) {
                    try {
                        await vrm.deleteAccessToken({ token, type: VRM.AUTH_ACCESS_TOKEN }, userId, previousIdAccessToken);
                    } catch (revokeError) {
                        this.log(`Failed to revoke previous access token (continuing): ${revokeError.message || revokeError}`);
                    }
                }

                await device.setStoreValue('token', token);
                await device.setStoreValue('tokenType', VRM.AUTH_ACCESS_TOKEN);
                await device.setStoreValue('idAccessToken', null);
                await device.setStoreValue('accessTokenName', null);

                await device.setAvailable();
                await device.setSettings({ last_error: '' });
                try {
                    await device.unsetWarning();
                } catch (_) { /* unsetWarning may not be available */ }

                this.log(`Access token stored successfully for device: ${device.getName()}`);

                return true;
            } catch (error) {
                this.error('Repair failed:', error);
                throw new Error(error.message || 'Failed to store the access token.');
            }
        });

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
                if (credentialsToStore.type === VRM.AUTH_ACCESS_TOKEN) {
                    try {
                        await device.unsetWarning();
                    } catch (_) { /* unsetWarning may not be available */ }
                }

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
