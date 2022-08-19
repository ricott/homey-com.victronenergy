'use strict';

var modbus = require('jsmodbus');
var net = require('net');
var EventEmitter = require('events');
var util = require('util');
const config = require('./const.js');
const { GX } = require('./devices/gx.js');

class Validator {

    validateConnection(address, port, vebusUnitId, batteryUnitId) {
        var self = this;
        let socket = new net.Socket();
        //Default client is 100, all GX devices have it
        let systemClient = new modbus.client.TCP(socket, config.gxSystemUnitId);
        //Get vebus unitId from input
        let vebusClient = new modbus.client.TCP(socket, vebusUnitId);
        //Battery unitId from input
        let batteryClient = null;
        if (batteryUnitId > 0) {
            batteryClient = new modbus.client.TCP(socket, batteryUnitId);
        }
        let vrmId = null;

        socket.on('connect', () => {
            console.log(`IP '${address}' and port ${port} validated successfully`);

            systemClient.readHoldingRegisters(GX.vrmId.registryId, GX.vrmId.count)
                .then((result) => {
                    vrmId = result.response._body._valuesAsBuffer.toString('utf8');
                    vebusClient.readHoldingRegisters(GX.switchPosition.registryId, GX.switchPosition.count)
                        .then(() => {
                            if (batteryClient) {
                                batteryClient.readHoldingRegisters(GX.timeSinceLastFullCharge.registryId, GX.timeSinceLastFullCharge.count)
                                .then(() => {
                                    self.emit('result', { outcome: 'success', vrmId: vrmId, reason: null });
                                }).catch(reason => {
                                    self.emit('result', { outcome: 'battery_failure', vrmId: vrmId, reason: reason });
                                }).finally(() => {
                                    socket.destroy();
                                });
                            } else {
                                self.emit('result', { outcome: 'success', vrmId: vrmId, reason: null });
                            }
                        }).catch(reason => {
                            self.emit('result', { outcome: 'vebus_failure', vrmId: vrmId, reason: reason });
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
