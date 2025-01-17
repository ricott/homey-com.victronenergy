'use strict';

const { ModbusRegistry, type, setting } = require('../modbusRegistry.js');

const Tank = Object.freeze({
    name: 'Tank',
    productId: new ModbusRegistry(setting.INFO, 3000, 1, type.uint16_1, 'Product ID'),
    type: new ModbusRegistry(setting.INFO, 3003, 1, type.uint16_1, 'Tank fluid type'),
    level: new ModbusRegistry(setting.READING, 3004, 1, type.uint16_10, 'Tank level'),
    status: new ModbusRegistry(setting.READING, 3007, 1, type.uint16_1, 'Tank status'),
});

module.exports = {
    Tank
}