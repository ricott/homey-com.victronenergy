'use strict';

const config = require('../const.js');
const { ModbusRegistry, type, setting } = require('../modbusRegistry.js');

const Temperature = Object.freeze({
    productId: new ModbusRegistry(setting.INFO, config.gxSensorUnitCode, 3300, 1, type.uint16_1, 'Product ID'),
    type: new ModbusRegistry(setting.INFO, config.gxSensorUnitCode, 3303, 1, type.uint16_1, 'Temperature type'),
    temperature: new ModbusRegistry(setting.READING, config.gxSensorUnitCode, 3304, 1, type.int16_100, 'Temperature'),
    status: new ModbusRegistry(setting.READING, config.gxSensorUnitCode, 3305, 1, type.uint16_1, 'Temperature status'),
    humidity: new ModbusRegistry(setting.READING, config.gxSensorUnitCode, 3306, 1, type.uint16_10, 'Humidity'),
    batteryVoltage: new ModbusRegistry(setting.READING, config.gxSensorUnitCode, 3307, 1, type.uint16_100, 'Sensor battery voltage'),
    pressure: new ModbusRegistry(setting.READING, config.gxSensorUnitCode, 3308, 1, type.uint16_1, 'Atmospheric pressure'),
});

module.exports = {
    Temperature
}