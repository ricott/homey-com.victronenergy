'use strict';

const { ModbusRegistry, type, setting } = require('../modbusRegistry.js');

const EvCharger = Object.freeze({
    name: 'EvCharger',
    productId: new ModbusRegistry(setting.INFO, 3800, 1, type.uint16_1, 'Product ID'),
    firmware: new ModbusRegistry(setting.INFO, 3802, 2, type.uint32_1, 'Firmware version'),
    serial: new ModbusRegistry(setting.INFO, 3804, 6, type.string, 'Serial'),
    model: new ModbusRegistry(setting.INFO, 3810, 4, type.string, 'Model'),
    // position: new ModbusRegistry(setting.INFO, 3827, 1, type.uint16_1, 'Position'),
    maxChargeCurrent: new ModbusRegistry(setting.READING, 3814, 1, type.uint16_1, 'Maximum charge current'),
    mode: new ModbusRegistry(setting.READING, 3815, 1, type.uint16_1, 'Mode'),
    lifetimeEnergy: new ModbusRegistry(setting.READING, 3816, 2, type.uint32_100, 'Energy consumed by charger'),
    power: new ModbusRegistry(setting.READING, 3821, 1, type.uint16_1, 'Total power'),
    chargingTime: new ModbusRegistry(setting.READING, 3822, 1, type.uint16_001, 'Charging time'),
    current: new ModbusRegistry(setting.READING, 3823, 1, type.uint16_1, 'Charge current'),
    status: new ModbusRegistry(setting.READING, 3824, 1, type.uint16_1, 'Status'),
});

module.exports = {
    EvCharger
}