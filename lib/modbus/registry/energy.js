'use strict';

const { ModbusRegistry, type, setting } = require('../modbusRegistry.js');

const Energy = Object.freeze({
    name: 'Energy',

    serial: new ModbusRegistry(setting.INFO, 2609, 7, type.string, 'Serial'),

    powerL1: new ModbusRegistry(setting.READING, 2600, 1, type.int16_1, 'Power L1'),
    powerL2: new ModbusRegistry(setting.READING, 2601, 1, type.int16_1, 'Power L2'),
    powerL3: new ModbusRegistry(setting.READING, 2602, 1, type.int16_1, 'Power L3'),

    voltageL1: new ModbusRegistry(setting.READING, 2616, 1, type.uint16_10, 'Voltage L1'),
    currentL1: new ModbusRegistry(setting.READING, 2617, 1, type.int16_10, 'Current L1'),
    voltageL2: new ModbusRegistry(setting.READING, 2618, 1, type.uint16_10, 'Voltage L2'),
    currentL2: new ModbusRegistry(setting.READING, 2619, 1, type.int16_10, 'Current L2'),
    voltageL3: new ModbusRegistry(setting.READING, 2620, 1, type.uint16_10, 'Voltage L3'),
    currentL3: new ModbusRegistry(setting.READING, 2621, 1, type.int16_10, 'Current L3'),

    lifeTimeImport: new ModbusRegistry(setting.READING, 2634, 2, type.uint32_100, 'Power Total'),
    lifeTimeExport: new ModbusRegistry(setting.READING, 2636, 2, type.uint32_100, 'Power Export'),
});

module.exports = {
    Energy
}