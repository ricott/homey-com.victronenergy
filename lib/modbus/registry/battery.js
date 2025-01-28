'use strict';

const { ModbusRegistry, type, setting } = require('../modbusRegistry.js');

const Battery = Object.freeze({
    name: 'Battery',

    // com.victronenergy.system
    status: new ModbusRegistry(setting.SYSTEM, 844, 1, type.uint16_1, 'Battery State'),
    // com.victronenergy.battery
    capacity: new ModbusRegistry(setting.INFO, 309, 1, type.uint16_10, 'Capacity'),

    power: new ModbusRegistry(setting.READING, 258, 1, type.int16_1, 'Battery Power'),
    voltage: new ModbusRegistry(setting.READING, 259, 1, type.uint16_100, 'Battery Voltage'),
    current: new ModbusRegistry(setting.READING, 261, 1, type.int16_10, 'Battery Current'),
    temperature: new ModbusRegistry(setting.READING, 262, 1, type.int16_10, 'Battery Temperature'),
    soc: new ModbusRegistry(setting.READING, 266, 1, type.uint16_10, 'Battery SoC'),
    alarm: new ModbusRegistry(setting.READING, 267, 1, type.uint16_1, 'Alarm'),
    timeSinceLastFullCharge: new ModbusRegistry(setting.READING, 289, 1, type.int16_001, 'Time since last full charge (s)'),
    minCellVoltage: new ModbusRegistry(setting.READING, 1290, 1, type.uint16_100, 'System; minimum cell voltage'),
    maxCellVoltage: new ModbusRegistry(setting.READING, 1291, 1, type.uint16_100, 'System; maximum cell voltage'),

});

module.exports = {
    Battery
}