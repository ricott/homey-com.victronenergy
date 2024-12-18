'use strict';

const config = require('../const.js');
const { ModbusRegistry, type, setting } = require('../modbusRegistry.js');

const Energy = Object.freeze({

    serial: new ModbusRegistry(setting.INFO, config.gxEnergyMeterUnitCode, 2609, 7, type.string, 'Serial'),

    powerL1: new ModbusRegistry(setting.READING, config.gxEnergyMeterUnitCode, 2600, 1, type.int16_1, 'Power L1'),
    powerL2: new ModbusRegistry(setting.READING, config.gxEnergyMeterUnitCode, 2601, 1, type.int16_1, 'Power L2'),
    powerL3: new ModbusRegistry(setting.READING, config.gxEnergyMeterUnitCode, 2602, 1, type.int16_1, 'Power L3'),

    voltageL1: new ModbusRegistry(setting.READING, config.gxEnergyMeterUnitCode, 2616, 1, type.uint16_10, 'Voltage L1'),
    currentL1: new ModbusRegistry(setting.READING, config.gxEnergyMeterUnitCode, 2617, 1, type.int16_10, 'Current L1'),
    voltageL2: new ModbusRegistry(setting.READING, config.gxEnergyMeterUnitCode, 2618, 1, type.uint16_10, 'Voltage L2'),
    currentL2: new ModbusRegistry(setting.READING, config.gxEnergyMeterUnitCode, 2619, 1, type.int16_10, 'Current L2'),
    voltageL3: new ModbusRegistry(setting.READING, config.gxEnergyMeterUnitCode, 2620, 1, type.uint16_10, 'Voltage L3'),
    currentL3: new ModbusRegistry(setting.READING, config.gxEnergyMeterUnitCode, 2621, 1, type.int16_10, 'Current L3'),

    lifeTimeImport: new ModbusRegistry(setting.READING, config.gxEnergyMeterUnitCode, 2634, 2, type.uint32_100, 'Power Total'),
    lifeTimeExport: new ModbusRegistry(setting.READING, config.gxEnergyMeterUnitCode, 2636, 2, type.uint32_100, 'Power Export'),
});

module.exports = {
    Energy
}