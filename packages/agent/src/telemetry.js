'use strict';
// Holds the latest sample of every backend and decides what to publish. Never invents data: with no live source the
// frame is { connected: false }.

const PROTOCOL_VERSION = 1;
const STALE_MS = 4000;

class TelemetryStore {
  constructor() {
    this.sources = new Map();
  }

  /** Called by a backend with its newest sample, or null when its simulator went away. */
  report(source, sample) {
    if (sample) this.sources.set(source, sample);
    else this.sources.delete(source);
  }

  frame(now = Date.now()) {
    const live = [...this.sources.values()].filter((t) => now - t.timestamp < STALE_MS);
    if (live.length === 0) {
      return { type: 'telemetry', v: PROTOCOL_VERSION, connected: false, sim: 'Disconnected', timestamp: now };
    }
    live.sort((a, b) => b.timestamp - a.timestamp);
    return { type: 'telemetry', v: PROTOCOL_VERSION, ...live[0], connected: true };
  }
}

module.exports = { TelemetryStore, PROTOCOL_VERSION, STALE_MS };
