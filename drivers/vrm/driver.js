'use strict';
const Homey = require('homey');
const VRM = require('../../lib/devices/vrm.js');

class VRMDriver extends Homey.Driver {

    async onPair(session) {
        let devices = [];

        session.setHandler('login', async (data) => {
            if (data.username == '' || data.password == '') {
                throw new Error('User name and password is mandatory!');
            }

            const vrm = new VRM();
            const response = await vrm.login(data.username, data.password);
            const installations = await vrm.getInstallations(response.token, response.userId);
            installations.forEach(installation => {
                devices.push({
                    name: installation.name,
                    data: {
                        id: installation.idSite,
                        userId: response.userId
                    },
                    store: {
                        username: data.username,
                        password: data.password
                    }
                });
            });

            return true;
        });

        session.setHandler('list_devices', async (data) => {
            return devices;
        });
    }
}
module.exports = VRMDriver;
