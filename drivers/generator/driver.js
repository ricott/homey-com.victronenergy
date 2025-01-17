'use strict';

const BaseDriver = require('../baseDriver.js');
const { GenSet } = require('../../lib/modbus/registry/genset.js');

class GeneratorDriver extends BaseDriver {

    async onPair(session) {
        return await super.pair(GenSet.relayState, 'Generator', session, true);
    }
}
module.exports = GeneratorDriver;
