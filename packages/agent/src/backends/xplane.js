'use strict';
// X-Plane 11 / 12 through UDP "Data Output". Needs rows 3, 4, 17 and 20 enabled (see docs/SETUP-XPLANE.md).

const dgram = require('dgram');

const SOURCE = 'xplane';

/** Decodes an X-Plane "DATA" datagram into the partial state it carries (exported for tests). */
function applyDataPacket(msg, acc) {
  if (msg.length < 5 + 36 || msg.toString('utf8', 0, 4) !== 'DATA') return false;
  for (let off = 5; off + 36 <= msg.length; off += 36) {
    const idx = msg.readInt32LE(off);
    const v = (i) => msg.readFloatLE(off + 4 + i * 4);
    if (idx === 3) {
      acc.indicatedAirspeedKt = v(0);
      acc.groundSpeedKt = v(3);
    } else if (idx === 4) {
      acc.verticalSpeedFpm = v(2);
    } else if (idx === 17) {
      acc.pitchDeg = v(0);
      acc.bankDeg = v(1);
      acc.headingDeg = v(2); // true heading
    } else if (idx === 20) {
      acc.lat = v(0);
      acc.lon = v(1);
      acc.altitudeFt = v(2);
      acc.onGround = v(3) < 5; // altitude above ground (ft)
    }
  }
  return true;
}

/** @param {{ store: import('../telemetry').TelemetryStore, log: (m: string) => void, xplanePort?: number }} ctx */
function start({ store, log, xplanePort = 49000 }) {
  const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  sock.on('error', (err) => log(`X-Plane UDP unavailable: ${err.message}`));

  const acc = {
    lat: null, lon: null, altitudeFt: 0, headingDeg: 0, pitchDeg: 0, bankDeg: 0,
    groundSpeedKt: 0, indicatedAirspeedKt: 0, verticalSpeedFpm: 0, onGround: false,
  };

  sock.on('message', (msg) => {
    if (!applyDataPacket(msg, acc)) return;
    if (acc.lat == null || acc.lon == null) return;
    store.report(SOURCE, {
      sim: 'X-Plane',
      lat: acc.lat,
      lon: acc.lon,
      altitudeFt: acc.altitudeFt,
      headingDeg: acc.headingDeg,
      groundSpeedKt: acc.groundSpeedKt,
      indicatedAirspeedKt: acc.indicatedAirspeedKt,
      verticalSpeedFpm: acc.verticalSpeedFpm,
      pitchDeg: acc.pitchDeg,
      bankDeg: acc.bankDeg,
      onGround: acc.onGround,
      timestamp: Date.now(),
    });
  });

  sock.bind(xplanePort, () => log(`Listening for X-Plane data output on UDP ${xplanePort}`));
  return () => {
    try { sock.close(); } catch { /* already closed */ }
  };
}

module.exports = { start, applyDataPacket, SOURCE };
