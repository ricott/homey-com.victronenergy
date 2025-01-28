'use strict';

const { setting } = require('./modbus/modbusRegistry.js');

function getRegistriesByType(modbusSettings, settingType) {
    let arr = [];
    Object.values(modbusSettings).forEach(function (registry) {
        if (registry != null && registry.setting === settingType) {
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

function getValuesByType(modbusSettings, resultArray, settingType) {
    let resultList = {};
    let i = 0;
    Object.keys(modbusSettings).forEach(function (key) {
        let registry = modbusSettings[key];
        if (registry != null && registry.setting === settingType) {
            resultList[key] = registry.readData(resultArray[i]);
            i++;
        }
    });
    return resultList;
}

exports.getSystemRegistries = function (modbusSettings) {
    return getRegistriesByType(modbusSettings, setting.SYSTEM);
}

exports.getReadingRegistries = function (modbusSettings) {
    return getRegistriesByType(modbusSettings, setting.READING);
}

exports.getInfoRegistries = function (modbusSettings) {
    return getRegistriesByType(modbusSettings, setting.INFO);
}

exports.getReadingValues = function (modbusSettings, resultArray) {
    return getValuesByType(modbusSettings, resultArray, setting.READING);
}

exports.getInfoValues = function (modbusSettings, resultArray) {
    return getValuesByType(modbusSettings, resultArray, setting.INFO);
}

exports.getSystemValues = function (modbusSettings, resultArray) {
    return getValuesByType(modbusSettings, resultArray, setting.SYSTEM);
}

exports.decodeDeviceType = function (valBuffer) {
    return 'n/a';
}