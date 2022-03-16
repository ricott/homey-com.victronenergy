'use strict';

const { Driver } = require('homey');
const Discovery = require('../../lib/discovery.js');
const enums = require('../../lib/enums.js');
const conditionHandler = require('../../lib/conditionHandler.js');

class GXDriver extends Driver {

    async onInit() {
        this.log('Victron GX driver has been initialized');
        this.flowCards = {};
        this._registerFlows();
    }

    _registerFlows() {
        this.log('Registering flows');

        // Register device triggers
        this.flowCards['switch_position_changed'] = this.homey.flow.getDeviceTriggerCard('switch_position_changed');
        this.flowCards['battery_status_changed'] = this.homey.flow.getDeviceTriggerCard('battery_status_changed');
        this.flowCards['vebus_status_changed'] = this.homey.flow.getDeviceTriggerCard('vebus_status_changed');
        this.flowCards['alarm_status_changed'] = this.homey.flow.getDeviceTriggerCard('alarm_status_changed');
        this.flowCards['soc_changed'] = this.homey.flow.getDeviceTriggerCard('soc_changed');
        this.flowCards['battery_voltage_changed'] = this.homey.flow.getDeviceTriggerCard('battery_voltage_changed');
        this.flowCards['grid_surplus_changed'] = this.homey.flow.getDeviceTriggerCard('grid_surplus_changed');

        //Conditions
        this.flowCards['switch_position_condition'] =
            this.homey.flow.getConditionCard('switch_position_condition')
                .registerRunListener(async (args, state) => {
                    this.log(`[${args.device.getName()}] Condition 'switch_position_condition' triggered`);
                    const mode = args.device.getCapabilityValue('switch_position');
                    this.log(`[${args.device.getName()}] - switch position: ${mode}, condition position: ${args.mode.name}`);

                    if (mode == args.mode.name) {
                        return true;
                    } else {
                        return false;
                    }
                });

        this.flowCards['switch_position_condition']
            .registerArgumentAutocompleteListener('mode',
                async (query, args) => {
                    return enums.getSwitchPositions();
                }
            );

        this.flowCards['battery_status_condition'] =
            this.homey.flow.getConditionCard('battery_status_condition')
                .registerRunListener(async (args, state) => {
                    this.log(`[${args.device.getName()}] Condition 'battery_status_condition' triggered`);
                    const status = args.device.getCapabilityValue('battery_status');
                    this.log(`[${args.device.getName()}] - battery status: ${status}, condition status: ${args.status.name}`);

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
                    const status = args.device.getCapabilityValue('vebus_status');
                    this.log(`[${args.device.getName()}] - vebus status: ${status}, condition status: ${args.status.name}`);

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
                    const soc = args.device.getCapabilityValue('battery_capacity');
                    this.log(`[${args.device.getName()}] - battery soc: ${soc}, condition soc: ${args.soc}`);

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
                    const power = args.device.getCapabilityValue('measure_power');
                    this.log(`[${args.device.getName()}] - consumption power: ${power}, condition power: ${args.power}`);

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
                    const power = args.device.getCapabilityValue('measure_power.grid');
                    this.log(`[${args.device.getName()}] - grid power: ${power}, condition power: ${args.power}`);

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
                    const power = args.device.getCapabilityValue('measure_power.battery');
                    this.log(`[${args.device.getName()}] - battery power: ${power}, condition power: ${args.power}`);

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
                    const power = args.device.getCapabilityValue('measure_power.PV');
                    this.log(`[${args.device.getName()}] - solar power: ${power}, condition power: ${args.power}`);

                    if (power < args.power) {
                        return true;
                    } else {
                        return false;
                    }
                });

        this.flowCards['excess_solar_power_condition'] =
            this.homey.flow.getConditionCard('excess_solar_power_condition')
                .registerRunListener(async (args, state) => {
                    this.log(`[${args.device.getName()}] Condition 'excess_solar_power_condition' triggered`);
                    const excess = args.device.calculateExcessSolar();
                    this.log(`[${args.device.getName()}] - excess solar power: ${excess}, condition power: ${args.power}`);

                    if (excess < args.power) {
                        return true;
                    } else {
                        return false;
                    }
                });

        this.flowCards['charger_current_condition'] =
            this.homey.flow.getConditionCard('charger_current_condition')
                .registerRunListener(async (args, state) => {
                    this.log(`[${args.device.getName()}] Condition 'charger_current_condition' triggered`);
                    const previousReadings = args.device.getStoreValue('previousReadings');
                    const current = previousReadings.maxChargeCurrent;
                    this.log(`[${args.device.getName()}] - max charge current: ${current}`);
                    this.log(`[${args.device.getName()}] - condition type: ${args.conditionType.id}, condition current: ${args.current}`);

                    return conditionHandler.evaluateNumericCondition(args.conditionType.id, args.current, current);
                });

        this.flowCards['charger_current_condition']
            .registerArgumentAutocompleteListener('conditionType',
                async (query, args) => {
                    return conditionHandler.getNumberConditions();
                }
            );

        this.flowCards['grid_setpoint_condition'] =
            this.homey.flow.getConditionCard('grid_setpoint_condition')
                .registerRunListener(async (args, state) => {
                    this.log(`[${args.device.getName()}] Condition 'grid_setpoint_condition' triggered`);
                    const previousReadings = args.device.getStoreValue('previousReadings');
                    const power = previousReadings.gridSetpointPower;
                    this.log(`[${args.device.getName()}] - grid setpoint power: ${power}`);
                    this.log(`[${args.device.getName()}] - condition type: ${args.conditionType.id}, condition power: ${args.power}`);

                    return conditionHandler.evaluateNumericCondition(args.conditionType.id, args.power, power);
                });

        this.flowCards['grid_setpoint_condition']
            .registerArgumentAutocompleteListener('conditionType',
                async (query, args) => {
                    return conditionHandler.getNumberConditions();
                }
            );

        this.flowCards['inverter_power_condition'] =
            this.homey.flow.getConditionCard('inverter_power_condition')
                .registerRunListener(async (args, state) => {
                    this.log(`[${args.device.getName()}] Condition 'inverter_power_condition' triggered`);
                    const previousReadings = args.device.getStoreValue('previousReadings');
                    const power = previousReadings.activeMaxDischargePower;
                    this.log(`[${args.device.getName()}] - active max inverter power: ${power}`);
                    this.log(`[${args.device.getName()}] - condition type: ${args.conditionType.id}, condition power: ${args.power}`);

                    return conditionHandler.evaluateNumericCondition(args.conditionType.id, args.power, power);
                });

        this.flowCards['inverter_power_condition']
            .registerArgumentAutocompleteListener('conditionType',
                async (query, args) => {
                    return conditionHandler.getNumberConditions();
                }
            );

        this.flowCards['grid_feedin_condition'] =
            this.homey.flow.getConditionCard('grid_feedin_condition')
                .registerRunListener(async (args, state) => {
                    this.log(`[${args.device.getName()}] Condition 'grid_feedin_condition' triggered`);
                    const previousReadings = args.device.getStoreValue('previousReadings');
                    const power = previousReadings.maxGridFeedinPower;
                    this.log(`[${args.device.getName()}] - max grid feed-in power: ${power}`);
                    this.log(`[${args.device.getName()}] - condition type: ${args.conditionType.id}, condition power: ${args.power}`);

                    return conditionHandler.evaluateNumericCondition(args.conditionType.id, args.power, power);
                });

        this.flowCards['grid_feedin_condition']
            .registerArgumentAutocompleteListener('conditionType',
                async (query, args) => {
                    return conditionHandler.getNumberConditions();
                }
            );

        this.flowCards['minimum_soc_condition'] =
            this.homey.flow.getConditionCard('minimum_soc_condition')
                .registerRunListener(async (args, state) => {
                    this.log(`[${args.device.getName()}] Condition 'minimum_soc_condition' triggered`);
                    const previousReadings = args.device.getStoreValue('previousReadings');
                    const soc = previousReadings.minimumSOC;
                    this.log(`[${args.device.getName()}] - minimum soc: ${soc}`);
                    this.log(`[${args.device.getName()}] - condition type: ${args.conditionType.id}, condition soc: ${args.soc}`);

                    return conditionHandler.evaluateNumericCondition(args.conditionType.id, args.soc, soc);
                });

        this.flowCards['minimum_soc_condition']
            .registerArgumentAutocompleteListener('conditionType',
                async (query, args) => {
                    return conditionHandler.getNumberConditions();
                }
            );

        this.flowCards['car_charging_condition'] =
            this.homey.flow.getConditionCard('car_charging_condition')
                .registerRunListener(async (args, state) => {
                    this.log(`[${args.device.getName()}] Condition 'car_charging_condition' triggered`);
                    this.log(`[${args.device.getName()}] - current state: ${args.device.getSetting('carCharging')}`);

                    return args.device.getSetting('carCharging') == 'true'
                });

        this.flowCards['ac_loads_condition'] =
            this.homey.flow.getConditionCard('ac_loads_condition')
                .registerRunListener(async (args, state) => {
                    this.log(`[${args.device.getName()}] Condition 'ac_loads_condition' triggered`);
                    const previousReadings = args.device.getStoreValue('previousReadings');

                    const ac_loads = previousReadings.consumptionL1 +
                        previousReadings.consumptionL2 + previousReadings.consumptionL3;
                    this.log(`[${args.device.getName()}] - AC loads: ${ac_loads}, condition power: ${args.power}`);

                    if (ac_loads < args.power) {
                        return true;
                    } else {
                        return false;
                    }
                });

        this.flowCards['ac_input_condition'] =
            this.homey.flow.getConditionCard('ac_input_condition')
                .registerRunListener(async (args, state) => {
                    this.log(`[${args.device.getName()}] Condition 'ac_input_condition' triggered`);
                    const previousReadings = args.device.getStoreValue('previousReadings');

                    const ac_inputs = previousReadings.inputL1 +
                        previousReadings.inputL2 + previousReadings.inputL3;
                    this.log(`[${args.device.getName()}] - AC inputs: ${ac_inputs}, condition power: ${args.power}`);

                    if (ac_inputs < args.power) {
                        return true;
                    } else {
                        return false;
                    }
                });

        this.flowCards['ac_output_condition'] =
            this.homey.flow.getConditionCard('ac_output_condition')
                .registerRunListener(async (args, state) => {
                    this.log(`[${args.device.getName()}] Condition 'ac_output_condition' triggered`);
                    const previousReadings = args.device.getStoreValue('previousReadings');

                    const ac_outputs = previousReadings.outputL1 +
                        previousReadings.outputL2 + previousReadings.outputL3;
                    this.log(`[${args.device.getName()}] - AC outputs: ${ac_outputs}, condition power: ${args.power}`);

                    if (ac_outputs < args.power) {
                        return true;
                    } else {
                        return false;
                    }
                });

        this.flowCards['timeSinceLastFullCharge_condition'] =
            this.homey.flow.getConditionCard('timeSinceLastFullCharge_condition')
                .registerRunListener(async (args, state) => {
                    this.log(`[${args.device.getName()}] Condition 'timeSinceLastFullCharge_condition' triggered`);
                    const previousReadings = args.device.getStoreValue('previousReadings');
                    this.log(`[${args.device.getName()}] - Time since last full charge: ${previousReadings.timeSinceLastFullCharge}, condition time: ${args.time}`);

                    if (previousReadings.timeSinceLastFullCharge < args.time) {
                        return true;
                    } else {
                        return false;
                    }
                });

        //Actions
        let actionName = 'set_carcharging_state';
        this.flowCards[actionName] = this.homey.flow.getActionCard(actionName)
            .registerRunListener(async (args) => {
                this.log(`[${args.device.getName()}] Action 'set_carcharging_state' triggered`);
                this.log(`[${args.device.getName()}] - state: '${args.state.id}' (${args.state.name})`);

                if (args.state.id == 'true') {
                    return args.device.aCarIsCharging()
                        .then(function (result) {
                            return Promise.resolve(true);
                        }).catch(reason => {
                            return Promise.reject('Failed to set car charging state');
                        });
                } else {
                    return args.device.noCarIsCharging()
                        .then(function (result) {
                            return Promise.resolve(true);
                        }).catch(reason => {
                            return Promise.reject('Failed to set car charging state');
                        });
                }
            });

        this.flowCards[actionName]
            .registerArgumentAutocompleteListener('state',
                async (query, args) => {
                    return enums.getCarChargingState();
                }
            );

        actionName = 'set_relay1_state';
        this.flowCards[actionName] = this.homey.flow.getActionCard(actionName)
            .registerRunListener(async (args) => {
                this.log(`[${args.device.getName()}] Action 'set_relay1_state' triggered`);
                this.log(`[${args.device.getName()}] - state: '${args.state.id}' (${args.state.name})`);

                if (args.state.id == 'true') {
                    return args.device.api.turnOnGXRelay1()
                        .then(function (result) {
                            return Promise.resolve(true);
                        }).catch(reason => {
                            return Promise.reject('Failed to turn on relay1');
                        });
                } else {
                    return args.device.api.turnOffGXRelay1()
                        .then(function (result) {
                            return Promise.resolve(true);
                        }).catch(reason => {
                            return Promise.reject('Failed to turn off relay1');
                        });
                }
            });

        this.flowCards[actionName]
            .registerArgumentAutocompleteListener('state',
                async (query, args) => {
                    return enums.getRelayState();
                }
            );

        actionName = 'set_relay2_state';
        this.flowCards[actionName] = this.homey.flow.getActionCard(actionName)
            .registerRunListener(async (args) => {
                this.log(`[${args.device.getName()}] Action 'set_relay2_state' triggered`);
                this.log(`[${args.device.getName()}] - state: '${args.state.id}' (${args.state.name})`);

                if (args.state.id == 'true') {
                    return args.device.api.turnOnGXRelay2()
                        .then(function (result) {
                            return Promise.resolve(true);
                        }).catch(reason => {
                            return Promise.reject('Failed to turn on relay2');
                        });
                } else {
                    return args.device.api.turnOffGXRelay2()
                        .then(function (result) {
                            return Promise.resolve(true);
                        }).catch(reason => {
                            return Promise.reject('Failed to turn off relay2');
                        });
                }
            });

        this.flowCards[actionName]
            .registerArgumentAutocompleteListener('state',
                async (query, args) => {
                    return enums.getRelayState();
                }
            );

        actionName = 'set_switch_position';
        this.flowCards[actionName] = this.homey.flow.getActionCard(actionName)
            .registerRunListener(async (args) => {
                this.log(`[${args.device.getName()}] Action 'set_switch_position' triggered`);
                this.log(`[${args.device.getName()}] - switch position: '${args.mode.id}' (${args.mode.name})`);

                return args.device.api.setSwitchPosition(args.mode.id)
                    .then(function (result) {
                        return Promise.resolve(true);
                    }).catch(reason => {
                        return Promise.reject('Failed to set switch position');
                    });
            });

        this.flowCards[actionName]
            .registerArgumentAutocompleteListener('mode',
                async (query, args) => {
                    return enums.getSwitchPositions();
                }
            );

        actionName = 'update_grid_setpoint';
        this.flowCards[actionName] = this.homey.flow.getActionCard(actionName)
            .registerRunListener(async (args) => {
                this.log(`[${args.device.getName()}] Action 'update_grid_setpoint' triggered`);
                this.log(`[${args.device.getName()}] - power: '${args.power}'`);

                return args.device.api.writeGridSetpoint(args.power)
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
                this.log(`[${args.device.getName()}] - power: '${args.power}'`);

                return args.device.api.limitInverterPower(args.power)
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
                this.log(`[${args.device.getName()}] - current: '${args.current}'`);

                return args.device.api.limitChargerCurrent(args.current)
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
                this.log(`[${args.device.getName()}] - power: '${args.power}'`);

                return args.device.api.limitGridFeedInPower(args.power)
                    .then(function (result) {
                        return Promise.resolve(true);
                    }).catch(reason => {
                        return Promise.reject('Failed to set grid feed-in limit');
                    });
            });

        actionName = 'update_minimum_soc';
        this.flowCards[actionName] = this.homey.flow.getActionCard(actionName)
            .registerRunListener(async (args) => {
                this.log(`[${args.device.getName()}] Action 'update_minimum_soc' triggered`);
                this.log(`[${args.device.getName()}] - soc: '${args.soc}'`);

                return args.device.api.writeESSMinimumSOC(args.soc)
                    .then(function (result) {
                        return Promise.resolve(true);
                    }).catch(reason => {
                        return Promise.reject('Failed to update grid setpoint');
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
                        modbus_battery_unitId: Number(settings.modbus_battery)
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