#!/usr/bin/env node
import net from 'net';
import { Command } from '../../constants/ospf.topo.js';

const HOST = 'localhost';
const ENABLE_PASSWORD = 'cisco';



function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function readUntil(socket, prompt = '#', timeout = 10000) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timeoutId = setTimeout(() => {
      socket.removeListener('data', onData);
      reject(new Error(`Timeout waiting for prompt: "${prompt}"`));
    }, timeout);

    const onData = (data) => {
      buffer += data.toString();
      // Check for prompt match based on type (string or regex)
      const isMatch = typeof prompt === 'string' 
        ? buffer.includes(prompt)
        : prompt.test(buffer);
      
      if (isMatch) {
        clearTimeout(timeoutId);
        socket.removeListener('data', onData);
        resolve(buffer);
      }
    };

    socket.on('data', onData);
  });
}

async function sendCommand(socket, cmd, prompt = '#') {
  console.log(`➡️ Sending: ${cmd}`);
  socket.write(`${cmd}\r\n`);
  const output = await readUntil(socket, prompt);
  console.log(`⬅️ Output:\n${output}`);
  await sleep(500);
  return output;
}

async function main(PORT,CONFIG_COMMANDS) {

  
  console.log("📡 Starting GNS3 router configuration...");
  const socket = new net.Socket();

  socket.connect(PORT, HOST, async () => {
    console.log(`✅ Connected to ${HOST}:${PORT}`);

    try {
      // Initial wake-up
      socket.write('\r\n');
      await sleep(1000);
      
      // Check initial state with string prompt
      let output = '';
      try {
        output = await readUntil(socket, /[>#]$/);
      } catch (err) {
        console.log("Initial prompt not found, trying again...");
        socket.write('\r\n');
        output = await readUntil(socket, /[>#]$/);
      }

      // Enter enable mode if needed
      if (output.trim().endsWith('>')) {
        await sendCommand(socket, 'enable', 'Password:');
        await sendCommand(socket, ENABLE_PASSWORD, '#');
      }

      // Send configuration commands
      for (const { cmd, prompt } of CONFIG_COMMANDS) {
        try {
          await sendCommand(socket, cmd, prompt);
        } catch (err) {
          console.error(`Error executing command "${cmd}": ${err.message}`);
          // Try to recover by sending a newline
          socket.write('\r\n');
          await sleep(500);
          // Try to get back to privileged exec mode
          await sendCommand(socket, 'end', '#');
          continue;
        }
      }

      console.log("✅ Configuration complete!");
      socket.end();
    } catch (err) {
      console.error(`❌ Error: ${err.message}`);
      socket.end();
    }
  });

  socket.on('error', (err) => {
    console.error(`❌ Socket error: ${err.message}`);
  });

  socket.on('close', () => {
    console.log('🔌 Connection closed');
  });
}



(async () => {
  for (const device of Command.slice(0, 3)) {
    await main(device.port, device.commands);
  }
})();








/*
  const  = [
  { cmd: 'configure terminal', prompt: '(config)#' },

  // Interface configuration (example for Fa0/0)
  { cmd: 'interface FastEthernet0/0', prompt: '(config-if)#' },
  { cmd: 'ip address 10.0.0.1 255.255.255.252', prompt: '(config-if)#' },
  { cmd: 'no shutdown', prompt: '(config-if)#' },
  { cmd: 'exit', prompt: '(config)#' },

  // OSPF configuration
  { cmd: 'router ospf 1', prompt: '(config-router)#' },
  { cmd: 'network 10.0.0.0 0.0.0.3 area 0', prompt: '(config-router)#' },

  // Loopback (optional, good for router ID)
  { cmd: 'exit', prompt: '(config)#' },
  { cmd: 'interface Loopback0', prompt: '(config-if)#' },
  { cmd: 'ip address 1.1.1.1 255.255.255.255', prompt: '(config-if)#' },
  { cmd: 'exit', prompt: '(config)#' },

  // Add loopback to OSPF
  { cmd: 'router ospf 1', prompt: '(config-router)#' },
  { cmd: 'network 1.1.1.1 0.0.0.0 area 0', prompt: '(config-router)#' },

  // Exit and save
  { cmd: 'end', prompt: '#' },
  { cmd: 'write memory', prompt: '#' },

  // Verification
  { cmd: 'show ip interface brief', prompt: '#' },
  { cmd: 'show ip ospf neighbor', prompt: '#' },
  { cmd: 'show ip route ospf', prompt: '#' }
];

*/