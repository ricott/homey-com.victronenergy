'use strict';

const Discovery = require('../lib/discovery.js');

let discovery = new Discovery();

discovery.on('result', message => {
    console.log(message);
});

discovery.validateConnection('192.168.200.90', 502, 227);
