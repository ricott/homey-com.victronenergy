'use strict';

const { Driver } = require('homey');
const Discovery = require('../../lib/discovery.js');
const { Temperature } = require('../../lib/devices/temperature.js');

class TemperatureDriver extends Driver {

    async onInit() {
        this.log('Victron Temperature driver has been initialized');

        this._sensor_status_changed = this.homey.flow.getDeviceTriggerCard('sensor_status_changed');
    }

    triggerSensorStatusChanged(device, tokens) {
        this._sensor_status_changed.trigger(device, tokens, {}).catch(this.error);
    }

    async onPair(session) {
        let devices = [];
        let settings;
        let discoveryResponse = {};

        session.setHandler('settings', async (data) => {
            settings = data;
            let discovery = new Discovery();

            discovery.on('result', message => {
                discoveryResponse = message;
                discovery.disconnect();
                session.nextView();
            });

            discovery.validateSingleUnitId(
                settings.address,
                Number(settings.port),
                Number(settings.modbus_unitId),
                Temperature.productId
            );
        });

        session.setHandler('list_devices', async (data) => {

            if (discoveryResponse.outcome == 'success') {
                this.log(`Found device with Product ID: ${discoveryResponse.returnValue}`);
                devices.push({
                    name: `Temperature (Unit ID: ${settings.modbus_unitId})`,
                    data: {
                        id: `${settings.address}|${settings.port}|${settings.modbus_unitId}`
                    },
                    settings: {
                        address: settings.address,
                        port: Number(settings.port),
                        modbus_unitId: Number(settings.modbus_unitId)
                    }
                });
            } else if (discoveryResponse.outcome == 'connect_failure') {
                this.log(discoveryResponse);
                throw new Error(`Couldn't connect to host '${settings.address}' on port '${settings.port}'`);
            }

            return devices;
        });
    }

}
module.exports = TemperatureDriver;