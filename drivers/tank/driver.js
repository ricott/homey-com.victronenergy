'use strict';

const { Driver } = require('homey');
const Discovery = require('../../lib/discovery.js');
const { Tank } = require('../../lib/devices/tank.js');
// const { DummyTank } = require('../../lib/devices/dummyTank.js');

class TankDriver extends Driver {

    async onInit() {
        this.log('Victron Tank driver has been initialized');

        this._sensor_status_changed = this.homey.flow.getDeviceTriggerCard('sensor_status_changed');
        this._tank_level_changed = this.homey.flow.getDeviceTriggerCard('tank_level_changed');
    }

    triggerSensorStatusChanged(device, tokens) {
        this._sensor_status_changed.trigger(device, tokens, {}).catch(this.error);
    }

    triggerTankLevelChanged(device, tokens) {
        this._tank_level_changed.trigger(device, tokens, {}).catch(this.error);
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
                Tank.productId
                //DummyTank.productId
            );
        });

        session.setHandler('list_devices', async (data) => {

            if (discoveryResponse.outcome == 'success') {
                this.log(`Found device: ${discoveryResponse.returnValue}`);
                devices.push({
                    name: `Tank (${discoveryResponse.returnValue})`,
                    data: {
                        id: discoveryResponse.returnValue
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
module.exports = TankDriver;