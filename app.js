'use strict';
const { App } = require('homey');
const { Log } = require('homey-log');
const enums = require('./lib/enums.js');
const conditionHandler = require('./lib/conditionHandler.js');

class VictronEnergyApp extends App {
    async onInit() {
        this.homeyLog = new Log({ homey: this.homey });
        await this.loadConditions();
        await this.loadActions();
        this.log('Victron Energy app has been initialized');
    }

    async loadConditions() {
        this.log('Loading conditions...');

        const input_source_condition = this.homey.flow.getConditionCard('input_source_condition');
        input_source_condition.registerRunListener(async (args, state) => {
            //this.log(`[${args.device.getName()}] Condition 'input_source_condition' triggered`);
            const source = args.device.getCapabilityValue('input_source');
            //this.log(`[${args.device.getName()}] - input source: ${source}, condition status: ${args.source.name}`);

            if (source == args.source.name) {
                return true;
            } else {
                return false;
            }
        });
        input_source_condition.registerArgumentAutocompleteListener('source',
            async (query, args) => {
                return enums.getInputPowerSource();
            }
        );

        const switch_position_condition = this.homey.flow.getConditionCard('switch_position_condition');
        switch_position_condition.registerRunListener(async (args, state) => {
            //this.log(`[${args.device.getName()}] Condition 'switch_position_condition' triggered`);
            const mode = args.device.getCapabilityValue('switch_position');
            //this.log(`[${args.device.getName()}] - switch position: ${mode}, condition position: ${args.mode.name}`);

            if (mode == args.mode.name) {
                return true;
            } else {
                return false;
            }
        });
        switch_position_condition.registerArgumentAutocompleteListener('mode',
            async (query, args) => {
                return enums.getSwitchPositions();
            }
        );

        const battery_status_condition = this.homey.flow.getConditionCard('battery_status_condition');
        battery_status_condition.registerRunListener(async (args, state) => {
            //this.log(`[${args.device.getName()}] Condition 'battery_status_condition' triggered`);
            const status = args.device.getCapabilityValue('battery_status');
            //this.log(`[${args.device.getName()}] - battery status: ${status}, condition status: ${args.status.name}`);

            if (status == args.status.name) {
                return true;
            } else {
                return false;
            }
        });
        battery_status_condition.registerArgumentAutocompleteListener('status',
            async (query, args) => {
                return enums.getBatteryStatuses();
            }
        );

        const vebus_status_condition = this.homey.flow.getConditionCard('vebus_status_condition');
        vebus_status_condition.registerRunListener(async (args, state) => {
            //this.log(`[${args.device.getName()}] Condition 'vebus_status_condition' triggered`);
            const status = args.device.getCapabilityValue('vebus_status');
            //this.log(`[${args.device.getName()}] - vebus status: ${status}, condition status: ${args.status.name}`);

            if (status == args.status.name) {
                return true;
            } else {
                return false;
            }
        });
        vebus_status_condition.registerArgumentAutocompleteListener('status',
            async (query, args) => {
                return enums.getVEBusStatuses();
            }
        );

        const battery_soc_condition = this.homey.flow.getConditionCard('battery_soc_condition');
        battery_soc_condition.registerRunListener(async (args, state) => {
            //this.log(`[${args.device.getName()}] Condition 'battery_soc_condition' triggered`);
            const soc = args.device.getCapabilityValue('battery_capacity');
            //this.log(`[${args.device.getName()}] - battery soc: ${soc}, condition soc: ${args.soc}`);

            if (soc < args.soc) {
                return true;
            } else {
                return false;
            }
        });

        const consumption_power_condition = this.homey.flow.getConditionCard('consumption_power_condition');
        consumption_power_condition.registerRunListener(async (args, state) => {
            //this.log(`[${args.device.getName()}] Condition 'consumption_power_condition' triggered`);
            const power = args.device.getCapabilityValue('measure_power');
            //this.log(`[${args.device.getName()}] - consumption power: ${power}, condition power: ${args.power}`);

            if (power < args.power) {
                return true;
            } else {
                return false;
            }
        });

        const grid_power_condition = this.homey.flow.getConditionCard('grid_power_condition');
        grid_power_condition.registerRunListener(async (args, state) => {
            //this.log(`[${args.device.getName()}] Condition 'grid_power_condition' triggered`);
            const power = args.device.getCapabilityValue('measure_power.grid');
            //this.log(`[${args.device.getName()}] - grid power: ${power}, condition power: ${args.power}`);

            if (power < args.power) {
                return true;
            } else {
                return false;
            }
        });

        const battery_power_condition = this.homey.flow.getConditionCard('battery_power_condition');
        battery_power_condition.registerRunListener(async (args, state) => {
            //this.log(`[${args.device.getName()}] Condition 'battery_power_condition' triggered`);
            const power = args.device.getCapabilityValue('measure_power.battery');
            //this.log(`[${args.device.getName()}] - battery power: ${power}, condition power: ${args.power}`);

            if (power < args.power) {
                return true;
            } else {
                return false;
            }
        });

        const solar_power_condition = this.homey.flow.getConditionCard('solar_power_condition');
        solar_power_condition.registerRunListener(async (args, state) => {
            //this.log(`[${args.device.getName()}] Condition 'solar_power_condition' triggered`);
            const power = args.device.getCapabilityValue('measure_power.PV');
            //this.log(`[${args.device.getName()}] - solar power: ${power}, condition power: ${args.power}`);

            if (power < args.power) {
                return true;
            } else {
                return false;
            }
        });

        const excess_solar_power_condition = this.homey.flow.getConditionCard('excess_solar_power_condition');
        excess_solar_power_condition.registerRunListener(async (args, state) => {
            //this.log(`[${args.device.getName()}] Condition 'excess_solar_power_condition' triggered`);
            const excess = args.device.calculateExcessSolar();
            //this.log(`[${args.device.getName()}] - excess solar power: ${excess}, condition power: ${args.power}`);

            if (excess < args.power) {
                return true;
            } else {
                return false;
            }
        });

        const charger_current_condition = this.homey.flow.getConditionCard('charger_current_condition');
        charger_current_condition.registerRunListener(async (args, state) => {
            //this.log(`[${args.device.getName()}] Condition 'charger_current_condition' triggered`);
            const current = args.device.getCapabilityValue('measure_current.maxCharge');
            //this.log(`[${args.device.getName()}] - max charge current: ${current}`);
            //this.log(`[${args.device.getName()}] - condition type: ${args.conditionType.id}, condition current: ${args.current}`);

            return conditionHandler.evaluateNumericCondition(args.conditionType.id, args.current, current);
        });
        charger_current_condition.registerArgumentAutocompleteListener('conditionType',
            async (query, args) => {
                return conditionHandler.getNumberConditions();
            }
        );

        const grid_setpoint_condition = this.homey.flow.getConditionCard('grid_setpoint_condition');
        grid_setpoint_condition.registerRunListener(async (args, state) => {
            //this.log(`[${args.device.getName()}] Condition 'grid_setpoint_condition' triggered`);
            const power = args.device.getCapabilityValue('measure_power.gridSetpoint');
            //this.log(`[${args.device.getName()}] - grid setpoint power: ${power}`);
            //this.log(`[${args.device.getName()}] - condition type: ${args.conditionType.id}, condition power: ${args.power}`);

            return conditionHandler.evaluateNumericCondition(args.conditionType.id, args.power, power);
        });
        grid_setpoint_condition.registerArgumentAutocompleteListener('conditionType',
            async (query, args) => {
                return conditionHandler.getNumberConditions();
            }
        );

        const inverter_power_condition = this.homey.flow.getConditionCard('inverter_power_condition');
        inverter_power_condition.registerRunListener(async (args, state) => {
            //this.log(`[${args.device.getName()}] Condition 'inverter_power_condition' triggered`);
            const power = args.device.getCapabilityValue('measure_power.maxDischarge');
            //this.log(`[${args.device.getName()}] - active max inverter power: ${power}`);
            //this.log(`[${args.device.getName()}] - condition type: ${args.conditionType.id}, condition power: ${args.power}`);

            return conditionHandler.evaluateNumericCondition(args.conditionType.id, args.power, power);
        });
        inverter_power_condition.registerArgumentAutocompleteListener('conditionType',
            async (query, args) => {
                return conditionHandler.getNumberConditions();
            }
        );

        const grid_feedin_condition = this.homey.flow.getConditionCard('grid_feedin_condition');
        grid_feedin_condition.registerRunListener(async (args, state) => {
            //this.log(`[${args.device.getName()}] Condition 'grid_feedin_condition' triggered`);
            const power = args.device.getCapabilityValue('measure_power.maxGridFeedin');
            //this.log(`[${args.device.getName()}] - max grid feed-in power: ${power}`);
            //this.log(`[${args.device.getName()}] - condition type: ${args.conditionType.id}, condition power: ${args.power}`);

            return conditionHandler.evaluateNumericCondition(args.conditionType.id, args.power, power);
        });
        grid_feedin_condition.registerArgumentAutocompleteListener('conditionType',
            async (query, args) => {
                return conditionHandler.getNumberConditions();
            }
        );

        const minimum_soc_condition = this.homey.flow.getConditionCard('minimum_soc_condition');
        minimum_soc_condition.registerRunListener(async (args, state) => {
            //this.log(`[${args.device.getName()}] Condition 'minimum_soc_condition' triggered`);
            const previousReadings = args.device.getStoreValue('previousReadings');
            const soc = previousReadings.minimumSOC;
            //this.log(`[${args.device.getName()}] - minimum soc: ${soc}`);
            //this.log(`[${args.device.getName()}] - condition type: ${args.conditionType.id}, condition soc: ${args.soc}`);

            return conditionHandler.evaluateNumericCondition(args.conditionType.id, args.soc, soc);
        });
        minimum_soc_condition.registerArgumentAutocompleteListener('conditionType',
            async (query, args) => {
                return conditionHandler.getNumberConditions();
            }
        );

        const ac_loads_condition = this.homey.flow.getConditionCard('ac_loads_condition');
        ac_loads_condition.registerRunListener(async (args, state) => {
            //this.log(`[${args.device.getName()}] Condition 'ac_loads_condition' triggered`);
            const previousReadings = args.device.getStoreValue('previousReadings');
            const ac_loads = previousReadings.consumptionL1 +
                previousReadings.consumptionL2 + previousReadings.consumptionL3;
            //this.log(`[${args.device.getName()}] - AC loads: ${ac_loads}, condition power: ${args.power}`);

            if (ac_loads < args.power) {
                return true;
            } else {
                return false;
            }
        });

        const ac_input_condition = this.homey.flow.getConditionCard('ac_input_condition');
        ac_input_condition.registerRunListener(async (args, state) => {
            //this.log(`[${args.device.getName()}] Condition 'ac_input_condition' triggered`);
            const previousReadings = args.device.getStoreValue('previousReadings');
            const ac_inputs = previousReadings.inputL1 +
                previousReadings.inputL2 + previousReadings.inputL3;
            //this.log(`[${args.device.getName()}] - AC inputs: ${ac_inputs}, condition power: ${args.power}`);

            if (ac_inputs < args.power) {
                return true;
            } else {
                return false;
            }
        });

        const ac_output_condition = this.homey.flow.getConditionCard('ac_output_condition')
        ac_output_condition.registerRunListener(async (args, state) => {
            //this.log(`[${args.device.getName()}] Condition 'ac_output_condition' triggered`);
            const previousReadings = args.device.getStoreValue('previousReadings');
            const ac_outputs = previousReadings.outputL1 +
                previousReadings.outputL2 + previousReadings.outputL3;
            //this.log(`[${args.device.getName()}] - AC outputs: ${ac_outputs}, condition power: ${args.power}`);

            if (ac_outputs < args.power) {
                return true;
            } else {
                return false;
            }
        });

        const timeSinceLastFullCharge_condition = this.homey.flow.getConditionCard('timeSinceLastFullCharge_condition');
        timeSinceLastFullCharge_condition.registerRunListener(async (args, state) => {
            //this.log(`[${args.device.getName()}] Condition 'timeSinceLastFullCharge_condition' triggered`);
            const previousReadings = args.device.getStoreValue('previousReadings');
            //this.log(`[${args.device.getName()}] - Time since last full charge: ${previousReadings.timeSinceLastFullCharge}, condition time: ${args.time}`);

            if (previousReadings.timeSinceLastFullCharge < args.time) {
                return true;
            } else {
                return false;
            }
        });

        const scheduled_charging_condition = this.homey.flow.getConditionCard('scheduled_charging_condition');
        scheduled_charging_condition.registerRunListener(async (args, state) => {
            //this.log(`[${args.device.getName()}] Condition 'scheduled_charging_condition' triggered`);
            //this.log(`[${args.device.getName()}] - schedule: '${args.schedule.id}' (${args.schedule.name})`);

            return args.device.api.isChargingScheduleEnabled(
                args.device.getSetting('ssh_user'),
                args.device.getSetting('ssh_password'),
                args.schedule.id
            )
                .then(function (result) {
                    return Promise.resolve(result);
                }).catch(reason => {
                    return Promise.reject(reason);
                });
        });
        scheduled_charging_condition.registerArgumentAutocompleteListener('schedule',
            async (query, args) => {
                return enums.getChargingSchedule();
            }
        );
    }

