const { NodeSSH } = require('node-ssh');

function executeSSHCommand(user, privateKey, host, command) {
    if (privateKey.trim().length <= 0) {
        throw new Error(`Please configure a SSH key before using this action`);
    }

    const ssh = new NodeSSH();
    return ssh.connect({
        host: host,
        username: user,
        privateKey: privateKey
    }).then(function () {
        return ssh.execCommand(command).then(function (result) {
            console.log('STDOUT: ' + result.stdout)
            console.error('STDERR: ' + result.stderr)
            return result.stdout;
        }).catch(reason => {
            return Promise.reject(reason);
        });
    }).catch(reason => {
        return Promise.reject(reason);
    });
}

async function createChargingSchedule(user, privateKey, schedule, day, start, duration, soc, options) {
    if (privateKey.trim().length <= 0) {
        throw new Error(`Please configure a SSH key before using this action`);
    }

    //start = 22:00, convert to seconds since midnight
    const startSeconds = Number(start.substring(0, 2)) * 3600 + Number(start.substring(3, 5)) * 60
    //duration = 01:00, convert to seconds
    const durationSeconds = Number(duration.substring(0, 2)) * 3600 + Number(duration.substring(3, 5)) * 60

    const ssh = new NodeSSH();
    return ssh.connect({
        host: options.host,
        username: user,
        privateKey: privateKey
    }).then(async function () {
        let response = await ssh.execCommand(`dbus -y com.victronenergy.settings /Settings/CGwacs/BatteryLife/Schedule/Charge/${schedule}/Start SetValue ${startSeconds}`);
        if (response.stdout != '0') {
            throw new Error(`Failed to set start time for schedule ${schedule}, got response '${response.stdout}'`);
        }
        response = await ssh.execCommand(`dbus -y com.victronenergy.settings /Settings/CGwacs/BatteryLife/Schedule/Charge/${schedule}/Duration SetValue ${durationSeconds}`);
        if (response.stdout != '0') {
            throw new Error(`Failed to set duration for schedule ${schedule}, got response '${response.stdout}'`);
        }
        response = await ssh.execCommand(`dbus -y com.victronenergy.settings /Settings/CGwacs/BatteryLife/Schedule/Charge/${schedule}/Soc SetValue ${soc}`);
        if (response.stdout != '0') {
            throw new Error(`Failed to set SoC for schedule ${schedule}, got response '${response.stdout}'`);
        }
        if (day == '-7') {
            day = '%-7';
        }
        response = await ssh.execCommand(`dbus -y com.victronenergy.settings /Settings/CGwacs/BatteryLife/Schedule/Charge/${schedule}/Day SetValue ${day}`);
        if (response.stdout != '0') {
            throw new Error(`Failed to enable schedule ${schedule}, got response '${response.stdout}'`);
        }

        return true;
    }).catch(reason => {
        return Promise.reject(reason);
    });
}

module.exports = {
    executeSSHCommand,
    createChargingSchedule
};