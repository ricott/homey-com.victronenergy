'use strict';

const { ModbusRegistry, type, setting } = require('../modbusRegistry.js');

const GX = Object.freeze({
    name: 'GX',

    vrmId: new ModbusRegistry(setting.INFO, 800, 6, type.string, 'VRM portal ID'),
    essMode: new ModbusRegistry(setting.READING, 2902, 1, type.uint16_1, 'ESS Mode'),
    acPVOutputL1: new ModbusRegistry(setting.READING, 808, 1, type.uint16_1, 'PV - AC-coupled on output L1'),
    acPVOutputL2: new ModbusRegistry(setting.READING, 809, 1, type.uint16_1, 'PV - AC-coupled on output L2'),
    acPVOutputL3: new ModbusRegistry(setting.READING, 810, 1, type.uint16_1, 'PV - AC-coupled on output L3'),
    acPVInputL1: new ModbusRegistry(setting.READING, 811, 1, type.uint16_1, 'PV - AC-coupled on input L1'),
    acPVInputL2: new ModbusRegistry(setting.READING, 812, 1, type.uint16_1, 'PV - AC-coupled on input L2'),
    acPVInputL3: new ModbusRegistry(setting.READING, 813, 1, type.uint16_1, 'PV - AC-coupled on input L3'),
    consumptionL1: new ModbusRegistry(setting.READING, 817, 1, type.uint16_1, 'AC Consumption L1'),
    consumptionL2: new ModbusRegistry(setting.READING, 818, 1, type.uint16_1, 'AC Consumption L2'),
    consumptionL3: new ModbusRegistry(setting.READING, 819, 1, type.uint16_1, 'AC Consumption L3'),
    gridL1: new ModbusRegistry(setting.READING, 820, 1, type.int16_1, 'Grid L1'),
    gridL2: new ModbusRegistry(setting.READING, 821, 1, type.int16_1, 'Grid L2'),
    gridL3: new ModbusRegistry(setting.READING, 822, 1, type.int16_1, 'Grid L3'),
    gensetL1: new ModbusRegistry(setting.READING, 823, 1, type.int16_1, 'Genset L1'),
    gensetL2: new ModbusRegistry(setting.READING, 824, 1, type.int16_1, 'Genset L2'),
    gensetL3: new ModbusRegistry(setting.READING, 825, 1, type.int16_1, 'Genset L3'),
    activeInputSource: new ModbusRegistry(setting.READING, 826, 1, type.int16_1, 'Active input source'),
    batteryVoltage: new ModbusRegistry(setting.READING, 840, 1, type.uint16_10, 'Battery Voltage'),
    batteryCurrent: new ModbusRegistry(setting.READING, 841, 1, type.int16_10, 'Battery Current'),
    batteryPower: new ModbusRegistry(setting.READING, 842, 1, type.int16_1, 'Battery Power'),
    dcPV: new ModbusRegistry(setting.READING, 850, 1, type.uint16_1, 'PV - DC-coupled power'),
    batterySOC: new ModbusRegistry(setting.READING, 843, 1, type.uint16_1, 'Battery SoC'),
    batteryStatus: new ModbusRegistry(setting.READING, 844, 1, type.uint16_1, 'Battery State'),
    gridSetpointPower: new ModbusRegistry(setting.READING, 2700, 1, type.int16_1, 'ESS control loop setpoint'),
    maxDischargePower: new ModbusRegistry(setting.READING, 2704, 1, type.uint16_01, 'ESS max discharge power'),
    maxChargeCurrent: new ModbusRegistry(setting.READING, 2705, 1, type.int16_1, 'DVCC system max charge current'),
    maxGridFeedinPower: new ModbusRegistry(setting.READING, 2706, 1, type.int16_001, 'Maximum System Grid Feed In'),
    minimumSOC: new ModbusRegistry(setting.READING, 2901, 1, type.uint16_10, 'ESS Minimum SoC (unless grid fails)'),
    // gxVEBusUnitCode
    inputL1: new ModbusRegistry(setting.READING, 12, 1, type.int16_01, 'Input power 1'),
    inputL2: new ModbusRegistry(setting.READING, 13, 1, type.int16_01, 'Input power 2'),
    inputL3: new ModbusRegistry(setting.READING, 14, 1, type.int16_01, 'Input power 3'),
    outputL1: new ModbusRegistry(setting.READING, 23, 1, type.int16_01, 'Output power 1'),
    outputL2: new ModbusRegistry(setting.READING, 24, 1, type.int16_01, 'Output power 2'),
    outputL3: new ModbusRegistry(setting.READING, 25, 1, type.int16_01, 'Output power 3'),

    veBusStatus: new ModbusRegistry(setting.READING, 31, 1, type.uint16_1, 'VE.Bus state'),
    switchPosition: new ModbusRegistry(setting.READING, 33, 1, type.uint16_1, 'Switch Position (Mode)'),
    // Battery
    timeSinceLastFullCharge: new ModbusRegistry(setting.READING, 289, 1, type.int16_001, 'Time since last full charge (s)'),
    minCellVoltage: new ModbusRegistry(setting.READING, 1290, 1, type.uint16_100, 'System; minimum cell voltage'),
    maxCellVoltage: new ModbusRegistry(setting.READING, 1291, 1, type.uint16_100, 'System; maximum cell voltage'),
    // Grid
    totalEnergyForward: new ModbusRegistry(setting.READING, 2634, 2, type.uint32_100, 'Total Energy from net'),
    totalEnergyReverse: new ModbusRegistry(setting.READING, 2636, 2, type.uint32_100, 'Total Energy to net'),
    //Lots of alarms
    alarmHighTemperature: new ModbusRegistry(setting.READING, 34, 1, type.uint16_1, 'Temperature'),
    alarmLowBattery: new ModbusRegistry(setting.READING, 35, 1, type.uint16_1, 'Low battery'),
    alarmOverload: new ModbusRegistry(setting.READING, 36, 1, type.uint16_1, 'Overload'),
    alarmTemperatureSensor: new ModbusRegistry(setting.READING, 42, 1, type.uint16_1, 'Temperature sensor'),
    alarmVoltageSensor: new ModbusRegistry(setting.READING, 43, 1, type.uint16_1, 'Voltage sensor'),
    alarmL1HighTemperature: new ModbusRegistry(setting.READING, 44, 1, type.uint16_1, 'Temperature L1'),
    alarmL1LowBattery: new ModbusRegistry(setting.READING, 45, 1, type.uint16_1, 'Low battery L1'),
    alarmL1Overload: new ModbusRegistry(setting.READING, 46, 1, type.uint16_1, 'Overload L1'),
    alarmL1Ripple: new ModbusRegistry(setting.READING, 47, 1, type.uint16_1, 'Ripple L1'),
    alarmL2HighTemperature: new ModbusRegistry(setting.READING, 48, 1, type.uint16_1, 'Temperature L2'),
    alarmL2LowBattery: new ModbusRegistry(setting.READING, 49, 1, type.uint16_1, 'Low battery L2'),
    alarmL2Overload: new ModbusRegistry(setting.READING, 50, 1, type.uint16_1, 'Overload L2'),
    alarmL2Ripple: new ModbusRegistry(setting.READING, 51, 1, type.uint16_1, 'Ripple L2'),
    alarmL3HighTemperature: new ModbusRegistry(setting.READING, 52, 1, type.uint16_1, 'Temperature L3'),
    alarmL3LowBattery: new ModbusRegistry(setting.READING, 53, 1, type.uint16_1, 'Low battery L3'),
    alarmL3Overload: new ModbusRegistry(setting.READING, 54, 1, type.uint16_1, 'Overload L3'),
    alarmL3Ripple: new ModbusRegistry(setting.READING, 55, 1, type.uint16_1, 'Ripple L3'),
    alarmPhaseRotation: new ModbusRegistry(setting.READING, 63, 1, type.uint16_1, 'Phase rotation'),
    alarmGridLost: new ModbusRegistry(setting.READING, 64, 1, type.uint16_1, 'Grid lost')
});

module.exports = {
    GX
}