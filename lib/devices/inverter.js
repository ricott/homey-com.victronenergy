'use strict';

const config = require('../const.js');
const { ModbusRegistry, type, setting } = require('../modbusRegistry.js');

const Inverter = Object.freeze({

    serial: new ModbusRegistry(setting.INFO, config.gxInverterUnitCode, 1039, 7, type.string, 'Serial'),

    voltageL1: new ModbusRegistry(setting.READING, config.gxInverterUnitCode, 1027, 1, type.uint16_10, 'Voltage L1'),
    currentL1: new ModbusRegistry(setting.READING, config.gxInverterUnitCode, 1028, 1, type.int16_10, 'Current L1'),
    powerL1: new ModbusRegistry(setting.READING, config.gxInverterUnitCode, 1029, 1, type.uint16_1, 'Power L1'),

    voltageL2: new ModbusRegistry(setting.READING, config.gxInverterUnitCode, 1031, 1, type.uint16_10, 'Voltage L2'),
    currentL2: new ModbusRegistry(setting.READING, config.gxInverterUnitCode, 1032, 1, type.int16_10, 'Current L2'),
    powerL2: new ModbusRegistry(setting.READING, config.gxInverterUnitCode, 1033, 1, type.uint16_1, 'Power L2'),

    voltageL3: new ModbusRegistry(setting.READING, config.gxInverterUnitCode, 1035, 1, type.uint16_10, 'Voltage L3'),
    currentL3: new ModbusRegistry(setting.READING, config.gxInverterUnitCode, 1036, 1, type.int16_10, 'Current L3'),
    powerL3: new ModbusRegistry(setting.READING, config.gxInverterUnitCode, 1037, 1, type.uint16_1, 'Power L3'),

    //totalPower: new ModbusRegistry(setting.READING, config.gxInverterUnitCode, 1052, 1, type.int32_1, 'Total Power'),
});

module.exports = {
    Inverter
}