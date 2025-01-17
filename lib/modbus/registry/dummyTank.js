'use strict';

const { ModbusRegistry, type, setting } = require('../modbusRegistry.js');

const DummyTank = Object.freeze({
    name: 'DummyTank',
    productId: new ModbusRegistry(setting.INFO, 304, 1, type.uint16_1, 'Product ID'),
    type: new ModbusRegistry(setting.INFO, 320, 1, type.uint16_1, 'Tank fluid type'),
    level: new ModbusRegistry(setting.READING, 304, 1, type.uint16_10, 'Tank level'),
    status: new ModbusRegistry(setting.READING, 320, 1, type.uint16_1, 'Tank status'),
});

module.exports = {
    DummyTank
}