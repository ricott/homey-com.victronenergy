'use strict';

const Victron = require('../lib/victron.js');
const config = require('./config.js');

let victron = new Victron({
    debug: true,
    host: '192.168.200.90',
    port: 502,
    vebusUnitId: 227,
    refreshInterval: 10
});
victron.on('readings', readings => {
    console.log('Victron 1');
    console.log(readings.essMode);
});

// victron.on('properties', props => {
//     console.log('Victron 1');
//     console.log(props);
// });

// victron.enableChargingSchedule('root', config.private_key, 1).then(res => {
//     console.log(res);
// });

/*
victron.disableChargingSchedule('root', 'etaQte4WbgeT', 1).then(res => {
    console.log(res);
});
*/

/*
victron.isChargingScheduleEnabled('root', 'etaQte4WbgeT', 1).then(res => {
    console.log(res);
});
*/

/*
(async () => {

    const resp = await victron.createChargingSchedule('root', 'etaQte4WbgeT', 1, 7, '11:15', '00:30', 5);
    console.log(resp);

})().catch(err => console.log(err.stack));
*/

/*
Monday=1
Tuesday=2
Wednesday=3
Thursday=4
Friday=5
Saturday=6
Sunday=0
Every day=7
Weekdays=8
Weekends=9
*/
