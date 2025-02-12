'use strict';

const modbus = require('jsmodbus');
const net = require('net');
const { getModbusExceptionMessage, formatSocketError } = require('./utils.js');

class Discovery {
    #socket;

    validateUnitId(address, port, unitId, registry) {
        return new Promise((resolve, reject) => {
            if (unitId == 0) {
                resolve({ outcome: 'connect_failure', returnValue: null, reason: `UnitID 0 isn't supported, use 100 instead` });
                return;
            } else if (unitId < 1 || unitId > 255) {
                resolve({ outcome: 'connect_failure', returnValue: null, reason: 'UnitID must be between 1 and 255' });
                return;
            }

            const socket = new net.Socket();
            // Set socket-level timeout
            socket.setTimeout(5000);
            this.#socket = socket;
            const client = new modbus.client.TCP(socket, unitId, 5000);
            let returnValue = null;

            socket.on('connect', async () => {
                console.log(`IP '${address}' and port ${port} validated successfully`);

                // Validate UnitID using passed modbus registry
                try {
                    const result = await client.readHoldingRegisters(registry.registryId, registry.count);
                    returnValue = registry.readData(result.response._body._valuesAsBuffer);
                    this.#disconnect();
                    resolve({ outcome: 'success', returnValue: returnValue, reason: null });
                } catch (error) {
                    this.#disconnect();
                    let reason;
                    if (error.response && error.response._body) {
                        reason = getModbusExceptionMessage(error.response._body._code);
                    } else {
                        reason = error.message || 'Unknown error occurred during Modbus communication';
                    }
                    resolve({ outcome: 'connect_failure', returnValue: null, reason });
                }
            });

            socket.on('error', error => {
                console.log(`Error: ${error}`);
                this.#disconnect();
                resolve({ outcome: 'connect_failure', returnValue: null, reason: formatSocketError(error, address, port) });
            });

            socket.on('close', function () {
                console.log(`Client closed for IP '${address}'`);
            });

            socket.on('timeout', () => {
                this.#disconnect();
                resolve({ outcome: 'connect_failure', returnValue: null, reason: `Connection timeout to ${address}:${port} after 5 seconds` });
            });

            socket.connect({
                host: address,
                port: port,
                timeout: 5000  // 5 seconds timeout
            });
        });
    }

    #disconnect() {
        if (this.#socket) {
            try {
                this.#socket.destroy();
            } catch (ignore) { }
            this.#socket = null;
        }
    }
}
module.exports = Discovery;
