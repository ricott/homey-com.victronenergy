'use strict';
const config = require('../const.js');

// Auth scheme used in the x-authorization header.
// Per VRM API docs, Bearer is deprecated from 2026-06-01.
const AUTH_BEARER = 'bearer';
const AUTH_ACCESS_TOKEN = 'access';

class VRM {

    async login(username, password, sms_token = null) {
        try {
            let loginData = {
                username: username,
                password: password,
                remember_me: true
            };

            // Add MFA token if provided
            if (sms_token) {
                loginData.sms_token = sms_token;
            }

            const response = await fetch(`https://${config.apiDomain}/v2/auth/login`, {
                method: 'post',
                body: JSON.stringify(loginData),
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(15000)
            });

            if (!response.ok) {
                const msg = `POST '/v2/auth/login' failed with '${response.status}' and '${response.statusText}'`;
                console.log(msg);
                return Promise.reject(new Error(msg));
            }

            const json = await response.json();
            if (json.verification_sent == true && !sms_token) {
                // MFA enabled but no token provided
                return Promise.reject(new Error('VRM account has MFA enabled. Please provide a 2FA code.'));
            }

            return Promise.resolve({
                token: json.token,
                userId: json.idUser
            });
        } catch (error) {
            if (error.name === 'AbortError') {
                return Promise.reject(new Error('Login request timed out after 15 seconds'));
            }
            throw error;
        }
    }

    getInstallations(credentials, userId) {
        return this.#makeRequest(credentials, `https://${config.apiDomain}/v2/users/${userId}/installations`, 'get')
            .then(function (response) {
                return Promise.resolve(response?.records || []);
            })
            .catch(reason => {
                return Promise.reject(reason);
            });
    }

