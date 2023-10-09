'use strict';
const config = require('./const');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

class VRM {

    async login(username, password) {

        const response = await fetch(`https://${config.apiDomain}/v2/auth/login`, {
            method: 'post',
            body: JSON.stringify({
                username: username,
                password: password,
                remember_me: true
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            const msg = `POST '/v2/auth/login' failed with '${response.status}' and '${response.statusText}'`;
            this._logMessage(msg);
            return Promise.reject(new Error(msg));
        }

        const json = await response.json();
        if (json.verification_sent == true) {
            // MFA enabled, currently not supported
            return Promise.reject(new Error('VRM account has MFA enabled, this is currently not supported'));
        }

        return Promise.resolve({
            token: json.token,
            userId: json.idUser
        });
    }

    async getInstallations(token, userId) {
        const response = await this.#makeRequest(token, `https://${config.apiDomain}/v2/users/${userId}/installations`, 'get');
        return Promise.resolve(response?.records || undefined);
    }

    async getPVForecastRestOfToday(token, siteId) {

        const { startTs, endTs } = this.#getTsForRestOfToday();

        const response = await this.#makeRequest(token, `https://${config.apiDomain}/v2/installations/${siteId}/stats?` + new URLSearchParams({
            'type': 'custom',
            'attributeCodes[0]': 'vrm_pv_inverter_yield_fc',
            'attributeCodes[1]': 'vrm_pv_charger_yield_fc',
            'interval': 'days',
            'start': startTs,
            'end': endTs,
        }), 'get');

        const ac_tied = response?.totals?.vrm_pv_inverter_yield_fc || 0;
        const dc_tied = response?.totals?.vrm_pv_charger_yield_fc || 0;

        return Promise.resolve(ac_tied + dc_tied);
    }

    async getPVForecastNextDay(token, siteId) {

        const { startTs, endTs } = this.#getTsForNextDay();

        const response = await this.#makeRequest(token, `https://${config.apiDomain}/v2/installations/${siteId}/stats?` + new URLSearchParams({
            'type': 'custom',
            'attributeCodes[0]': 'vrm_pv_inverter_yield_fc',
            'attributeCodes[1]': 'vrm_pv_charger_yield_fc',
            'interval': 'days',
            'start': startTs,
            'end': endTs,
        }), 'get');

        const ac_tied = response?.totals?.vrm_pv_inverter_yield_fc || 0;
        const dc_tied = response?.totals?.vrm_pv_charger_yield_fc || 0;

        return Promise.resolve(ac_tied + dc_tied);
    }

    async getConsumptionForecastRestOfToday(token, siteId) {

        const { startTs, endTs } = this.#getTsForRestOfToday();

        const response = await this.#makeRequest(token, `https://${config.betaApidomain}/v2/installations/${siteId}/stats?` + new URLSearchParams({
            'type': 'custom',
            'attributeCodes[]': 'vrm_consumption_fc',
            'interval': 'days',
            'start': startTs,
            'end': endTs,
        }), 'get');

        return Promise.resolve(response?.totals?.vrm_consumption_fc || 0);
    }

    async getConsumptionForecastNextDay(token, siteId) {

        const { startTs, endTs } = this.#getTsForNextDay();

        const response = await this.#makeRequest(token, `https://${config.betaApidomain}/v2/installations/${siteId}/stats?` + new URLSearchParams({
            'type': 'custom',
            'attributeCodes[]': 'vrm_consumption_fc',
            'interval': 'days',
            'start': startTs,
            'end': endTs,
        }), 'get');

        return Promise.resolve(response?.totals?.vrm_consumption_fc || 0);
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

    async #makeRequest(token, endpoint, method, body) {

        let payload = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'x-authorization': `Bearer ${token}`
            }
        };

        if (body) {
            payload.body = JSON.stringify(body);
        }

        const response = await fetch(endpoint, payload);

        if (!response.ok) {
            Promise.reject(new Error(`Failed to '${method}' on endpoint '${endpoint}'. Got error '${response.statusText} (${response.status})'`));
        }

        return response.json();
    }

}
module.exports = VRM;
