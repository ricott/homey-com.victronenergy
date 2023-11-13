'use strict';

const Enum = require('enum');

exports.getESSState = function () {
    return getEnumAsJson(essState);
}

exports.getBatteryLifeState = function () {
    return getEnumAsJson(batteryLifeState);
}

exports.getSwitchPositions = function () {
    return getEnumAsJson(switchPosition);
}

exports.getBatteryStatuses = function () {
    return getEnumAsJson(batteryStatus);
}

exports.getVEBusStatuses = function () {
    return getEnumAsJson(vebusStatus);
}

exports.getRelayState = function () {
    return getEnumAsJson(relayState);
}

exports.getInputPowerSource = function () {
    return getEnumAsJson(inputPowerSource);
}

exports.getChargingSchedule = function () {
    return getEnumAsJson(chargingSchedule);
}

exports.getChargingScheduleDay = function () {
    return getEnumAsJson(chargingScheduleDay);
}

exports.decodeSwitchPosition = function (numType) {
    return lookupEnumKey(switchPosition, numType);
}

exports.decodeBatteryLifeState = function (numType) {
    return lookupEnumKey(batteryLifeState, numType);
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

exports.decodeRelayState = function (bolType) {
    return lookupEnumKey(relayState, bolType);
}

exports.decodeInputPowerSource = function (numType) {
    return lookupEnumKey(inputPowerSource, numType);
}

exports.decodeChargingSchedule = function (numType) {
    return lookupEnumKey(chargingSchedule, numType);
}

exports.decodeChargingScheduleDay = function (numType) {
    return lookupEnumKey(chargingScheduleDay, numType);
}

const chargingScheduleDay = new Enum({
    'Every day': 7,
    'Weekdays': 8,
    'Weekends': 9,
    'Monday': 1,
    'Tuesday': 2,
    'Wednesday': 3,
    'Thursday': 4,
    'Friday': 5,
    'Saturday': 6,
    'Sunday': 0
});

const chargingSchedule = new Enum({
    '1': 0,
    '2': 1,
    '3': 2,
    '4': 3,
    '5': 4
});

const inputPowerSource = new Enum({
    'Not available': 0,
    'Grid': 1,
    'Generator': 2,
    'Shore power': 3,
    'Not connected': 240
});

const relayState = new Enum({
    'On': true,
    'Off': false
});

const batteryLifeState = new Enum({
    'Optimized (with BatteryLife)': 1,
    'Optimized (without BatteryLife)': 10,
    'Keep batteries charged': 9,
});
 
const switchPosition = new Enum({
    'Charger Only': 1,
    'Inverter Only': 2,
    'On': 3,
    'Off': 4
});

/***
 * In modbus spec
 * 1=ESS with Phase Compensation;2=ESS without phase compensation;3=Disabled/External Control
 * 
 * In remote consule UI
 * 1=Total of all phases; 2=Individual phase
 */
const essState = new Enum({
    'Total of all phases': 1,
    'Individual phase': 2,
    'Disabled/External Control': 3
});

const batteryStatus = new Enum({
    'Idle': 0,
    'Charging': 1,
    'Discharging': 2
});

const vebusStatus = new Enum({
    'Off': 0,
    'Low Power': 1, //Not in list anymore
    'Fault': 2,
    'Bulk': 3,
    'Absorption': 4,
    'Float': 5,
    'Storage': 6,
    'Equalize': 7,
    'Passthru': 8, //Not in list anymore
    'Inverting': 9, //Not in list anymore
    'Power assist': 10, //Not in list anymore
    'Power supply': 11, //Not in list anymore
    'Ext. control': 252
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
            name: `${entry.key}`
        });
    });
    return values;
}