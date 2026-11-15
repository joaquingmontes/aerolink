'use strict';
// Opt-in synthetic source (--mock) for developing and testing clients without a simulator running.
// It always identifies itself as sim "Mock", so a client can never mistake it for a real aircraft.

const SOURCE = 'mock';

/** @param {{ store: import('../telemetry').TelemetryStore }} ctx */
function start({ store }) {
  const t0 = Date.now();
  const tick = () => {
    const s = (Date.now() - t0) / 1000;
    const heading = (s * 6) % 360;
    store.report(SOURCE, {
      sim: 'Mock',
      aircraftTitle: 'AeroLink Mock Aircraft',
      lat: -34.8222 + 0.05 * Math.sin(s / 20),
      lon: -58.5358 + 0.05 * Math.cos(s / 20),
      altitudeFt: 3000 + 500 * Math.sin(s / 10),
      headingDeg: heading,
      groundSpeedKt: 120,
      indicatedAirspeedKt: 118,
      verticalSpeedFpm: Math.round(3000 * Math.cos(s / 10)),
      pitchDeg: 2,
      bankDeg: 0,
      onGround: false,
      timestamp: Date.now(),
    });
  };
  tick();
  const timer = setInterval(tick, 250);
  return () => clearInterval(timer);
}

module.exports = { start, SOURCE };
