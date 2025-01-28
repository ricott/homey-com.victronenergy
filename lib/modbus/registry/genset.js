'use strict';

const { ModbusRegistry, type, setting } = require('../modbusRegistry.js');

const GenSet = Object.freeze({
    name: 'GenSet',
    // No identity for generator???
    // serial: new ModbusRegistry(setting.INFO, config.gxSolarUnitCode, ???, 7, type.string, 'Serial'),
    // Lets put some phony registry on INFO class to make sure it works
    relayState: new ModbusRegistry(setting.INFO, 3509, 1, type.uint16_1, 'AutoStartEnabled'),

    state: new ModbusRegistry(setting.READING, 3506, 1, type.uint16_1, 'State'),

    gensetL1: new ModbusRegistry(setting.SYSTEM, 823, 1, type.int16_1, 'Genset L1'),
    gensetL2: new ModbusRegistry(setting.SYSTEM, 824, 1, type.int16_1, 'Genset L2'),
    gensetL3: new ModbusRegistry(setting.SYSTEM, 825, 1, type.int16_1, 'Genset L3')
});

module.exports = {
    GenSet
}