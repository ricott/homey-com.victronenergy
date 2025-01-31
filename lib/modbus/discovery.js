'use strict';

const modbus = require('jsmodbus');
const net = require('net');
const EventEmitter = require('events');

class Validator extends EventEmitter {

    validateSingleUnitId(address, port, unitId, registry) {
        var self = this;

        if (unitId < 0) {
            // Nothing to validate. Dummy logic when entering -1 as unitId
            self.emit('result', { outcome: 'no_validation', vrmId: null, reason: 'UnitID is less than zero' });
            return;
        } else if (unitId == 0) {
            self.emit('result', { outcome: 'connect_failure', returnValue: null, reason: 'UnitID 0 doesnt work, use 100 instead' });
            return;
        } else if (unitId > 255) {
            self.emit('result', { outcome: 'connect_failure', returnValue: null, reason: 'UnitID must be between 1 and 255' });
            return;
        }

        self.socket = new net.Socket();
        let client = new modbus.client.TCP(self.socket, unitId);
        let returnValue = null;

        self.socket.on('connect', async () => {
            console.log(`IP '${address}' and port ${port} validated successfully`);

            // Validate UnitID using passed modbus registry
            client.readHoldingRegisters(registry.registryId, registry.count)
                .then((result) => {
                    returnValue = registry.readData(result.response._body._valuesAsBuffer);
                    self.emit('result', { outcome: 'success', returnValue: returnValue, reason: null });

                }).catch(reason => {
                    if (self.socket) {
                        try {
                            self.socket.destroy();
                        } catch (ignore) { }
                    }
                    self.emit('result', { outcome: 'connect_failure', returnValue: null, reason: reason });
                });
        });

        self.socket.on('error', reason => {
            self.emit('result', { outcome: 'connect_failure', reason: reason });
        });

        self.socket.on('close', function () {
            console.log(`Client closed for IP '${address}'`);
        });

        self.socket.setTimeout(5000);
        self.socket.connect({ host: address, port: port });
    }

    disconnect() {
        if (this.socket) {
            this.socket.destroy();
        }
    }
}
module.exports = Validator;
