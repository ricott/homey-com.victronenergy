'use strict';
const Homey = require('homey');
const VRM = require('../../lib/devices/vrm.js');

class VRMDriver extends Homey.Driver {

    async onPair(session) {
        const vrm = new VRM();
        let devices = [];
        let loginResponse = null;

        session.setHandler('login', async (data) => {
            if (data.username == '' || data.password == '') {
                throw new Error('User name and password is mandatory!');
            }

            loginResponse = await vrm.login(data.username, data.password, data.mfa_token || null);

            try {
                session.nextView();
            } catch (error) {
                this.error('Error:', error);
            }
        });

        session.setHandler('list_devices', async (data) => {
            const installations = await vrm.getInstallations(loginResponse.token, loginResponse.userId);
            installations.forEach(installation => {
                devices.push({
                    name: installation.name,
                    data: {
                        id: installation.idSite,
                        userId: loginResponse.userId
                    },
                    store: {
                        token: loginResponse.token
                    }
                });
            });
            return devices;
        });
    }
}
module.exports = VRMDriver;
