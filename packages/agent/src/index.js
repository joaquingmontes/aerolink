'use strict';

const { TelemetryStore, PROTOCOL_VERSION } = require('./telemetry');
const { createServer } = require('./server');
const simconnect = require('./backends/simconnect');
const xplane = require('./backends/xplane');
const mock = require('./backends/mock');

/**
 * Starts AeroLink programmatically.
 * @param {{ port?: number, host?: string, allowOrigins?: string[], xplanePort?: number, mock?: boolean,
 *           log?: (msg: string) => void }} [options]
 */
async function startAgent(options = {}) {
  const { port = 4388, host, allowOrigins = [], xplanePort = 49000, mock: useMock = false, log = () => {} } = options;
  const store = new TelemetryStore();
  const prefixed = (tag) => (m) => log(`[${tag}] ${m}`);

  const stops = [];
  if (useMock) {
    stops.push(mock.start({ store }));
  } else {
    stops.push(simconnect.start({ store, log: prefixed('simconnect') }));
    stops.push(xplane.start({ store, log: prefixed('xplane'), xplanePort }));
  }

  const srv = createServer({ port, host, allowOrigins, store, log: prefixed('server') });
  const address = await srv.start();
  return {
    port: address.port,
    store,
    stop: async () => {
      stops.forEach((s) => s());
      await srv.stop();
    },
  };
}

module.exports = { startAgent, TelemetryStore, PROTOCOL_VERSION };