    /**
     * Create a long-lived access token for the user. Requires a valid bootstrap
     * credential (typically the bearer token from /auth/login).
     */
    createAccessToken(credentials, userId, name) {
        return this.#makeRequest(
            credentials,
            `https://${config.apiDomain}/v2/users/${userId}/accesstokens`,
            'post',
            { name }
        ).then(response => {
            if (!response || !response.token || !response.idAccessToken) {
                return Promise.reject(new Error('Access token response missing token or idAccessToken'));
            }
            return Promise.resolve({
                token: response.token,
                idAccessToken: response.idAccessToken
            });
        }).catch(reason => Promise.reject(reason));
    }

    /**
     * Revoke an access token. Use idAccessToken='*' to revoke all tokens for the user.
     */
    deleteAccessToken(credentials, userId, idAccessToken) {
        return this.#makeRequest(
            credentials,
            `https://${config.apiDomain}/v2/users/${userId}/accesstokens/${idAccessToken}`,
            'delete'
        ).catch(reason => Promise.reject(reason));
    }

    getPVForecastRestOfToday(credentials, siteId) {

        const { startTs, endTs } = this.#getTsForRestOfToday();

        return this.#makeRequest(credentials, `https://${config.apiDomain}/v2/installations/${siteId}/stats?` + new URLSearchParams({
            'type': 'custom',
            'attributeCodes[0]': 'vrm_pv_inverter_yield_fc',
            'attributeCodes[1]': 'vrm_pv_charger_yield_fc',
            'interval': 'days',
            'start': startTs,
            'end': endTs,
        }), 'get')
            .then(function (response) {
                const ac_tied = response?.totals?.vrm_pv_inverter_yield_fc || 0;
                const dc_tied = response?.totals?.vrm_pv_charger_yield_fc || 0;
                return Promise.resolve(ac_tied + dc_tied);
            })
            .catch(reason => {
                return Promise.reject(reason);
            });
    }

    getPVForecastNextDay(credentials, siteId) {

        const { startTs, endTs } = this.#getTsForNextDay();

        return this.#makeRequest(credentials, `https://${config.apiDomain}/v2/installations/${siteId}/stats?` + new URLSearchParams({
            'type': 'custom',
            'attributeCodes[0]': 'vrm_pv_inverter_yield_fc',
            'attributeCodes[1]': 'vrm_pv_charger_yield_fc',
            'interval': 'days',
            'start': startTs,
            'end': endTs,
        }), 'get')
            .then(function (response) {
                const ac_tied = response?.totals?.vrm_pv_inverter_yield_fc || 0;
                const dc_tied = response?.totals?.vrm_pv_charger_yield_fc || 0;
                return Promise.resolve(ac_tied + dc_tied);
            })
            .catch(reason => {
                return Promise.reject(reason);
            });
    }

    getConsumptionForecastRestOfToday(credentials, siteId) {

        const { startTs, endTs } = this.#getTsForRestOfToday();

        return this.#makeRequest(credentials, `https://${config.betaApidomain}/v2/installations/${siteId}/stats?` + new URLSearchParams({
            'type': 'custom',
            'attributeCodes[]': 'vrm_consumption_fc',
            'interval': 'days',
            'start': startTs,
            'end': endTs,
        }), 'get')
            .then(function (response) {
                return Promise.resolve(response?.totals?.vrm_consumption_fc || 0);
            })
            .catch(reason => {
                return Promise.reject(reason);
            });
    }

    getConsumptionForecastNextDay(credentials, siteId) {

        const { startTs, endTs } = this.#getTsForNextDay();

        return this.#makeRequest(credentials, `https://${config.betaApidomain}/v2/installations/${siteId}/stats?` + new URLSearchParams({
            'type': 'custom',
            'attributeCodes[]': 'vrm_consumption_fc',
            'interval': 'days',
            'start': startTs,
            'end': endTs,
        }), 'get')
            .then(function (response) {
                return Promise.resolve(response?.totals?.vrm_consumption_fc || 0);
            })
            .catch(reason => {
                return Promise.reject(reason);
            });
    }

    setDynamicESSGreenMode(credentials, siteId, isGreenModeOn) {
        // The /dynamic-ess-settings endpoint expects the full DynamicEssConfiguration
        // (it has 11 required fields per the OpenAPI spec). Read current config,
        // toggle isGreenModeOn, write it back.
        const url = `https://${config.apiDomain}/v2/installations/${siteId}/dynamic-ess-settings`;
        return this.#makeRequest(credentials, url, 'get')
            .then(response => {
                const current = response?.data || response || {};
                const updated = Object.assign({}, current, { isGreenModeOn: !!isGreenModeOn });
                return this.#makeRequest(credentials, url, 'post', updated);
            })
            .catch(reason => {
                return Promise.reject(reason);
            });
    }

    #getTsForRestOfToday() {
        // Get timestamps for now, and midnight
        let date = new Date();
        const startTs = Math.floor(date.getTime() / 1000);
        date.setHours(23, 59, 59, 0);
        const endTs = Math.floor(date.getTime() / 1000);

        return {
            startTs,
            endTs
        };
    }

    #getTsForNextDay() {
        // Get timestamps for next day, 00:00 -> 23:59
        let date = new Date();
        date.setDate(date.getDate() + 1)
        date.setHours(0, 0, 0, 0);
        const startTs = Math.floor(date.getTime() / 1000);
        date.setHours(23, 59, 59, 0);
        const endTs = Math.floor(date.getTime() / 1000);

        return {
            startTs,
            endTs
        };
    }

    async #makeRequest(credentials, endpoint, method, body) {
        try {
            // credentials is either a string (treated as Bearer for backwards
            // compatibility) or an object { token, type } where type is one of
            // AUTH_BEARER ('bearer') or AUTH_ACCESS_TOKEN ('access').
            const { token, type } = this.#normalizeCredentials(credentials);
            const authHeader = type === AUTH_ACCESS_TOKEN
                ? `Token ${token}`
                : `Bearer ${token}`;

            let payload = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-authorization': authHeader
                },
                signal: AbortSignal.timeout(15000)
            };

            if (body) {
                payload.body = JSON.stringify(body);
            }

            const response = await fetch(endpoint, payload);

            if (!response.ok) {
                let detail = '';
                try {
                    detail = await response.text();
                } catch (_) { /* ignore */ }
                const detailSuffix = detail ? ` - ${detail}` : '';
                return Promise.reject(new Error(`Failed to '${method}' on endpoint '${endpoint}'. Got error '${response.statusText} (${response.status})'${detailSuffix}`));
            }

            // Some PATCH/PUT endpoints respond with an empty body; tolerate that
            const text = await response.text();
            if (!text) {
                return Promise.resolve({});
            }
            try {
                return Promise.resolve(JSON.parse(text));
            } catch (_) {
                return Promise.resolve(text);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                return Promise.reject(new Error(`Request to ${endpoint} timed out after 15 seconds`));
            }
            throw error;
        }
    }

    #normalizeCredentials(credentials) {
        if (typeof credentials === 'string') {
            // Legacy callers pass the raw token; assume bearer for backwards compat.
            return { token: credentials, type: AUTH_BEARER };
        }
        if (credentials && typeof credentials === 'object' && credentials.token) {
            const type = credentials.type === AUTH_ACCESS_TOKEN ? AUTH_ACCESS_TOKEN : AUTH_BEARER;
            return { token: credentials.token, type };
        }
        throw new Error('Invalid VRM credentials');
    }
}

module.exports = VRM;
module.exports.AUTH_BEARER = AUTH_BEARER;
module.exports.AUTH_ACCESS_TOKEN = AUTH_ACCESS_TOKEN;
