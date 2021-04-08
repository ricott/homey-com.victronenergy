'use strict';

const { App } = require('homey');
const { Log } = require('homey-log');

class VictronEnergyApp extends App {
  async onInit() {
    this.homeyLog = new Log({ homey: this.homey });
    this.log('Victron Energy app has been initialized');
  }
}

module.exports = VictronEnergyApp;