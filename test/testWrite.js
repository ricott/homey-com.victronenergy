'use strict';

var modbus = require('jsmodbus');
var net = require('net');

let socket = new net.Socket();
let client100 = new modbus.client.TCP(socket, 100, 5000);
let client227 = new modbus.client.TCP(socket, 227, 5000);
let options = {
    host: "192.168.200.90",
    port: 502,
};

let buffer = Buffer.alloc(2);
buffer.writeInt16BE(1);

socket.on('connect', function () {
    console.log(`Client connected on IP '${options.host}'`);
    Promise.all([

        //client100.writeMultipleRegisters(2902, buffer) // Disable inverter
        //client227.writeMultipleRegisters(33, buffer) // 1=Charger Only;2=Inverter Only;3=On;4=Off
        client100.writeMultipleRegisters(2902, buffer) // 1=ESS with Phase Compensation;2=ESS without phase compensation;3=Disabled/External Control

    ]).then((results) => {

        console.log(results[0].response);

    }).catch((err) => {
        console.log('error', err);
    }).finally(function () {
        socket.destroy();
    });
});

socket.on('error', function (err) {
    console.log('error', err);
});

socket.on('close', function () {
    console.log(`Client closed for IP '${options.host}'`);
});

socket.connect(options);



