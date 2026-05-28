'use strict';

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

exports.getEvChargerModeType = function () {
    return getEnumAsJson(evChargerModeType);
}

exports.getGenSetState = function () {
    return getEnumAsJson(genSetState);
}

exports.getDynamicESSMode = function () {
    return getEnumAsJson(dynamicESSMode);
}

exports.getDynamicESSGreenMode = function () {
    return getEnumAsJson(dynamicESSGreenMode);
}

/////////////////

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

exports.decodeTemperatureType = function (numType) {
    return lookupEnumKey(temperatureType, numType);
}

exports.decodeSensorStatus = function (numType) {
    return lookupEnumKey(sensorStatus, numType);
}

exports.decodeTankFluidType = function (numType) {
    return lookupEnumKey(tankFluidType, numType);
}

exports.decodeEvChargerStatusType = function (numType) {
    return lookupEnumKey(evChargerStatusType, numType);
}

exports.decodeEvChargerModeType = function (numType) {
    return lookupEnumKey(evChargerModeType, numType);
}

exports.decodeGenSetState = function (numType) {
    return lookupEnumKey(genSetState, numType);
}

exports.decodeDynamicESSMode = function (numType) {
    return lookupEnumKey(dynamicESSMode, numType);
}

exports.decodeEnergyChargerMode = function (numType) {
    switch (numType) {
        case 0: // Disconnected
        case 3: // Charged
        case 7: // Low SOC
        case 8: // Ground fault
        case 9: // Welded contacts
        case 10: // CP Input shorted
        case 11: // Residual current detected
        case 12: // Under voltage detected
        case 13: // Overvoltage detected
        case 14: // Overheating detected
            return 'plugged_out';
        case 1: // Connected
        case 4: // Waiting for sun
        case 5: // Waiting for RFID
        case 6: // Waiting for start
            return 'plugged_in';
            // return 'plugged_in_paused';
        case 2:
            return 'plugged_in_charging';
        default:
            return 'plugged_out';
    }
}

const genSetState = {
    'Stopped': 0,
    'Running': 1,
    'Warm-up': 2,
    'Cool-down': 3,
    'Stopping': 4,
    'Error': 10
};

const evChargerModeType = {
    'Manual': 0,
    'Auto': 1
};

const evChargerStatusType = {
    'Disconnected': 0,
    'Connected': 1,
    'Charging': 2,
    'Charged': 3,
    'Waiting for sun': 4,
    'Waiting for RFID': 5,
    'Waiting for start': 6,
    'Low SOC': 7,
    'Ground fault': 8,
    'Welded contacts': 9,
    'CP Input shorted': 10,
    'Residual current detected': 11,
    'Under voltage detected': 12,
    'Overvoltage detected': 13,
    'Overheating detected': 14
};

const tankFluidType = {
    'Fuel': 0,
    'Fresh water': 1,
    'Waste water': 2,
    'Live well': 3,
    'Oil': 4,
    'Black water (sewage)': 5,
    'Gasoline': 6,
    'Diesel': 7,
    'LPG': 8,
    'LNG': 9,
    'Hydraulic oil': 10,
    'Raw water': 11
};

const temperatureType = {
    'Battery': 0,
    'Fridge': 1,
    'Generic': 2
};

const sensorStatus = {
    'OK': 0,
    'Disconnected': 1,
    'Short circuited': 2,
    'Reverse Polarity': 3,
    'Unknown': 4,
};

const chargingScheduleDay = {
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
};

const chargingSchedule = {
    '1': 0,
    '2': 1,
    '3': 2,
    '4': 3,
    '5': 4
};

const inputPowerSource = {
    'Not available': 0,
    'Grid': 1,
    'Generator': 2,
    'Shore power': 3,
    'Not connected': 240
};

const relayState = {
    'On': true,
    'Off': false
};

const batteryLifeState = {
    'Optimized (with BatteryLife)': 1,
    'Optimized (without BatteryLife)': 10,
    'Keep batteries charged': 9,
};

const switchPosition = {
    'Charger Only': 1,
    'Inverter Only': 2,
    'On': 3,
    'Off': 4
};

const dynamicESSMode = {
    'Off': 0,
    'Auto': 1,
    'Node-RED': 4
};

const dynamicESSGreenMode = {
    'Green mode': true,
    'Trade mode': false
};

/***
 * In modbus spec
 * 1=ESS with Phase Compensation;2=ESS without phase compensation;3=Disabled/External Control
 *
 * In remote consule UI
 * 1=Total of all phases; 2=Individual phase
 */
const essState = {
    'Total of all phases': 1,
    'Individual phase': 2,
    'Disabled/External Control': 3
};

// Lower case to match battery_charging_state
const batteryStatus = {
    'idle': 0,
    'charging': 1,
    'discharging': 2
};

const vebusStatus = {
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
};

/**
 * Reverse lookup: find the key whose value matches `value`.
 * Uses strict equality.
 */
function lookupEnumKey(obj, value) {
    const entry = Object.entries(obj).find(([, v]) => v === value);
    return entry ? entry[0] : `UNKNOWN (${value})`;
}

/**
 * Convert a plain object enum into the [{ id, name }] shape used by Homey
 * autocomplete listeners. `id` is stringified to match the prior behavior.
 */
function getEnumAsJson(obj) {
    return Object.entries(obj).map(([key, value]) => ({
        id: `${value}`,
        name: `${key}`
    }));
}
