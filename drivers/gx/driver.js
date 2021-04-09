'use strict';

const { Driver } = require('homey');
const VictronGX = require('../../lib/victron.js');
const enums = require('../../lib/enums.js');

class GXDriver extends Driver {

    async onInit() {
        this.log('Victron GX driver has been initialized');
        this.flowCards = {};
        this._registerFlows();
    }

    _registerFlows() {
        this.log('Registering flows');

        // Register device triggers
        this.flowCards['battery_status_changed'] = this.homey.flow.getDeviceTriggerCard('battery_status_changed');
        this.flowCards['vebus_status_changed'] = this.homey.flow.getDeviceTriggerCard('vebus_status_changed');
        this.flowCards['alarm_status_changed'] = this.homey.flow.getDeviceTriggerCard('alarm_status_changed');
        this.flowCards['soc_changed'] = this.homey.flow.getDeviceTriggerCard('soc_changed');

        //Conditions
        this.flowCards['battery_status_condition'] =
            this.homey.flow.getConditionCard('battery_status_condition')
                .registerRunListener(async (args, state) => {
                    this.log(`[${args.device.getName()}] Condition 'battery_status_condition' triggered`);
                    let status = args.device.getCapabilityValue('battery_status');
                    this.log(`[${args.device.getName()}] battery status: ${status}`);
                    this.log(`[${args.device.getName()}] condition.status: ${args.status.name}`);

                    if (status == args.status.name) {
                        return true;
                    } else {
                        return false;
                    }
                });

        this.flowCards['battery_status_condition']
            .registerArgumentAutocompleteListener('status',
                async (query, args) => {
                    return enums.getBatteryStatuses();
                }
            );

        this.flowCards['vebus_status_condition'] =
            this.homey.flow.getConditionCard('vebus_status_condition')
                .registerRunListener(async (args, state) => {
                    this.log(`[${args.device.getName()}] Condition 'vebus_status_condition' triggered`);
                    let status = args.device.getCapabilityValue('vebus_status');
                    this.log(`[${args.device.getName()}] vebus status: ${status}`);
                    this.log(`[${args.device.getName()}] condition.status: ${args.status.name}`);

                    if (status == args.status.name) {
                        return true;
                    } else {
                        return false;
                    }
                });

        this.flowCards['vebus_status_condition']
            .registerArgumentAutocompleteListener('status',
                async (query, args) => {
                    return enums.getVEBusStatuses();
                }
            );


        this.flowCards['battery_soc_condition'] =
            this.homey.flow.getConditionCard('battery_soc_condition')
                .registerRunListener(async (args, state) => {
                    this.log(`[${args.device.getName()}] Condition 'battery_soc_condition' triggered`);
                    let soc = args.device.getCapabilityValue('battery_capacity');
                    this.log(`[${args.device.getName()}] battery soc: ${soc}`);
                    this.log(`[${args.device.getName()}] condition.soc: ${args.soc}`);

                    if (soc < args.soc) {
                        return true;
                    } else {
                        return false;
                    }
                });

        this.flowCards['consumption_power_condition'] =
            this.homey.flow.getConditionCard('consumption_power_condition')
                .registerRunListener(async (args, state) => {
                    this.log(`[${args.device.getName()}] Condition 'consumption_power_condition' triggered`);
                    let power = args.device.getCapabilityValue('measure_power.consumption');
                    this.log(`[${args.device.getName()}] consumption power: ${power}`);
                    this.log(`[${args.device.getName()}] condition.power: ${args.power}`);

                    if (power < args.power) {
                        return true;
                    } else {
                        return false;
                    }
                });

        this.flowCards['grid_power_condition'] =
            this.homey.flow.getConditionCard('grid_power_condition')
                .registerRunListener(async (args, state) => {
                    this.log(`[${args.device.getName()}] Condition 'grid_power_condition' triggered`);
                    let power = args.device.getCapabilityValue('measure_power.grid');
                    this.log(`[${args.device.getName()}] grid power: ${power}`);
                    this.log(`[${args.device.getName()}] condition.power: ${args.power}`);

                    if (power < args.power) {
                        return true;
                    } else {
                        return false;
                    }
                });

        this.flowCards['battery_power_condition'] =
            this.homey.flow.getConditionCard('battery_power_condition')
                .registerRunListener(async (args, state) => {
                    this.log(`[${args.device.getName()}] Condition 'battery_power_condition' triggered`);
                    let power = args.device.getCapabilityValue('measure_power.battery');
                    this.log(`[${args.device.getName()}] battery power: ${power}`);
                    this.log(`[${args.device.getName()}] condition.power: ${args.power}`);

                    if (power < args.power) {
                        return true;
                    } else {
                        return false;
                    }
                });

        this.flowCards['solar_power_condition'] =
            this.homey.flow.getConditionCard('solar_power_condition')
                .registerRunListener(async (args, state) => {
                    this.log(`[${args.device.getName()}] Condition 'solar_power_condition' triggered`);
                    let power = args.device.getCapabilityValue('measure_power.PV');
                    this.log(`[${args.device.getName()}] solar power: ${power}`);
                    this.log(`[${args.device.getName()}] condition.power: ${args.power}`);

                    if (power < args.power) {
                        return true;
                    } else {
                        return false;
                    }
                });


        //Actions
        let actionName = 'update_grid_setpoint';
        this.flowCards[actionName] = this.homey.flow.getActionCard(actionName)
            .registerRunListener(async (args) => {
                this.log(`[${args.device.getName()}] Action 'update_grid_setpoint' triggered`);
                this.log(`[${args.device.getName()}] power: '${args.power}'`);

                return args.device.gx.api.writeGridSetpoint(args.power)
                    .then(function (result) {
                        return Promise.resolve(true);
                    }).catch(reason => {
                        return Promise.reject('Failed to update grid setpoint');
                    });
            });

        actionName = 'limit_inverter';
        this.flowCards[actionName] = this.homey.flow.getActionCard(actionName)
            .registerRunListener(async (args) => {
                this.log(`[${args.device.getName()}] Action 'limit_inverter' triggered`);
                this.log(`[${args.device.getName()}] power: '${args.power}'`);

                return args.device.gx.api.limitInverterPower(args.power)
                    .then(function (result) {
                        return Promise.resolve(true);
                    }).catch(reason => {
                        return Promise.reject('Failed to set inverter power limit');
                    });
            });

        actionName = 'limit_charger';
        this.flowCards[actionName] = this.homey.flow.getActionCard(actionName)
            .registerRunListener(async (args) => {
                this.log(`[${args.device.getName()}] Action 'limit_charger' triggered`);
                this.log(`[${args.device.getName()}] current: '${args.current}'`);

                return args.device.gx.api.limitChargerCurrent(args.current)
                    .then(function (result) {
                        return Promise.resolve(true);
                    }).catch(reason => {
                        return Promise.reject('Failed to set charger current limit');
                    });
            });

        actionName = 'limit_grid_feedin';
        this.flowCards[actionName] = this.homey.flow.getActionCard(actionName)
            .registerRunListener(async (args) => {
                this.log(`[${args.device.getName()}] Action 'limit_grid_feedin' triggered`);
                this.log(`[${args.device.getName()}] power: '${args.power}'`);

                return args.device.gx.api.limitGridFeedInPower(args.power)
                    .then(function (result) {
                        return Promise.resolve(true);
                    }).catch(reason => {
                        return Promise.reject('Failed to set grid feed-in limit');
                    });
            });


        actionName = 'enableCharger';
        this.flowCards[actionName] = this.homey.flow.getActionCard(actionName)
            .registerRunListener(async (args) => {
                this.log(`[${args.device.getName()}] Action 'enableCharger' triggered`);

                return args.device.gx.api.enableCharger()
                    .then(function (result) {
                        return Promise.resolve(true);
                    }).catch(reason => {
                        return Promise.reject('Failed to enable charger');
                    });
            });

        actionName = 'disableCharger';
        this.flowCards[actionName] = this.homey.flow.getActionCard(actionName)
            .registerRunListener(async (args) => {
                this.log(`[${args.device.getName()}] Action 'disableCharger' triggered`);

                return args.device.gx.api.disableCharger()
                    .then(function (result) {
                        return Promise.resolve(true);
                    }).catch(reason => {
                        return Promise.reject('Failed to disable charger');
                    });
            });

        actionName = 'enableInverter';
        this.flowCards[actionName] = this.homey.flow.getActionCard(actionName)
            .registerRunListener(async (args) => {
                this.log(`[${args.device.getName()}] Action 'enableInverter' triggered`);

                return args.device.gx.api.enableInverter()
                    .then(function (result) {
                        return Promise.resolve(true);
                    }).catch(reason => {
                        return Promise.reject('Failed to enable inverter');
                    });
            });

        actionName = 'disableInverter';
        this.flowCards[actionName] = this.homey.flow.getActionCard(actionName)
            .registerRunListener(async (args) => {
                this.log(`[${args.device.getName()}] Action 'disableInverter' triggered`);

                return args.device.gx.api.disableInverter()
                    .then(function (result) {
                        return Promise.resolve(true);
                    }).catch(reason => {
                        return Promise.reject('Failed to disable inverter');
                    });
            });
    }

