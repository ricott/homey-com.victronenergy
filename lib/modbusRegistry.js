'use strict';

const type = {
    uint16_1: { format: 'uint16', factor: 1 },
    uint16_10: { format: 'uint16', factor: 10 },
    int16_1: { format: 'int16', factor: 1 },
    int16_10: { format: 'int16', factor: 10 },
    string: { format: 'string', factor: 0 }
};

const setting = {
    INFO: 'INFO',
    READING: 'READING'
}

class ModbusRegistry {
    constructor(setting, unitId, registryId, count, type, comment, capability) {
        this._setting = setting;
        this._unitId = unitId;
        this._registryId = registryId;
        this._count = count;
        this._type = type;
        this._comment = comment;
        this._capability = capability;
    }

    get unitId() {
        return this._unitId;
    }

    get registryId() {
        return this._registryId;
    }

    get count() {
        return this._count;
    }

    get comment() {
        return this._comment;
    }

    get setting() {
        return this._setting;
    }

    get capability() {
        return this._capability;
    }

    readData(dataBuffer) {
        if (this._type.format === 'uint16') {
            return dataBuffer.readUInt16BE(0) / this._type.factor;
        } else if (this._type.format === 'int16') {
            return dataBuffer.readInt16BE(0) / this._type.factor;
        } else if (this._type.format === 'string') {
            return dataBuffer.toString('utf8');
        }
    }
}

module.exports = {
    type,
    setting,
    ModbusRegistry
}