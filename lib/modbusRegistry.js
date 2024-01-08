'use strict';

const type = {
    uint16_001: { format: 'uint16', factor: 0.01 },
    uint16_01: { format: 'uint16', factor: 0.1 },
    uint16_1: { format: 'uint16', factor: 1 },
    uint16_10: { format: 'uint16', factor: 10 },
    uint16_100: { format: 'uint16', factor: 100 },
    uint32_1: { format: 'uint32', factor: 1 },
    uint32_100: { format: 'uint32', factor: 100 },
    int16_001: { format: 'int16', factor: 0.01 },
    int16_01: { format: 'int16', factor: 0.1 },
    int16_1: { format: 'int16', factor: 1 },
    int16_10: { format: 'int16', factor: 10 },
    int16_100: { format: 'int16', factor: 100 },
    string: { format: 'string', factor: 0 }
};

const setting = {
    INFO: 'INFO',
    READING: 'READING'
}

class ModbusRegistry {
    constructor(setting, unitCode, registryId, count, type, comment, capability) {
        this._setting = setting;
        this._unitCode = unitCode;
        this._registryId = registryId;
        this._count = count;
        this._type = type;
        this._comment = comment;
        this._capability = capability;
    }

    get unitCode() {
        return this._unitCode;
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
        if (dataBuffer) {
            if (this._type.format === 'uint32') {
                return dataBuffer.readUInt32BE(0) / this._type.factor;
            } else if (this._type.format === 'uint16') {
                return dataBuffer.readUInt16BE(0) / this._type.factor;
            } else if (this._type.format === 'int16') {
                return dataBuffer.readInt16BE(0) / this._type.factor;
            } else if (this._type.format === 'string') {
                return dataBuffer.toString('utf8');
            }
        } else {
            return 0;
        }
    }
}

module.exports = {
    type,
    setting,
    ModbusRegistry
}