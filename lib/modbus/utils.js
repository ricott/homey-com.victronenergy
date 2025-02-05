/**
 * Format socket error messages with detailed descriptions
 * @param {Error} error - The socket error object
 * @param {string} host - The host IP address
 * @param {number} port - The port number
 * @returns {string} Formatted error message
 */
function formatSocketError(error, host, port) {
    let message = `Socket error for ${host}:${port}: `;
    
    if (error.code === 'EHOSTUNREACH') {
        message += `Host unreachable - Device at ${host} is not responding or network route is unavailable`;
    } else if (error.code === 'ECONNREFUSED') {
        message += `Connection refused - No Modbus service running on port ${port}`;
    } else if (error.code === 'ETIMEDOUT') {
        message += `Connection timed out - Device at ${host} did not respond in time`;
    } else if (error.code === 'ENETUNREACH') {
        message += `Network unreachable - Check network connectivity`;
    } else {
        message += error.message || 'Unknown error';
    }
    
    return message;
}

/**
 * Get descriptive message for Modbus exception codes
 * @param {number} code - The Modbus exception code
 * @returns {string} Description of the exception
 */
function getModbusExceptionMessage(code) {
    const exceptionCodes = {
        1: 'Illegal Function (The function code received in the query is not recognized or allowed by the slave)',
        2: 'Illegal Data Address (The data address received in the query is not an allowable address for the slave)',
        3: 'Illegal Data Value (A value contained in the query data field is not an allowable value for the slave)',
        4: 'Slave Device Failure (An unrecoverable error occurred while the slave was attempting to perform the requested action)',
        5: 'Acknowledge (The slave has accepted the request but needs a long time to process it)',
        6: 'Slave Device Busy (The slave is engaged in processing a long-duration command)',
        8: 'Memory Parity Error (The slave detected a parity error in memory)',
        10: 'Gateway Path Unavailable (The gateway was unable to establish a connection to the target device). Wrong unitId for this device type.',
        11: 'Gateway Target Device Failed to Respond (The target device did not respond to the request)'
    };

    return exceptionCodes[code] || `Unknown Exception Code: ${code}`;
}

module.exports = {
    formatSocketError,
    getModbusExceptionMessage
}; 