'use strict';

const modbus = require('jsmodbus');
const net = require('net');
const EventEmitter = require('events');
const config = require('./const.js');
const { GX } = require('./devices/gx.js');

class Validator extends EventEmitter {

    validateConnection(address, port, vebusUnitId, batteryUnitId, gridUnitId) {
        var self = this;
        self.socket = new net.Socket();
        //Default client is 100, all GX devices have it
        let systemClient = new modbus.client.TCP(self.socket, config.gxSystemUnitId);
        //Get vebus unitId from input
        let vebusClient = new modbus.client.TCP(self.socket, vebusUnitId);
        //Battery unitId from input
        let batteryClient = null;
        if (batteryUnitId > 0) {
            batteryClient = new modbus.client.TCP(self.socket, batteryUnitId);
        }
        //Grid unitId from input
        let gridClient = null;
        if (gridUnitId > 0) {
            gridClient = new modbus.client.TCP(self.socket, gridUnitId);
        }

        let vrmId = null;

        self.socket.on('connect', async () => {
            console.log(`IP '${address}' and port ${port} validated successfully`);

            // Validate system
            systemClient.readHoldingRegisters(GX.vrmId.registryId, GX.vrmId.count)
                .then((result) => {
                    vrmId = result.response._body._valuesAsBuffer.toString('utf8');
                    // Validate vebus
                    vebusClient.readHoldingRegisters(GX.switchPosition.registryId, GX.switchPosition.count)
                        .then(() => {
                            if (batteryClient) {
                                // Validate battery
                                batteryClient.readHoldingRegisters(GX.timeSinceLastFullCharge.registryId, GX.timeSinceLastFullCharge.count)
                                    .then(() => {
                                        if (gridClient) {
                                            // Validate grid
                                            gridClient.readHoldingRegisters(GX.totalEnergyForward.registryId, GX.totalEnergyForward.count)
                                                .then(() => {
                                                    self.emit('result', { outcome: 'success', vrmId: vrmId, reason: null });
                                                }).catch(reason => {
                                                    self.emit('result', { outcome: 'grid_failure', vrmId: vrmId, reason: reason });
                                                });
                                        } else {
                                            self.emit('result', { outcome: 'success', vrmId: vrmId, reason: null });
                                        }
                                    }).catch(reason => {
                                        self.emit('result', { outcome: 'battery_failure', vrmId: vrmId, reason: reason });
                                    });
                            } else if (gridClient) {
                                // Validate grid
                                gridClient.readHoldingRegisters(GX.totalEnergyForward.registryId, GX.totalEnergyForward.count)
                                    .then(() => {
                                        self.emit('result', { outcome: 'success', vrmId: vrmId, reason: null });
                                    }).catch(reason => {
                                        self.emit('result', { outcome: 'grid_failure', vrmId: vrmId, reason: reason });
                                    });
                            } else {
                                self.emit('result', { outcome: 'success', vrmId: vrmId, reason: null });
                            }
                        }).catch(reason => {
                            self.emit('result', { outcome: 'vebus_failure', vrmId: vrmId, reason: reason });
                        });
                }).catch(reason => {
                    if (self.socket) {
                        try {
                            self.socket.destroy();
                        } catch (ignore) { }
                    }
                    self.emit('result', { outcome: 'connect_failure', vrmId: null, reason: reason });
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
