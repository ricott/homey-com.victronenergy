'use strict';

const { Driver } = require('homey');
const Discovery = require('../lib/discovery.js');

class BaseDriver extends Driver {

    async pair(identifier, deviceName, session) {
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
                identifier
            );
        });

        session.setHandler('list_devices', async (data) => {

            if (discoveryResponse.outcome == 'success') {
                this.log(`Found ${deviceName} with id: ${discoveryResponse.returnValue}`);
                devices.push({
                    name: `${deviceName} (${discoveryResponse.returnValue})`,
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

};

module.exports = BaseDriver;