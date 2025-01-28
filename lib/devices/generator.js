'use strict';
const { GenSet } = require('../modbus/registry/genset.js');
const VictronBase = require('../victronBase.js');

class Generator extends VictronBase {
    constructor(options) {
        super(GenSet, options);
    }
}

module.exports = Generator;
