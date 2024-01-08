'use strict';

const { Driver } = require('homey');
const Discovery = require('../../lib/discovery.js');
const { EvCharger } = require('../../lib/devices/evcharger.js');

class EvChargerDriver extends Driver {

    async onInit() {
        this.log('Victron EV Charger driver has been initialized');

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
                EvCharger.serial
            );
        });

        session.setHandler('list_devices', async (data) => {

            if (discoveryResponse.outcome == 'success') {
                this.log(`Found EV Charger with serial: ${discoveryResponse.returnValue}`);
                devices.push({
                    name: `EV Charger (${discoveryResponse.returnValue})`,
                    data: {
                        id: `${discoveryResponse.returnValue}`
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
module.exports = EvChargerDriver;