    triggerDeviceFlow(flow, tokens, device) {
        this.log(`[${device.getName()}] Triggering device flow '${flow}' with tokens`, tokens);
        this.flowCards[flow].trigger(device, tokens);
    }

    async onPair(session) {
        let devices = [];
        let settings;
        let deviceProperties;

        session.setHandler('settings', async (data) => {
            settings = data;
            let gx = new VictronGX({
                host: settings.address,
                port: settings.port,
                autoClose: true
            });

            gx.on('properties', properties => {
                deviceProperties = properties;
            });

            gx.on('error', error => {
                this.log('Failed to read gx device properties', error);
            });

            //Wait 3 seconds to allow properties to be read
            return sleep(3000).then(() => {
                // Show the next view
                session.nextView();
                return true;
            });
        });

        session.setHandler('list_devices', async (data) => {

            if (deviceProperties.vrmId) {
                this.log(`Found device: ${deviceProperties.vrmId}`);
                devices.push({
                    name: `GX (${deviceProperties.vrmId})`,
                    data: {
                        id: deviceProperties.vrmId
                    },
                    settings: {
                        address: settings.address,
                        port: Number(settings.port)
                    }
                });
            }

            return devices;
        });
    }

}
module.exports = GXDriver;

// sleep time expects milliseconds
function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}