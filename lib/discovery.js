'use strict';

var modbus = require('jsmodbus');
var net = require('net');
var EventEmitter = require('events');
var util = require('util');
const config = require('./const.js');
const { GX_v1 } = require('./devices/gx_v1.js');

class Validator {

    validateConnection(address, port, unitId) {
        var self = this;
        let socket = new net.Socket();
        //Default client is 100, all GX devices have it
        let systemClient = new modbus.client.TCP(socket, config.gxSystemUnitId);
        //Get vebus unitId from input
        let vebusClient = new modbus.client.TCP(socket, unitId);
        let vrmId = null;

        socket.on('connect', () => {
            console.log(`IP '${address}' and port ${port} validated successfully`);

            systemClient.readHoldingRegisters(GX_v1.vrmId.registryId, GX_v1.vrmId.count)
                .then((result) => {
                    vrmId = result.response._body._valuesAsBuffer.toString('utf8');

                    vebusClient.readHoldingRegisters(GX_v1.switchPosition.registryId, GX_v1.switchPosition.count)
                        .then((result) => {
                            self.emit('result', { outcome: 'success', vrmId: vrmId, reason: null });
                        }).catch(reason => {
                            self.emit('result', { outcome: 'vebus_failure', vrmId: vrmId, reason: reason });
                        }).finally(() => {
                            socket.destroy();
                        });
                }).catch(reason => {
                    if (socket) {
                        try {
                            socket.destroy();
                        } catch (ignore) { }
                    }
                    self.emit('result', { outcome: 'connect_failure', vrmId: null, reason: reason });
                });
        });

        socket.on('error', reason => {
            self.emit('result', { outcome: 'connect_failure', reason: reason });
        });

        socket.on('close', function () {
            console.log(`Client closed for IP '${address}'`);
        });

        socket.setTimeout(5000);
        socket.connect({ host: address, port: port });
    }
}
util.inherits(Validator, EventEmitter);
module.exports = Validator;
