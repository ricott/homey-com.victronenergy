'use strict';

/**
 * One-shot MQTT client for the local broker on a Victron GX device.
 *
 * The GX exposes its DBus over MQTT using the Venus topic conventions:
 *   - W/<portalId>/<service>/<deviceInstance>/<dbusPath>   write a value
 *   - R/<portalId>/<service>/<deviceInstance>/<dbusPath>   one-shot read request
 *   - N/<portalId>/<service>/<deviceInstance>/<dbusPath>   value notification
 *
 * Payload format on W/N is JSON, e.g. { "value": <number|string|bool> }.
 *
 * The local broker accepts anonymous connections by default; a username/password
 * is optional and only used when the user has enabled the "Local Security
 * Profile" on the GX. We open a fresh connection per call and disconnect when
 * done — these flow actions are infrequent enough that we don't bother with a
 * persistent connection or keepalive ping.
 */

const mqtt = require('mqtt');

const DEFAULT_PORT = 1883;
const DEFAULT_TIMEOUT_MS = 10_000;
const SETTINGS_SERVICE = 'settings';
const SETTINGS_INSTANCE = 0;

/**
 * Build a topic for the given portal id, service and dbus path.
 */
function topic(prefix, portalId, service, instance, dbusPath) {
    const path = dbusPath.startsWith('/') ? dbusPath : `/${dbusPath}`;
    return `${prefix}/${portalId}/${service}/${instance}${path}`;
}

/**
 * Open a fresh connection, run the supplied async function with the connected
 * client, and tear the connection down (always) before resolving.
 */
async function withClient(options, fn) {
    if (!options || !options.host) {
        throw new Error('MQTT host is required');
    }

    const url = `mqtt://${options.host}:${options.port || DEFAULT_PORT}`;
    const connectOptions = {
        connectTimeout: options.timeout || DEFAULT_TIMEOUT_MS,
        reconnectPeriod: 0, // one-shot, no auto-reconnect
        clean: true,
        rejectUnauthorized: false
    };
    if (options.username) connectOptions.username = options.username;
    if (options.password) connectOptions.password = options.password;

    const client = mqtt.connect(url, connectOptions);

    // Wait for connect (or fail fast on error)
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`MQTT connect to ${url} timed out`));
        }, options.timeout || DEFAULT_TIMEOUT_MS);

        client.once('connect', () => {
            clearTimeout(timer);
            resolve();
        });
        client.once('error', err => {
            clearTimeout(timer);
            reject(err);
        });
    });

    try {
        return await fn(client);
    } finally {
        try {
            await new Promise(resolve => client.end(true, {}, resolve));
        } catch (_) { /* ignore close errors */ }
    }
}

/**
 * Write a value to a DBus setting via MQTT.
 *
 * @param {object} options - { host, port?, username?, password?, timeout? }
 * @param {string} portalId - VRM portal id (the GX MAC address as string)
 * @param {string} dbusPath - e.g. /Settings/CGwacs/BatteryLife/Schedule/Charge/0/Day
 * @param {*} value - number / string / boolean to publish as { value }
 * @param {string} [service='settings'] - dbus service name (without the com.victronenergy. prefix)
 * @param {number} [instance=0] - device instance for the service
 */
async function writeSetting(options, portalId, dbusPath, value, service = SETTINGS_SERVICE, instance = SETTINGS_INSTANCE) {
    return withClient(options, client => new Promise((resolve, reject) => {
        const writeTopic = topic('W', portalId, service, instance, dbusPath);
        const payload = JSON.stringify({ value });

        client.publish(writeTopic, payload, { qos: 0 }, err => {
            if (err) return reject(err);
            resolve(true);
        });
    }));
}

/**
 * Read a DBus value once via MQTT. Subscribes to the notify topic, sends an
 * empty R/... request, awaits the next N/... message and returns the parsed
 * value. Throws if no response arrives within the timeout.
 *
 * @returns {Promise<*>} - The decoded `value` field, or the raw payload if not JSON.
 */
async function readSetting(options, portalId, dbusPath, service = SETTINGS_SERVICE, instance = SETTINGS_INSTANCE) {
    return withClient(options, client => new Promise((resolve, reject) => {
        const notifyTopic = topic('N', portalId, service, instance, dbusPath);
        const readTopic = topic('R', portalId, service, instance, dbusPath);
        const timeoutMs = options.timeout || DEFAULT_TIMEOUT_MS;

        const timer = setTimeout(() => {
            cleanup();
            reject(new Error(`MQTT read of '${dbusPath}' timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        const onMessage = (incomingTopic, payload) => {
            if (incomingTopic !== notifyTopic) return;
            cleanup();
            try {
                const text = payload.toString('utf8');
                if (!text) return resolve(null);
                const parsed = JSON.parse(text);
                resolve(parsed && Object.prototype.hasOwnProperty.call(parsed, 'value') ? parsed.value : parsed);
            } catch (err) {
                resolve(payload.toString('utf8'));
            }
        };

        function cleanup() {
            clearTimeout(timer);
            client.removeListener('message', onMessage);
            try { client.unsubscribe(notifyTopic); } catch (_) { /* ignore */ }
        }

        client.on('message', onMessage);

        client.subscribe(notifyTopic, { qos: 0 }, subErr => {
            if (subErr) {
                cleanup();
                return reject(subErr);
            }
            // Empty payload tells the broker to publish the current value once.
            client.publish(readTopic, '', { qos: 0 }, pubErr => {
                if (pubErr) {
                    cleanup();
                    return reject(pubErr);
                }
            });
        });
    }));
}

module.exports = {
    writeSetting,
    readSetting
};
