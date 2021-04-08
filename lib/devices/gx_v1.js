'use strict';

const { ModbusRegistry, type, setting } = require('../modbusRegistry.js');

const GX_v1 = Object.freeze({

    vrmId: new ModbusRegistry(setting.INFO, 100, 800, 6, type.string, 'VRM portal ID'),
    acPVOutputL1: new ModbusRegistry(setting.READING, 100, 808, 1, type.uint16_1, 'PV - AC-coupled on output L1'),
    acPVOutputL2: new ModbusRegistry(setting.READING, 100, 809, 1, type.uint16_1, 'PV - AC-coupled on output L2'),
    acPVOutputL3: new ModbusRegistry(setting.READING, 100, 810, 1, type.uint16_1, 'PV - AC-coupled on output L3'),
    acPVInputL1: new ModbusRegistry(setting.READING, 100, 811, 1, type.uint16_1, 'PV - AC-coupled on input L1'),
    acPVInputL2: new ModbusRegistry(setting.READING, 100, 812, 1, type.uint16_1, 'PV - AC-coupled on input L2'),
    acPVInputL3: new ModbusRegistry(setting.READING, 100, 813, 1, type.uint16_1, 'PV - AC-coupled on input L3'),
    consumptionL1: new ModbusRegistry(setting.READING, 100, 817, 1, type.uint16_1, 'AC Consumption L1'),
    consumptionL2: new ModbusRegistry(setting.READING, 100, 818, 1, type.uint16_1, 'AC Consumption L2'),
    consumptionL3: new ModbusRegistry(setting.READING, 100, 819, 1, type.uint16_1, 'AC Consumption L3'),
    gridL1: new ModbusRegistry(setting.READING, 100, 820, 1, type.int16_1, 'Grid L1'),
    gridL2: new ModbusRegistry(setting.READING, 100, 821, 1, type.int16_1, 'Grid L2'),
    gridL3: new ModbusRegistry(setting.READING, 100, 822, 1, type.int16_1, 'Grid L3'),
    batteryVoltage: new ModbusRegistry(setting.READING, 100, 840, 1, type.uint16_10, 'Battery Voltage'),
    batteryCurrent: new ModbusRegistry(setting.READING, 100, 841, 1, type.int16_10, 'Battery Current'),
    batteryPower: new ModbusRegistry(setting.READING, 100, 842, 1, type.int16_1, 'Battery Power'),
    dcPV: new ModbusRegistry(setting.READING, 100, 850, 1, type.uint16_1, 'PV - DC-coupled power'),
    batterySOC: new ModbusRegistry(setting.READING, 100, 843, 1, type.uint16_1, 'Battery SoC'),
    batteryState: new ModbusRegistry(setting.READING, 100, 844, 1, type.uint16_1, 'Battery State'),
});

module.exports = {
    GX_v1
}