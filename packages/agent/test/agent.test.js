'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startAgent } = require('../src');
const { applyDataPacket } = require('../src/backends/xplane');
const { makeOriginCheck } = require('../src/origin');
const { TelemetryStore } = require('../src/telemetry');

function connect(port, origin) {
  return new Promise((resolve, reject) => {
    // Node's global WebSocket cannot set Origin, so use a raw upgrade request for the origin tests
    const http = require('http');
    const req = http.request({
      host: '127.0.0.1', port, path: '/aerolink',
      headers: {
        Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': Buffer.from('aerolink-test-key').toString('base64'),
        ...(origin ? { Origin: origin } : {}),
      },
    });
    req.on('upgrade', (res, socket) => { socket.destroy(); resolve(res.statusCode); });
    req.on('response', (res) => resolve(res.statusCode));
    req.on('error', reject);
    req.end();
  });
}

test('store reports connected:false when there is no live source', () => {
  const f = new TelemetryStore().frame();
  assert.strictEqual(f.connected, false);
  assert.strictEqual(f.sim, 'Disconnected');
  assert.strictEqual(f.lat, undefined);
});

test('store drops stale samples and prefers the freshest source', () => {
  const s = new TelemetryStore();
  const now = Date.now();
  s.report('a', { sim: 'A', lat: 1, lon: 1, timestamp: now - 1000 });
  s.report('b', { sim: 'B', lat: 2, lon: 2, timestamp: now - 10 });
  assert.strictEqual(s.frame(now).sim, 'B');
  assert.strictEqual(s.frame(now + 60_000).connected, false);
});

test('origin policy: localhost/Tauri/no-origin allowed, other sites blocked, explicit allow works', () => {
  const check = makeOriginCheck(['https://app.example.com/']);
  assert.ok(check(undefined));
  assert.ok(check('http://localhost:5173'));
  assert.ok(check('http://tauri.localhost'));
  assert.ok(check('https://app.example.com'));
  assert.ok(!check('https://evil.example.org'));
});

test('X-Plane DATA packet decoding', () => {
  const row = (idx, vals) => {
    const b = Buffer.alloc(36);
    b.writeInt32LE(idx, 0);
    vals.forEach((v, i) => b.writeFloatLE(v, 4 + i * 4));
    return b;
  };
  const msg = Buffer.concat([Buffer.from('DATA\0'), row(20, [-34.5, -58.5, 5000, 4000, 0, 0, 0, 0]), row(17, [3, -2, 270, 270, 0, 0, 0, 0])]);
  const acc = {};
  assert.ok(applyDataPacket(msg, acc));
  assert.ok(Math.abs(acc.lat - -34.5) < 1e-4);
  assert.strictEqual(acc.altitudeFt, 5000);
  assert.strictEqual(acc.headingDeg, 270);
  assert.strictEqual(acc.onGround, false);
  assert.ok(!applyDataPacket(Buffer.from('NOPE'), {}));
});

test('agent serves mock telemetry over HTTP and WebSocket, and blocks foreign origins', async () => {
  const agent = await startAgent({ port: 0, mock: true });
  try {
    const res = await fetch(`http://127.0.0.1:${agent.port}/telemetry`);
    const body = await res.json();
    assert.strictEqual(body.v, 1);
    assert.strictEqual(body.connected, true);
    assert.strictEqual(body.sim, 'Mock');

    const frame = await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${agent.port}/aerolink`);
      ws.onmessage = (e) => { ws.close(); resolve(JSON.parse(e.data)); };
      ws.onerror = reject;
    });
    assert.strictEqual(frame.type, 'telemetry');
    assert.strictEqual(typeof frame.lat, 'number');

    assert.strictEqual(await connect(agent.port, 'http://localhost:3000'), 101);
    assert.strictEqual(await connect(agent.port, 'https://evil.example.org'), 403);
    const blocked = await fetch(`http://127.0.0.1:${agent.port}/telemetry`, { headers: { Origin: 'https://evil.example.org' } });
    assert.strictEqual(blocked.status, 403);
  } finally {
    await agent.stop();
  }
});
