'use strict';
const net = require('net');

exports.pad = function (num, size) {
    var s = "000000000" + num;
    return s.substring(s.length - size);
}

exports.validateIPaddress = function (ipaddress) {
    if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ipaddress)) {
        return (true)
    } else {
        return (false)
    }
}

exports.isPortAvailable = function (address, port) {
    return new Promise((resolve => {
        const socket = new net.Socket();

        const onError = () => {
            socket.destroy();
            resolve(false);
        };

        socket.setTimeout(1000);
        socket.once('error', onError);
        socket.once('timeout', onError);

        socket.connect(port, address, () => {
            socket.end();
            resolve(true);
        });
    }));
}

exports.isError = function (err) {
    return (err && err.stack && err.message);
}

exports.createBuffer = function (numValue, factor) {
    let buffer = Buffer.alloc(2);
    buffer.writeInt16BE(numValue * factor);
    return buffer;
}