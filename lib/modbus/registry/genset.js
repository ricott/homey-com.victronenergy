'use strict';

const { ModbusRegistry, type, setting } = require('../modbusRegistry.js');

const GenSet = Object.freeze({
    name: 'GenSet',
    // No identity for generator???
    // serial: new ModbusRegistry(setting.INFO, config.gxSolarUnitCode, ???, 7, type.string, 'Serial'),
    // Lets put some phony registry on INFO class to make sure it works
    relayState: new ModbusRegistry(setting.INFO, 3509, 1, type.uint16_1, 'AutoStartEnabled'),

    state: new ModbusRegistry(setting.READING, 3506, 1, type.uint16_1, 'State'),
});

module.exports = {
    GenSet
}