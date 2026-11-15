'use strict';

const http = require('http');
const { acceptKey, textFrame, pongFrame, closeFrame, decodeFrames } = require('./ws');
const { makeOriginCheck } = require('./origin');

const WS_PATHS = new Set(['/aerolink']);

/**
 * @param {{ port: number, host?: string, allowOrigins?: string[], store: import('./telemetry').TelemetryStore,
 *           broadcastMs?: number, log?: (msg: string) => void }} opts
 */
function createServer(opts) {
  const { port, host = '127.0.0.1', allowOrigins = [], store, broadcastMs = 200, log = () => {} } = opts;
  const isAllowed = makeOriginCheck(allowOrigins);
  const clients = new Set();

  const server = http.createServer((req, res) => {
    const origin = req.headers.origin;
    if (!isAllowed(origin)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Origin not allowed. Start AeroLink with --allow-origin <origin> to permit it.');
      return;
    }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.url === '/telemetry' || req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(store.frame()));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`AeroLink is running on port ${port}`);
  });

  server.on('upgrade', (req, socket) => {
    const path = (req.url || '').split('?')[0];
    const key = req.headers['sec-websocket-key'];
    if (!key || !WS_PATHS.has(path)) {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    if (!isAllowed(req.headers.origin)) {
      log(`Rejected WebSocket from origin ${req.headers.origin}`);
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    socket.write(
      ['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${acceptKey(key)}`].join('\r\n') +
        '\r\n\r\n'
    );
    clients.add(socket);
    log(`Client connected (${clients.size})`);
    socket.write(textFrame(JSON.stringify(store.frame())));

    let pending = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      const { frames, rest } = decodeFrames(Buffer.concat([pending, chunk]));
      pending = rest;
      for (const f of frames) {
        if (f.opcode === 0x9) socket.write(pongFrame(f.payload));
        else if (f.opcode === 0x8) {
          socket.write(closeFrame());
          socket.end();
        }
      }
    });
    const drop = () => clients.delete(socket);
    socket.on('close', drop);
    socket.on('error', drop);
  });

  const timer = setInterval(() => {
    if (clients.size === 0) return;
    const frame = textFrame(JSON.stringify(store.frame()));
    for (const c of clients) {
      try {
        c.write(frame);
      } catch {
        clients.delete(c);
      }
    }
  }, broadcastMs);

  return {
    server,
    start: () => new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => resolve(server.address()));
    }),
    stop: () => {
      clearInterval(timer);
      for (const c of clients) c.destroy();
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

module.exports = { createServer, WS_PATHS };