    async loadActions() {
        this.log('Loading actions...');

        const enable_charging_schedule = this.homey.flow.getActionCard('enable_charging_schedule');
        enable_charging_schedule.registerRunListener(async (args) => {
            this.log(`[${args.device.getName()}] Action 'enable_charging_schedule' triggered`);
            this.log(`[${args.device.getName()}] - schedule: '${args.schedule.id}' (${args.schedule.name})`);

            return args.device.api.enableChargingSchedule(
                args.device.getSetting('ssh_user'),
                args.device.getSetting('ssh_password'),
                args.schedule.id
            )
                .then(function (result) {
                    return Promise.resolve(result);
                }).catch(reason => {
                    return Promise.reject(reason);
                });
        });
        enable_charging_schedule.registerArgumentAutocompleteListener('schedule',
            async (query, args) => {
                return enums.getChargingSchedule();
            }
        );

        const disable_charging_schedule = this.homey.flow.getActionCard('disable_charging_schedule');
        disable_charging_schedule.registerRunListener(async (args) => {
            this.log(`[${args.device.getName()}] Action 'disable_charging_schedule' triggered`);
            this.log(`[${args.device.getName()}] - schedule: '${args.schedule.id}' (${args.schedule.name})`);

            return args.device.api.disableChargingSchedule(
                args.device.getSetting('ssh_user'),
                args.device.getSetting('ssh_password'),
                args.schedule.id
            )
                .then(function (result) {
                    return Promise.resolve(result);
                }).catch(reason => {
                    return Promise.reject(reason);
                });
        });
        disable_charging_schedule.registerArgumentAutocompleteListener('schedule',
            async (query, args) => {
                return enums.getChargingSchedule();
            }
        );

        const create_charging_schedule = this.homey.flow.getActionCard('create_charging_schedule');
        create_charging_schedule.registerRunListener(async (args) => {
            this.log(`[${args.device.getName()}] Action 'create_charging_schedule' triggered`);
            this.log(`[${args.device.getName()}] - schedule: '${args.schedule.id}' (${args.schedule.name})`);
            this.log(`[${args.device.getName()}] - day: '${args.day.id}' (${args.day.name})`);
            this.log(`[${args.device.getName()}] - start: '${args.start}'`);
            this.log(`[${args.device.getName()}] - duration: '${args.duration}'`);
            this.log(`[${args.device.getName()}] - soc: '${args.soc}'`);

            return args.device.api.createChargingSchedule(
                args.device.getSetting('ssh_user'),
                args.device.getSetting('ssh_password'),
                args.schedule.id,
                args.day.id,
                args.start,
                args.duration,
                args.soc
            )
                .then(function (result) {
                    return Promise.resolve(result);
                }).catch(reason => {
                    return Promise.reject(reason);
                });
        });
        create_charging_schedule.registerArgumentAutocompleteListener('schedule',
            async (query, args) => {
                return enums.getChargingSchedule();
            }
        );
        create_charging_schedule.registerArgumentAutocompleteListener('day',
            async (query, args) => {
                return enums.getChargingScheduleDay();
            }
        );

        const set_relay1_state = this.homey.flow.getActionCard('set_relay1_state');
        set_relay1_state.registerRunListener(async (args) => {
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
        set_relay1_state.registerArgumentAutocompleteListener('state',
            async (query, args) => {
                return enums.getRelayState();
            }
        );

        const set_relay2_state = this.homey.flow.getActionCard('set_relay2_state');
        set_relay2_state.registerRunListener(async (args) => {
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
        set_relay2_state.registerArgumentAutocompleteListener('state',
            async (query, args) => {
                return enums.getRelayState();
            }
        );

        const set_switch_position = this.homey.flow.getActionCard('set_switch_position');
        set_switch_position.registerRunListener(async (args) => {
            this.log(`[${args.device.getName()}] Action 'set_switch_position' triggered`);
            this.log(`[${args.device.getName()}] - switch position: '${args.mode.id}' (${args.mode.name})`);

            return args.device.api.setSwitchPosition(args.mode.id)
                .then(function (result) {
                    return Promise.resolve(true);
                }).catch(reason => {
                    return Promise.reject('Failed to set switch position');
                });
        });
        set_switch_position.registerArgumentAutocompleteListener('mode',
            async (query, args) => {
                return enums.getSwitchPositions();
            }
        );

        const set_batterylife_state = this.homey.flow.getActionCard('set_batterylife_state');
        set_batterylife_state.registerRunListener(async (args) => {
            this.log(`[${args.device.getName()}] Action 'set_batterylife_state' triggered`);
            this.log(`[${args.device.getName()}] - state: '${args.mode.id}' (${args.mode.name})`);

            return args.device.api.setBatteryLifeState(args.mode.id)
                .then(function (result) {
                    return Promise.resolve(true);
                }).catch(reason => {
                    return Promise.reject('Failed to set batterylife state');
                });
        });
        set_batterylife_state.registerArgumentAutocompleteListener('mode',
            async (query, args) => {
                return enums.getBatteryLifeState();
            }
        );

        const update_grid_setpoint = this.homey.flow.getActionCard('update_grid_setpoint');
        update_grid_setpoint.registerRunListener(async (args) => {
            this.log(`[${args.device.getName()}] Action 'update_grid_setpoint' triggered`);
            this.log(`[${args.device.getName()}] - power: '${args.power}'`);

            return args.device.api.writeGridSetpoint(args.power)
                .then(function (result) {
                    return Promise.resolve(true);
                }).catch(reason => {
                    return Promise.reject('Failed to update grid setpoint');
                });
        });

        const limit_inverter = this.homey.flow.getActionCard('limit_inverter');
        limit_inverter.registerRunListener(async (args) => {
            this.log(`[${args.device.getName()}] Action 'limit_inverter' triggered`);
            this.log(`[${args.device.getName()}] - power: '${args.power}'`);

            return args.device.api.limitInverterPower(args.power)
                .then(function (result) {
                    return Promise.resolve(true);
                }).catch(reason => {
                    return Promise.reject('Failed to set inverter power limit');
                });
        });

        const limit_charger = this.homey.flow.getActionCard('limit_charger');
        limit_charger.registerRunListener(async (args) => {
            this.log(`[${args.device.getName()}] Action 'limit_charger' triggered`);
            this.log(`[${args.device.getName()}] - current: '${args.current}'`);

            return args.device.api.limitChargerCurrent(args.current)
                .then(function (result) {
                    return Promise.resolve(true);
                }).catch(reason => {
                    return Promise.reject('Failed to set charger current limit');
                });
        });

        const limit_grid_feedin = this.homey.flow.getActionCard('limit_grid_feedin');
        limit_grid_feedin.registerRunListener(async (args) => {
            this.log(`[${args.device.getName()}] Action 'limit_grid_feedin' triggered`);
            this.log(`[${args.device.getName()}] - power: '${args.power}'`);

            return args.device.api.limitGridFeedInPower(args.power)
                .then(function (result) {
                    return Promise.resolve(true);
                }).catch(reason => {
                    return Promise.reject('Failed to set grid feed-in limit');
                });
        });

        const update_minimum_soc = this.homey.flow.getActionCard('update_minimum_soc');
        update_minimum_soc.registerRunListener(async (args) => {
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
}

module.exports = VictronEnergyApp;