#!/usr/bin/env node
import net from 'net';
import { Command } from '../../constants/ospf.topo.js';

const HOST = 'localhost';


function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function readUntil(socket, prompt, timeout = 10000) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timeoutId = setTimeout(() => {
      socket.off('data', onData);
      reject(new Error(`Timeout waiting for prompt ${prompt}`));
    }, timeout);

    function onData(data) {
      buffer += data.toString();
      if (typeof prompt === 'string' ? buffer.includes(prompt) : prompt.test(buffer)) {
        clearTimeout(timeoutId);
        socket.off('data', onData);
        resolve(buffer);
      }
    }

    socket.on('data', onData);
  });
}

async function sendCommand(socket, cmd, prompt) {
  console.log(`➡️  ${cmd}`);
  socket.write(cmd + '\r\n');
  const out = await readUntil(socket, prompt);
  console.log(out.trim());
  await sleep(300);
  return out;
}

async function main(PORT,CONFIG_COMMANDS) {
  console.log('📡 Connecting to VPCS…');
  const socket = new net.Socket();

  socket.connect(PORT, HOST, async () => {
    console.log(`✅ Connected to ${HOST}:${PORT}`);

    // “Wake up” the VPCS console
    socket.write('\r\n');
    await sleep(500);

    // Wait for either “Press ENTER” or the PC prompt (e.g. “PC1>”)
    let intro = '';
    try {
      intro = await readUntil(socket, /(Press ENTER|>$)/);
    } catch (e) {
      console.warn('No intro message, proceeding anyway…');
    }
    if (/Press ENTER/.test(intro)) {
      socket.write('\r\n');
      await readUntil(socket, />/);
    }

    // Run your commands
    for (let { cmd, prompt } of CONFIG_COMMANDS) {
      try {
        await sendCommand(socket, cmd, prompt);
      } catch (err) {
        console.error(`⚠️  Failed "${cmd}": ${err.message}`);
      }
    }

    console.log('✅ VPCS configuration complete.');
    socket.end();
  });

  socket.on('error', err => console.error('❌ Socket error:', err.message));
  socket.on('close', () => console.log('🔌 Disconnected from VPCS'));
}


(async () => {
  for (const device of Command.slice(3, 6)) {
    await main(device.port, device.commands);
  }
})();
