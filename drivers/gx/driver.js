'use strict';

const BaseDriver = require('../baseDriver.js');
const { GX } = require('../../lib/modbus/registry/gx.js');

class GXDriver extends BaseDriver {

    async onPair(session) {
        return await super.pair(GX.inputL1, 'GX', session, true);
    }

}
module.exports = GXDriver;