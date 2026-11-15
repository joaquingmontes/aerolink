'use strict';
// MSFS 2020 / 2024, Prepar3D and FSX through SimConnect (optional dependency: node-simconnect).

const { CORE_VARS, EXTRA_VARS, defineVars, decodeVars, coreToFields, extrasToFields } = require('./simvars');

const SOURCE = 'simconnect';
const EXTRAS_FRESH_MS = 4000;

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
  const CORE_DEF = 1;
  const CORE_REQ = 1;
  const EXTRA_DEF = 2;
  const EXTRA_REQ = 2;
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

        defineVars(handle, CORE_DEF, CORE_VARS, SimConnectDataType);
        // every ~10 sim frames (~3-6 Hz): smooth enough for a moving map
        handle.requestDataOnSimObject(CORE_REQ, CORE_DEF, SimConnectConstants.OBJECT_ID_USER, SimConnectPeriod.SIM_FRAME, 0, 0, 10);

        // Extras are a separate definition so a variable the simulator does not know cannot break position/attitude
        defineVars(handle, EXTRA_DEF, EXTRA_VARS, SimConnectDataType);
        handle.requestDataOnSimObject(EXTRA_REQ, EXTRA_DEF, SimConnectConstants.OBJECT_ID_USER, SimConnectPeriod.SECOND, 0, 0, 0);

        const simName = String(recvOpen.applicationName || '').toLowerCase().includes('2024') ? 'MSFS 2024' : 'MSFS';
        let extras = null;
        let extrasAt = 0;

        handle.on('simObjectData', (d) => {
          try {
            if (d.requestID === EXTRA_REQ) {
              extras = extrasToFields(decodeVars(d.data, EXTRA_VARS));
              extrasAt = Date.now();
              return;
            }
            if (d.requestID !== CORE_REQ) return;
            const now = Date.now();
            const fields = coreToFields(decodeVars(d.data, CORE_VARS), simName);
            const fresh = extras && now - extrasAt < EXTRAS_FRESH_MS ? extras : {};
            store.report(SOURCE, { ...fresh, ...fields, timestamp: now });
          } catch (err) {
            log(`Could not decode a SimConnect reply: ${err.message}`);
          }
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
