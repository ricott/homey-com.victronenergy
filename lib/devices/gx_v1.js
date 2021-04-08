'use strict';

const config = require('../const.js');
const { ModbusRegistry, type, setting } = require('../modbusRegistry.js');

const GX_v1 = Object.freeze({

    vrmId: new ModbusRegistry(setting.INFO, config.gxSystemUnitId, 800, 6, type.string, 'VRM portal ID'),
    acPVOutputL1: new ModbusRegistry(setting.READING, config.gxSystemUnitId, 808, 1, type.uint16_1, 'PV - AC-coupled on output L1'),
    acPVOutputL2: new ModbusRegistry(setting.READING, config.gxSystemUnitId, 809, 1, type.uint16_1, 'PV - AC-coupled on output L2'),
    acPVOutputL3: new ModbusRegistry(setting.READING, config.gxSystemUnitId, 810, 1, type.uint16_1, 'PV - AC-coupled on output L3'),
    acPVInputL1: new ModbusRegistry(setting.READING, config.gxSystemUnitId, 811, 1, type.uint16_1, 'PV - AC-coupled on input L1'),
    acPVInputL2: new ModbusRegistry(setting.READING, config.gxSystemUnitId, 812, 1, type.uint16_1, 'PV - AC-coupled on input L2'),
    acPVInputL3: new ModbusRegistry(setting.READING, config.gxSystemUnitId, 813, 1, type.uint16_1, 'PV - AC-coupled on input L3'),
    consumptionL1: new ModbusRegistry(setting.READING, config.gxSystemUnitId, 817, 1, type.uint16_1, 'AC Consumption L1'),
    consumptionL2: new ModbusRegistry(setting.READING, config.gxSystemUnitId, 818, 1, type.uint16_1, 'AC Consumption L2'),
    consumptionL3: new ModbusRegistry(setting.READING, config.gxSystemUnitId, 819, 1, type.uint16_1, 'AC Consumption L3'),
    gridL1: new ModbusRegistry(setting.READING, config.gxSystemUnitId, 820, 1, type.int16_1, 'Grid L1'),
    gridL2: new ModbusRegistry(setting.READING, config.gxSystemUnitId, 821, 1, type.int16_1, 'Grid L2'),
    gridL3: new ModbusRegistry(setting.READING, config.gxSystemUnitId, 822, 1, type.int16_1, 'Grid L3'),
    batteryVoltage: new ModbusRegistry(setting.READING, config.gxSystemUnitId, 840, 1, type.uint16_10, 'Battery Voltage'),
    batteryCurrent: new ModbusRegistry(setting.READING, config.gxSystemUnitId, 841, 1, type.int16_10, 'Battery Current'),
    batteryPower: new ModbusRegistry(setting.READING, config.gxSystemUnitId, 842, 1, type.int16_1, 'Battery Power'),
    dcPV: new ModbusRegistry(setting.READING, config.gxSystemUnitId, 850, 1, type.uint16_1, 'PV - DC-coupled power'),
    batterySOC: new ModbusRegistry(setting.READING, config.gxSystemUnitId, 843, 1, type.uint16_1, 'Battery SoC'),
    batteryStatus: new ModbusRegistry(setting.READING, config.gxSystemUnitId, 844, 1, type.uint16_1, 'Battery State'),
    veBusStatus: new ModbusRegistry(setting.READING, config.gxVEBusUnitId, 31, 1, type.uint16_1, 'VE.Bus state'),
    chargerDisabled: new ModbusRegistry(setting.READING, config.gxVEBusUnitId, 38, 1, type.uint16_1, 'Charger disabled'),
    inverterDisabled: new ModbusRegistry(setting.READING, config.gxVEBusUnitId, 39, 1, type.uint16_1, 'Inverter disabled'),
    //Lots of alarms
    alarmHighTemperature: new ModbusRegistry(setting.READING, config.gxVEBusUnitId, 34, 1, type.uint16_1, 'Temperature'),
    alarmLowBattery: new ModbusRegistry(setting.READING, config.gxVEBusUnitId, 35, 1, type.uint16_1, 'Low battery'),
    alarmOverload: new ModbusRegistry(setting.READING, config.gxVEBusUnitId, 36, 1, type.uint16_1, 'Overload'),
    alarmTemperatureSensor: new ModbusRegistry(setting.READING, config.gxVEBusUnitId, 42, 1, type.uint16_1, 'Temperatur sensor'),
    alarmVoltageSensor: new ModbusRegistry(setting.READING, config.gxVEBusUnitId, 43, 1, type.uint16_1, 'Voltage sensor'),
    alarmL1HighTemperature: new ModbusRegistry(setting.READING, config.gxVEBusUnitId, 44, 1, type.uint16_1, 'Temperature L1'),
    alarmL1LowBattery: new ModbusRegistry(setting.READING, config.gxVEBusUnitId, 45, 1, type.uint16_1, 'Low battery L1'),
    alarmL1Overload: new ModbusRegistry(setting.READING, config.gxVEBusUnitId, 46, 1, type.uint16_1, 'Overload L1'),
    alarmL1Ripple: new ModbusRegistry(setting.READING, config.gxVEBusUnitId, 47, 1, type.uint16_1, 'Ripple L1'),
    alarmL2HighTemperature: new ModbusRegistry(setting.READING, config.gxVEBusUnitId, 48, 1, type.uint16_1, 'Temperature L2'),
    alarmL2LowBattery: new ModbusRegistry(setting.READING, config.gxVEBusUnitId, 49, 1, type.uint16_1, 'Low battery L2'),
    alarmL2Overload: new ModbusRegistry(setting.READING, config.gxVEBusUnitId, 50, 1, type.uint16_1, 'Overload L2'),
    alarmL2Ripple: new ModbusRegistry(setting.READING, config.gxVEBusUnitId, 51, 1, type.uint16_1, 'Ripple L2'),
    alarmL3HighTemperature: new ModbusRegistry(setting.READING, config.gxVEBusUnitId, 52, 1, type.uint16_1, 'Temperature L3'),
    alarmL3LowBattery: new ModbusRegistry(setting.READING, config.gxVEBusUnitId, 53, 1, type.uint16_1, 'Low battery L3'),
    alarmL3Overload: new ModbusRegistry(setting.READING, config.gxVEBusUnitId, 54, 1, type.uint16_1, 'Overload L3'),
    alarmL3Ripple: new ModbusRegistry(setting.READING, config.gxVEBusUnitId, 55, 1, type.uint16_1, 'Ripple L3'),
    alarmPhaseRotation: new ModbusRegistry(setting.READING, config.gxVEBusUnitId, 63, 1, type.uint16_1, 'Phase rotation'),
    alarmGridLost: new ModbusRegistry(setting.READING, config.gxVEBusUnitId, 64, 1, type.uint16_1, 'Grid lost')
});

module.exports = {
    GX_v1
}