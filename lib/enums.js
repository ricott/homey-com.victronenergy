'use strict';

const Enum = require('enum');

exports.decodeESSState = function (numType) {
    if (essState.get(numType)) {
        return essState.get(numType).key;
    } else {
        return `UNKNOWN (${numType})`
    }
}

const essState = new Enum({
    'ESS with Phase Compensation': 1,
    'ESS without Phase Compensation': 2,
    'Disabled/External Control': 3
});

exports.decodeBatteryStatus = function (numType) {
    if (batteryStatus.get(numType)) {
        return batteryStatus.get(numType).key;
    } else {
        return `UNKNOWN (${numType})`
    }
}

exports.getBatteryStatuses = function () {
    let statuses = [];
    batteryStatus.enums.forEach(function (status) {
        statuses.push({
            name: status.key
        });
    });
    return statuses;
}

const batteryStatus = new Enum({
    'Idle': 0,
    'Charging': 1,
    'Discharging': 2
});

exports.decodeVEBusStatus = function (numType) {
    if (vebusStatus.get(numType)) {
        return vebusStatus.get(numType).key;
    } else {
        return `UNKNOWN (${numType})`
    }
}

exports.getVEBusStatuses = function () {
    let statuses = [];
    vebusStatus.enums.forEach(function (status) {
        statuses.push({
            name: status.key
        });
    });
    return statuses;
}

const vebusStatus = new Enum({
    'Off': 0,
    'Low Power': 1,
    'Fault': 2,
    'Bulk': 3,
    'Absorption': 4,
    'Float': 5,
    'Storage': 6,
    'Equalize': 7,
    'Passthru': 8,
    'Inverting': 9,
    'Power assist': 10,
    'Power supply': 11,
    'Bulk protection': 252
});
