'use strict';

const enums = require('../lib/enums');

console.log(enums.decodeBatteryStatus(1) === enums.decodeBatteryStatus('Charging'));

