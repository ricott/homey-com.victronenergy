'use strict';
const { GX } = require('../modbus/registry/gx.js');
const VictronBase = require('../victronBase.js');
const SSHClient = require('../sshClient.js');

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

    isChargingScheduleEnabled(user, privateKey, schedule) {
        const command = `dbus -y com.victronenergy.settings /Settings/CGwacs/BatteryLife/Schedule/Charge/${schedule}/Day GetValue`;
        return SSHClient.executeSSHCommand(user, privateKey, this.options.host, command).then(response => {
            return response != '-7';
        }).catch(reason => {
            return Promise.reject(reason);
        });
    }

    enableChargingSchedule(user, privateKey, schedule) {
        const command = `dbus -y com.victronenergy.settings /Settings/CGwacs/BatteryLife/Schedule/Charge/${schedule}/Day SetValue 7`;
        return SSHClient.executeSSHCommand(user, privateKey, this.options.host, command).then(response => {
            return true;
        }).catch(reason => {
            return Promise.reject(reason);
        });
    }

    disableChargingSchedule(user, privateKey, schedule) {
        //Need the % sign to pass negative value via dbus
        const command = `dbus -y com.victronenergy.settings /Settings/CGwacs/BatteryLife/Schedule/Charge/${schedule}/Day SetValue %-7`;
        return SSHClient.executeSSHCommand(user, privateKey, this.options.host, command).then(response => {
            return true;
        }).catch(reason => {
            return Promise.reject(reason);
        });
    }

    createChargingSchedule(user, privateKey, schedule, day, start, duration, soc) {

        return SSHClient.createChargingSchedule(user, privateKey, schedule, day, start, duration, soc)
            .then(response => {
                return true;
            }).catch(reason => {
                return Promise.reject(reason);
            });
    }
}

module.exports = VictronGX;
