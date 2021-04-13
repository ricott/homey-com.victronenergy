'use strict';

const Enum = require('enum');

exports.getSwitchPositions = function () {
    return getEnumAsJson(switchPosition);
}

exports.getBatteryStatuses = function () {
    return getEnumAsJson(batteryStatus);
}

exports.getVEBusStatuses = function () {
    return getEnumAsJson(vebusStatus);
}

exports.decodeSwitchPosition = function (numType) {
    return lookupEnumKey(switchPosition, numType);
}

exports.decodeESSState = function (numType) {
    return lookupEnumKey(essState, numType);
}

exports.decodeBatteryStatus = function (numType) {
    return lookupEnumKey(batteryStatus, numType);
}

exports.decodeVEBusStatus = function (numType) {
    return lookupEnumKey(vebusStatus, numType);
}

const switchPosition = new Enum({
    'Charger Only': 1,
    'Inverter Only': 2,
    'On': 3,
    'Off': 4
});

const essState = new Enum({
    'ESS with Phase Compensation': 1,
    'ESS without Phase Compensation': 2,
    'Disabled/External Control': 3
});

const batteryStatus = new Enum({
    'Idle': 0,
    'Charging': 1,
    'Discharging': 2
});

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

function lookupEnumKey(enumObject, value) {
    if (enumObject.get(value)) {
        return enumObject.get(value).key;
    } else {
        return `UNKNOWN (${value})`
    }
}

function getEnumAsJson(enumObject) {
    let values = [];
    enumObject.enums.forEach(function (entry) {
        values.push({
            id: `${entry.value}`,
            name: entry.key
        });
    });
    return values;
}