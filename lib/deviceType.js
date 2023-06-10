'use strict';

const { setting } = require('./modbusRegistry.js');
const { GX } = require('./devices/gx.js');

exports.getModbusRegistrySettings = function (deviceType) {
    let type = GX;
    return type;
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