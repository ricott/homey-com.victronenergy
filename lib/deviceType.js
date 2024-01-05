'use strict';

const { setting } = require('./modbusRegistry.js');
const { GX } = require('./devices/gx.js');
const { Temperature } = require('./devices/temperature.js');
const { Tank } = require('./devices/tank.js');
const { DummyTank } = require('./devices/dummyTank.js');

exports.getModbusRegistrySettings = function (deviceType) {

    if (deviceType == 'GX') {
        return GX;
    } else if (deviceType == 'Temperature') {
        return Temperature;
    } else if (deviceType == 'Tank') {
        return Tank;
    } else if (deviceType == 'DummyTank') {
        return DummyTank;
    } else {
        throw new Error(`Unknown device type '${deviceType}'`);
    }
}

exports.getReadingRegistries = function (modbusSettings) {
    let arr = [];
    Object.values(modbusSettings).forEach(function (registry) {
        if (registry != null && registry.setting === setting.READING) {
            arr.push({
                unitCode: registry.unitCode,
                comment: registry.comment,
                registryId: registry.registryId,
                count: registry.count
            });
        }
    });
    return arr;
}

exports.getReadingValues = function (modbusSettings, resultArray) {
    let resultList = {};
    let i = 0;
    Object.keys(modbusSettings).forEach(function (key) {
        let registry = modbusSettings[key];
        if (registry != null && registry.setting === setting.READING) {
            resultList[key] = registry.readData(resultArray[i]);
            i++;
        }
    });
    return resultList;
}

exports.getInfoRegistries = function (modbusSettings) {
    let arr = [];
    Object.values(modbusSettings).forEach(function (registry) {
        if (registry != null && registry.setting === setting.INFO) {
            arr.push({
                unitCode: registry.unitCode,
                comment: registry.comment,
                registryId: registry.registryId,
                count: registry.count
            });
        }
    });
    return arr;
}

exports.getInfoValues = function (modbusSettings, resultArray) {
    let resultList = {};
    let i = 0;
    Object.keys(modbusSettings).forEach(function (key) {
        let registry = modbusSettings[key];
        if (registry != null && registry.setting === setting.INFO) {
            resultList[key] = registry.readData(resultArray[i]);
            i++;
        }
    });
    return resultList;
}

exports.decodeDeviceType = function (valBuffer) {
    return 'n/a';
}