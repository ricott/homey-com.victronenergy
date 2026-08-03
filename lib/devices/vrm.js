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
                username: String(username || '').trim(),
                password: password,
                remember_me: true
            };

            // Add MFA token if provided
            if (sms_token) {
                loginData.sms_token = String(sms_token).trim();
            }

            const response = await fetch(`https://${config.apiDomain}/v2/auth/login`, {
                method: 'post',
                body: JSON.stringify(loginData),
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(15000)
            });

            if (!response.ok) {
                // The VRM API returns a JSON body with 'errors' and 'error_code'.
                // Without it a 401 is indistinguishable from e.g. an account that
                // has been migrated to Victron OneID (where password login is
                // deprecated) or a rate limited IP, so always keep the detail.
                const detail = await this.#readErrorBody(response);
                console.log(`POST '/v2/auth/login' failed with '${response.status}' and '${response.statusText}'${detail.raw ? ` - ${detail.raw}` : ''}`);
                return Promise.reject(new Error(this.#describeLoginFailure(response.status, response.statusText, detail)));
            }

            const json = await response.json();

            if (json.verification_sent == true && !sms_token) {
                // MFA enabled but no token provided
                return Promise.reject(new Error('VRM account has MFA enabled. Please provide a 2FA code.'));
            }

            if (!json.token) {
                return Promise.reject(new Error(`VRM login succeeded but returned no token${json.verification_mode ? ` (verification mode '${json.verification_mode}')` : ''}. Use a VRM personal access token instead.`));
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

    async #readErrorBody(response) {
        let raw = '';
        try {
            raw = await response.text();
        } catch (_) { /* ignore */ }

        let errors = '';
        let errorCode = '';
        try {
            const json = JSON.parse(raw);
            errors = typeof json.errors === 'string' ? json.errors : JSON.stringify(json.errors || '');
            errorCode = json.error_code || '';
        } catch (_) { /* body was not JSON */ }

        return { raw, errors, errorCode };
    }

    #describeLoginFailure(status, statusText, detail) {
        const haystack = `${detail.errors} ${detail.errorCode} ${detail.raw}`.toLowerCase();
        const apiSaid = detail.errors || detail.raw;

        // Victron deprecated email/password login for accounts backed by Victron
        // OneID (VRM portal release 1.117.0, 2026-07-15). Such accounts get a 401
        // no matter how correct the password is - a personal access token is the
        // only way in.
        if (haystack.includes('oneid') || haystack.includes('one id') || haystack.includes('deprecat')) {
            return `VRM no longer accepts email/password login for this account (Victron OneID). Create a personal access token in the VRM Portal (Preferences -> Integrations -> Access tokens) and use the "Access token" option instead. VRM said: '${apiSaid}'`;
        }

        if (status === 429) {
            return `VRM is rate limiting these login attempts (429). Wait a few minutes and try again. VRM said: '${apiSaid}'`;
        }

        if (status === 401) {
            return `VRM rejected the credentials (401${detail.errorCode ? ` / ${detail.errorCode}` : ''}: '${apiSaid}'). If you sign in to VRM through Victron OneID, or with Google/Apple, email/password login does not work here - create a personal access token in the VRM Portal (Preferences -> Integrations -> Access tokens) and use the "Access token" option instead.`;
        }

        return `POST '/v2/auth/login' failed with '${status}' and '${statusText}'${apiSaid ? ` - ${apiSaid}` : ''}`;
    }

    /**
     * Resolve the account behind a credential. Used to validate a personal access
     * token pasted by the user and to discover their idUser, which the
     * access-token flow does not hand us the way /auth/login does.
     */
    getCurrentUser(credentials) {
        return this.#makeRequest(credentials, `https://${config.apiDomain}/v2/users/me`, 'get')
            .then(response => {
                const user = response?.user || {};
                if (!user.id) {
                    return Promise.reject(new Error('VRM did not return a user id for this token.'));
                }
                return Promise.resolve({
                    userId: user.id,
                    name: user.name,
                    email: user.email
                });
            })
            .catch(reason => Promise.reject(reason));
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
