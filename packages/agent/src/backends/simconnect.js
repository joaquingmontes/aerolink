'use strict';
// MSFS 2020 / 2024, Prepar3D and FSX through SimConnect (optional dependency: node-simconnect).

const SOURCE = 'simconnect';

/** @param {{ store: import('../telemetry').TelemetryStore, log: (m: string) => void }} ctx */
function start({ store, log }) {
  let sc;
  try {
    sc = require('node-simconnect');
  } catch {
    log('node-simconnect is not installed: MSFS/P3D/FSX support disabled (run npm install).');
    return () => {};
  }
  const { open, Protocol, SimConnectDataType, SimConnectPeriod, SimConnectConstants } = sc;
  const DEF = 1;
  const REQ = 1;
  let connecting = false;
  let stopped = false;
  let timer = null;

  const retry = (ms) => {
    if (!stopped) timer = setTimeout(connect, ms);
  };

  const connect = () => {
    if (connecting || stopped) return;
    connecting = true;
    open('AeroLink', Protocol.FSX_SP2)
      .then(({ recvOpen, handle }) => {
        connecting = false;
        log(`Connected to ${recvOpen.applicationName}`);

        const num = (name, units) => handle.addToDataDefinition(DEF, name, units, SimConnectDataType.FLOAT64);
        num('PLANE LATITUDE', 'degrees');
        num('PLANE LONGITUDE', 'degrees');
        num('PLANE ALTITUDE', 'feet');
        num('INDICATED ALTITUDE', 'feet');
        num('PLANE HEADING DEGREES TRUE', 'degrees');
        num('GROUND VELOCITY', 'knots');
        num('AIRSPEED INDICATED', 'knots');
        num('VERTICAL SPEED', 'feet per minute');
        num('PLANE PITCH DEGREES', 'degrees');
        num('PLANE BANK DEGREES', 'degrees');
        num('SIM ON GROUND', 'bool');
        num('GEAR HANDLE POSITION', 'bool');
        num('FLAPS HANDLE PERCENT', 'percent');
        handle.addToDataDefinition(DEF, 'TITLE', null, SimConnectDataType.STRING256);

        // every ~10 sim frames (~3-6 Hz): smooth enough for a moving map
        handle.requestDataOnSimObject(REQ, DEF, SimConnectConstants.OBJECT_ID_USER, SimConnectPeriod.SIM_FRAME, 0, 0, 10);

        const simName = String(recvOpen.applicationName || '').toLowerCase().includes('2024') ? 'MSFS 2024' : 'MSFS';

        handle.on('simObjectData', (d) => {
          if (d.requestID !== REQ) return;
          const b = d.data;
          const lat = b.readFloat64();
          const lon = b.readFloat64();
          const altitudeFt = b.readFloat64();
          const indicatedAltitudeFt = b.readFloat64();
          const headingDeg = b.readFloat64();
          const groundSpeedKt = b.readFloat64();
          const indicatedAirspeedKt = b.readFloat64();
          const verticalSpeedFpm = b.readFloat64();
          const pitchDeg = b.readFloat64();
          const bankDeg = b.readFloat64();
          const onGround = b.readFloat64() > 0.5;
          const gearDown = b.readFloat64() > 0.5;
          const flapsPct = b.readFloat64();
          const aircraftTitle = b.readString256();
          store.report(SOURCE, {
            sim: simName,
            aircraftTitle,
            lat,
            lon,
            altitudeFt,
            indicatedAltitudeFt,
            headingDeg,
            groundSpeedKt,
            indicatedAirspeedKt,
            verticalSpeedFpm,
            pitchDeg: -pitchDeg, // SimConnect reports nose-down as positive
            bankDeg: -bankDeg,
            onGround,
            gearDown,
            flapsPct,
            timestamp: Date.now(),
          });
        });

        const lost = () => {
          store.report(SOURCE, null);
          log('Simulator connection closed, waiting for it to come back...');
          retry(4000);
        };
        handle.on('quit', lost);
        handle.on('close', lost);
        handle.on('exception', (e) => log(`SimConnect exception: ${JSON.stringify(e)}`));
      })
      .catch(() => {
        connecting = false;
        retry(5000); // simulator not running yet
      });
  };
  connect();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

module.exports = { start, SOURCE };
