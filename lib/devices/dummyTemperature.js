'use strict';

const config = require('../const.js');
const { ModbusRegistry, type, setting } = require('../modbusRegistry.js');

const DummyTemperature = Object.freeze({
    productId: new ModbusRegistry(setting.INFO, config.gxSensorUnitCode, 304, 1, type.uint16_1, 'Product ID'),
    type: new ModbusRegistry(setting.INFO, config.gxSensorUnitCode, 304, 1, type.uint16_1, 'Temperature type'),
    temperature: new ModbusRegistry(setting.READING, config.gxSensorUnitCode, 262, 1, type.int16_10, 'Temperature'),
    status: new ModbusRegistry(setting.READING, config.gxSensorUnitCode, 304, 1, type.uint16_1, 'Temperature status'),
    humidity: new ModbusRegistry(setting.READING, config.gxSensorUnitCode, 266, 1, type.uint16_10, 'Humidity'),
    batteryVoltage: new ModbusRegistry(setting.READING, config.gxSensorUnitCode, 300, 1, type.uint16_100, 'Sensor battery voltage'),
    pressure: new ModbusRegistry(setting.READING, config.gxSensorUnitCode, 266, 1, type.uint16_1, 'Atmospheric pressure'),
});

module.exports = {
    DummyTemperature
}