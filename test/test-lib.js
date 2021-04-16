'use strict';

const Victron = require('../lib/victron.js');

let victron = new Victron({
    host: '192.168.200.90',
    port: 502,
    vebusUnitId: 224,
    refreshInterval: 5
});

victron.on('readings', readings => {
    console.log(readings);
});

victron.on('properties', props => {
    console.log(props);
});
