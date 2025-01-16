'use strict';

const modbus = require('jsmodbus');
const net = require('net');

class ModbusManager {
    static activeSockets = new Map(); // Maps host:port to {socket, refCount}
    static activeClients = new Map(); // Maps host:port:unitId to {modbusClient, refCount}

    constructor() {
    }

    async createConnection(host, port, unitId) {
        const clientKey = `${host}:${port}:${unitId}`;
        const existingClient = ModbusManager.activeClients.get(clientKey);

        if (existingClient) {
            console.log('INFO', `Returning existing modbus client for '${clientKey}'`);
            existingClient.refCount++;
            return existingClient.modbusClient;
        }

        console.log('INFO', `Creating new modbus client for '${clientKey}'`);
        const { socket, modbusClient } = await this.#createOrGetSocket(host, port, unitId);
        ModbusManager.activeClients.set(clientKey, { modbusClient, refCount: 1 });
        return modbusClient;
    }

    #createOrGetSocket(host, port, unitId) {
        const socketKey = `${host}:${port}`;
        const existingSocket = ModbusManager.activeSockets.get(socketKey);

        if (existingSocket) {
            console.log('INFO', `Rebuilding socket for '${socketKey}' to add new client`);
            // Close existing socket
            existingSocket.socket.end();
            ModbusManager.activeSockets.delete(socketKey);
            
            // Recreate all existing clients plus the new one
            const existingClients = Array.from(ModbusManager.activeClients.entries())
                .filter(([key]) => key.startsWith(socketKey))
                .map(([key]) => {
                    const [,, existingUnitId] = key.split(':');
                    return parseInt(existingUnitId);
                });
            
            if (!existingClients.includes(unitId)) {
                existingClients.push(unitId);
            }

            return new Promise((resolve, reject) => {
                let socket = new net.Socket();
                const modbusClients = existingClients.map(id => new modbus.client.TCP(socket, id));
                const newModbusClient = modbusClients.find(client => client.unitId === unitId);

                socket.on('connect', () => {
                    console.log('INFO', `Connected rebuilt socket for '${socketKey}' with ${existingClients.length} clients`);
                    ModbusManager.activeSockets.set(socketKey, { 
                        socket, 
                        refCount: existingClients.length 
                    });
                    
                    // Update all existing client references with new modbus clients
                    existingClients.forEach((id, index) => {
                        const clientKey = `${host}:${port}:${id}`;
                        const existingClient = ModbusManager.activeClients.get(clientKey);
                        if (existingClient) {
                            ModbusManager.activeClients.set(clientKey, {
                                modbusClient: modbusClients[index],
                                refCount: existingClient.refCount
                            });
                        }
                    });

                    resolve({ socket, modbusClient: newModbusClient });
                });

                socket.on('error', (error) => {
                    reject(error);
                });

                socket.on('close', function () {
                    console.log('INFO', `Closed Modbus client on IP '${host}' using port '${port}'`);
                });

                socket.connect({ host, port });
            });
        }

        // Handle new socket creation (no existing socket)
        return new Promise((resolve, reject) => {
            console.log('INFO', `Creating new socket for '${socketKey}'`);
            let socket = new net.Socket();
            const modbusClient = new modbus.client.TCP(socket, unitId);

            socket.on('connect', () => {
                console.log('INFO', `Connected socket for '${socketKey}'`);
                ModbusManager.activeSockets.set(socketKey, { socket, refCount: 1 });
                resolve({ socket, modbusClient });
            });

            socket.on('error', (error) => {
                reject(error);
            });

            socket.on('close', function () {
                console.log('INFO', `Closed Modbus client on IP '${host}' using port '${port}'`);
            });

            socket.connect({ host, port });
        });
    }

    closeConnection(host, port, unitId) {
        const clientKey = `${host}:${port}:${unitId}`;
        const socketKey = `${host}:${port}`;
        
        const client = ModbusManager.activeClients.get(clientKey);
        const socketInfo = ModbusManager.activeSockets.get(socketKey);

        if (client) {
            client.refCount--;

            if (client.refCount === 0) {
                ModbusManager.activeClients.delete(clientKey);
                
                if (socketInfo) {
                    socketInfo.refCount--;
                    
                    if (socketInfo.refCount === 0) {
                        console.log('DEBUG', `Closing last connection for ${socketKey}`);
                        socketInfo.socket.end();
                        ModbusManager.activeSockets.delete(socketKey);
                    }
                }
            }
            console.log('DEBUG', `Disconnected client ${clientKey}, ${client.refCount} client references remaining`);
            if (socketInfo) {
                console.log('DEBUG', `Socket ${socketKey} has ${socketInfo.refCount} references remaining`);
            }
        }
    }

    getClient(host, port, unitId) {
        const clientKey = `${host}:${port}:${unitId}`;
        const client = ModbusManager.activeClients.get(clientKey);
        
        if (!client) {
            return null;
        }
        
        return client.modbusClient;
    }

    isConnected(host, port, unitId) {
        const clientKey = `${host}:${port}:${unitId}`;
        const client = ModbusManager.activeClients.get(clientKey);
        
        if (!client || !client.modbusClient) {
            return false;
        }
        
        // Access the underlying socket through the Modbus client
        const socket = client.modbusClient.socket;
        return socket && 
               socket.readable && 
               socket.writable && 
               !socket.destroyed;
    }
}

//Singleton
module.exports = new ModbusManager();
