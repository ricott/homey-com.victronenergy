'use strict';

const { Driver } = require('homey');
const Discovery = require('../../lib/discovery.js');

class GXDriver extends Driver {

    async onInit() {
        this.log('Victron GX driver has been initialized');
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
                session.nextView();
            });

            discovery.validateConnection(settings.address,
                Number(settings.port),
                Number(settings.modbus_vebus),
                Number(settings.modbus_battery));
        });

        session.setHandler('list_devices', async (data) => {

            if (discoveryResponse.outcome == 'success') {
                this.log(`Found device: ${discoveryResponse.vrmId}`);
                devices.push({
                    name: `GX (${discoveryResponse.vrmId})`,
                    data: {
                        id: discoveryResponse.vrmId
                    },
                    settings: {
                        address: settings.address,
                        port: Number(settings.port),
                        modbus_vebus_unitId: Number(settings.modbus_vebus),
                        modbus_battery_unitId: Number(settings.modbus_battery),
                        ssh_user: settings.ssh_user,
                        ssh_password: settings.ssh_password
                    }
                });
            } else if (discoveryResponse.outcome == 'connect_failure') {
                this.log(discoveryResponse);
                throw new Error(`Couldn't connect to host '${settings.address}' on port '${settings.port}'`);

            } else if (discoveryResponse.outcome == 'vebus_failure') {
                this.log(discoveryResponse);
                throw new Error(`Connected successfully to GX device '${discoveryResponse.vrmId}', but com.victronenergy.vebus Unit ID '${settings.modbus_vebus}' is invalid`);

            } else if (discoveryResponse.outcome == 'battery_failure') {
                this.log(discoveryResponse);
                throw new Error(`Connected successfully to GX device '${discoveryResponse.vrmId}', but com.victronenergy.battery Unit ID '${settings.modbus_battery}' is invalid`);
            }

            return devices;
        });
    }

}
module.exports = GXDriver;