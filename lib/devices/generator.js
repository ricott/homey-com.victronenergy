'use strict';
const { GenSet } = require('../modbus/registry/genset.js');
const VictronBase = require('../victronBase.js');

const systemRegistries = {
    gensetL1: new ModbusRegistry(setting.READING, 823, 1, type.int16_1, 'Genset L1'),
    gensetL2: new ModbusRegistry(setting.READING, 824, 1, type.int16_1, 'Genset L2'),
    gensetL3: new ModbusRegistry(setting.READING, 825, 1, type.int16_1, 'Genset L3')
};

class Generator extends VictronBase {
    constructor(options) {
        super(GenSet, options);
    }
}

module.exports = Generator;
