'use strict';
const { Tank } = require('./devices/tank.js');
const VictronBase = require('./victronBase.js');

class TankSensor extends VictronBase {
    constructor(options) {
        super(Tank, options);
    }
}

module.exports = TankSensor;