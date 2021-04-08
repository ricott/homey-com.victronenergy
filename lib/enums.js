'use strict';

exports.decodeBatteryState = function (numType) {
    switch (numType) {
        case 0: return 'Idle'; break;
        case 1: return 'Charging'; break;
        case 2: return 'Discharging'; break;
        default: return `UNKNOWN (${numType})`; break;
    }
}
