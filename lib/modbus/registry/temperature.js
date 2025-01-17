'use strict';

const { ModbusRegistry, type, setting } = require('../modbusRegistry.js');

const Temperature = Object.freeze({
    name: 'Temperature',
    productId: new ModbusRegistry(setting.INFO, 3300, 1, type.uint16_1, 'Product ID'),
    type: new ModbusRegistry(setting.INFO, 3303, 1, type.uint16_1, 'Temperature type'),
    temperature: new ModbusRegistry(setting.READING, 3304, 1, type.int16_100, 'Temperature'),
    status: new ModbusRegistry(setting.READING, 3305, 1, type.uint16_1, 'Temperature status'),
    humidity: new ModbusRegistry(setting.READING, 3306, 1, type.uint16_10, 'Humidity'),
    batteryVoltage: new ModbusRegistry(setting.READING, 3307, 1, type.uint16_100, 'Sensor battery voltage'),
    pressure: new ModbusRegistry(setting.READING, 3308, 1, type.uint16_1, 'Atmospheric pressure'),
});

module.exports = {
    Temperature
}