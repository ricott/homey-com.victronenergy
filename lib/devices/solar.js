'use strict';

const config = require('../const.js');
const { ModbusRegistry, type, setting } = require('../modbusRegistry.js');

const Solar = Object.freeze({
    name: 'Solar',
    // No identity for solar chargers???
    // serial: new ModbusRegistry(setting.INFO, config.gxSolarUnitCode, ???, 7, type.string, 'Serial'),
    // Lets put some phony registry on INFO class to make sure it works
    relayState: new ModbusRegistry(setting.INFO, config.gxSolarUnitCode, 780, 1, type.uint16_1, 'Relay state'),

    mode: new ModbusRegistry(setting.READING, config.gxSolarUnitCode, 774, 1, type.uint16_1, 'Mode'),
    state: new ModbusRegistry(setting.READING, config.gxSolarUnitCode, 775, 1, type.uint16_1, 'State'),

    voltage: new ModbusRegistry(setting.READING, config.gxSolarUnitCode, 776, 1, type.uint16_100, 'Voltage'),
    current: new ModbusRegistry(setting.READING, config.gxSolarUnitCode, 777, 1, type.int16_10, 'Current'),
    power: new ModbusRegistry(setting.READING, config.gxSolarUnitCode, 789, 1, type.uint16_10, 'Power'),  

    dailyYield: new ModbusRegistry(setting.READING, config.gxSolarUnitCode, 784, 1, type.uint16_10, 'Daily Yield'),
    totalYield: new ModbusRegistry(setting.READING, config.gxSolarUnitCode, 3728, 1, type.uint32_1, 'Total Yield')
});

module.exports = {
    Solar
}