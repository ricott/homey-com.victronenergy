'use strict';

const { Driver } = require('homey');
const Discovery = require('../../lib/discovery.js');
const { Energy } = require('../../lib/devices/energy.js');

class EnergyMeterDriver extends Driver {

    async onInit() {
        this.log('Victron Energy Meter driver has been initialized');

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
                Energy.serial
            );
        });

        session.setHandler('list_devices', async (data) => {

            if (discoveryResponse.outcome == 'success') {
                this.log(`Found Energy meter with serial: ${discoveryResponse.returnValue}`);
                devices.push({
                    name: `Energy Meter (${discoveryResponse.returnValue})`,
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
module.exports = EnergyMeterDriver;