'use strict';
const { GX } = require('../modbus/registry/gx.js');
const VictronBase = require('../victronBase.js');
const mqttClient = require('../mqttClient.js');

const SCHEDULE_BASE = '/Settings/CGwacs/BatteryLife/Schedule/Charge';

class VictronGX extends VictronBase {
    constructor(options) {
        super(GX, options);
    }

    // 1=Charger Only;2=Inverter Only;3=On;4=Off
    setSwitchPosition(mode) {
        return this.getModbusClient().writeMultipleRegisters(33, this.createBuffer(mode, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }


    // Actions described here (section 2.1), https://www.victronenergy.com/live/ess:ess_mode_2_and_3
    writeGridSetpoint(power) {
        return this.getModbusClient(100).writeMultipleRegisters(2700, this.createBuffer(power, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    // Scale factor 0.1
    limitInverterPower(power) {
        //We may get a 'W' for Watt (as unit), depending on where the invocation comes from
        if (isNaN(power) && power.indexOf('W') > -1) {
            power = power.replace('W', '');
        }

        return this.getModbusClient(100).writeMultipleRegisters(2704, this.createBuffer(power, 0.1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    // Works only on DVCC
    limitChargerCurrent(current) {
        return this.getModbusClient(100).writeMultipleRegisters(2705, this.createBuffer(current, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    // Scale factor 0.01
    limitGridFeedInPower(power) {
        return this.getModbusClient(100).writeMultipleRegisters(2706, this.createBuffer(power, 0.01))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    // Scale factor 10
    writeESSMinimumSOC(percentage) {
        return this.getModbusClient(100).writeMultipleRegisters(2901, this.createBuffer(percentage, 10))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    // Doesn't work on DVCC (set charger current to 0 instead)
    disableCharger() {
        return this.getModbusClient(100).writeMultipleRegisters(2701, this.createBuffer(0, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    // Doesn't work on DVCC
    enableCharger() {
        return this.getModbusClient(100).writeMultipleRegisters(2701, this.createBuffer(100, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    disableInverter() {
        return this.getModbusClient(100).writeMultipleRegisters(2702, this.createBuffer(0, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    enableInverter() {
        return this.getModbusClient(100).writeMultipleRegisters(2702, this.createBuffer(100, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    turnOffGXRelay1() {
        return this.getModbusClient(100).writeMultipleRegisters(806, this.createBuffer(0, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    turnOnGXRelay1() {
        return this.getModbusClient(100).writeMultipleRegisters(806, this.createBuffer(1, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    turnOffGXRelay2() {
        return this.getModbusClient(100).writeMultipleRegisters(807, this.createBuffer(0, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    turnOnGXRelay2() {
        return this.getModbusClient(100).writeMultipleRegisters(807, this.createBuffer(1, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    // 1=Optimized (With Batterylife);9=Keep batteries charged;10=Optimized (Without Batterylife)
    setBatteryLifeState(state) {
        return this.getModbusClient(100).writeMultipleRegisters(2900, this.createBuffer(state, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    // 1=ESS with Phase Compensation;2=ESS without phase compensation;3=Disabled/External Control
    setMultiphaseRegulation(state) {
        return this.getModbusClient(100).writeMultipleRegisters(2902, this.createBuffer(state, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    // 0=Off;1=Auto;4=Node-RED
    setDynamicESSMode(state) {
        return this.getModbusClient(100).writeMultipleRegisters(5423, this.createBuffer(state, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    // -32768 to 32767, -1: Disabled
    limitImportPeakshavingCurrent(current) {
        return this.getModbusClient(100).writeMultipleRegisters(2714, this.createBuffer(current, 1))
            .then((result) => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }

    /**
     * Internal helper that produces the MQTT options object based on the
     * current GX device's host plus optional credentials passed by the caller.
     */
    #mqttOptions(extra) {
        return Object.assign({
            host: this.options.host
        }, extra || {});
    }

    /**
     * Returns true when the schedule slot's Day value is anything other than -7
     * (Victron's "disabled" sentinel).
     */
    async isChargingScheduleEnabled(mqttOptions, portalId, schedule) {
        const path = `${SCHEDULE_BASE}/${schedule}/Day`;
        const value = await mqttClient.readSetting(this.#mqttOptions(mqttOptions), portalId, path);
        return Number(value) !== -7;
    }

    /**
     * Enable a schedule slot by writing 7 (Every day) to its Day field.
     * Callers may want to update Day separately afterwards if a specific day
     * (1=Mon..6=Sat, 7=Every day, 8=Weekdays, 9=Weekends, 0=Sun) was selected.
     */
    async enableChargingSchedule(mqttOptions, portalId, schedule) {
        const path = `${SCHEDULE_BASE}/${schedule}/Day`;
        await mqttClient.writeSetting(this.#mqttOptions(mqttOptions), portalId, path, 7);
        return true;
    }

    /**
     * Disable a schedule slot by writing -7 to its Day field.
     */
    async disableChargingSchedule(mqttOptions, portalId, schedule) {
        const path = `${SCHEDULE_BASE}/${schedule}/Day`;
        await mqttClient.writeSetting(this.#mqttOptions(mqttOptions), portalId, path, -7);
        return true;
    }

    /**
     * Create / update a schedule slot. start/duration are HH:mm strings.
     */
    async createChargingSchedule(mqttOptions, portalId, schedule, day, start, duration, soc) {
        const opts = this.#mqttOptions(mqttOptions);

        // start "22:00" -> seconds since midnight
        const startSeconds = Number(start.substring(0, 2)) * 3600 + Number(start.substring(3, 5)) * 60;
        // duration "01:00" -> total seconds
        const durationSeconds = Number(duration.substring(0, 2)) * 3600 + Number(duration.substring(3, 5)) * 60;

        const base = `${SCHEDULE_BASE}/${schedule}`;
        await mqttClient.writeSetting(opts, portalId, `${base}/Start`, startSeconds);
        await mqttClient.writeSetting(opts, portalId, `${base}/Duration`, durationSeconds);
        await mqttClient.writeSetting(opts, portalId, `${base}/Soc`, Number(soc));
        // Day last so the schedule only goes live once Start/Duration/Soc are set.
        await mqttClient.writeSetting(opts, portalId, `${base}/Day`, Number(day));
        return true;
    }
}

module.exports = VictronGX;
