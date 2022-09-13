'use strict';

var modbus = require('jsmodbus');
var net = require('net');

let socket = new net.Socket();
let client100 = new modbus.client.TCP(socket, 100, 5000);
let client225 = new modbus.client.TCP(socket, 225, 5000);
let client227 = new modbus.client.TCP(socket, 227, 5000);
let options = {
    host: "192.168.200.90",
    port: 502,
};

socket.on('connect', function () {
    console.log(`Client connected on IP '${options.host}'`);
    let startTime = new Date().getTime();
    Promise.all([

        //client225.readHoldingRegisters(3126, 1), //Inverter on/off/eco 2/4/5
        //client100.readHoldingRegisters(2902, 1),
        //client227.readHoldingRegisters(33, 1),
        //client227.readHoldingRegisters(39, 1),

        //client225.readHoldingRegisters(1290, 1),
        //client225.readHoldingRegisters(1291, 1),
        //client225.readHoldingRegisters(286, 1),
        //client225.readHoldingRegisters(287, 1),
        //client225.readHoldingRegisters(288, 1),
        client225.readHoldingRegisters(301, 1),
        client225.readHoldingRegisters(302, 1),


    ]).then((results) => {
        let endTime = new Date().getTime();

        for (let index = 0; index < results.length; index++) {
            let result = results[index];

            //console.log(result.response);
            console.log(result.response._body._valuesAsBuffer.readInt16BE(0));

        }

        console.log(`Execution time: ${endTime-startTime}`);

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



