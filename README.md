# AeroLink

One local agent and one protocol for flight simulator telemetry.

MSFS, Prepar3D, FSX and X-Plane each expose position and state differently (SimConnect, UDP Data Output, ...). AeroLink reads all of them and serves the same JSON over a local WebSocket, so a tool you build (a moving map, an EFB, an overlay, a logger) integrates once.

```
 MSFS / P3D / FSX ──SimConnect──┐
                                ├──►  aerolink agent  ──ws://127.0.0.1:4388/aerolink──►  your app
 X-Plane ──────────UDP──────────┘
```

- Runs on the pilot's PC, binds to `127.0.0.1` only.
- Never fabricates data: with no simulator running it sends `{ "connected": false }`.
- Blocks browser pages from other sites from reading your position (see [origins](docs/PROTOCOL.md#browser-access-and-origins)).
- Zero runtime dependencies for the X-Plane path; MSFS/P3D/FSX uses the optional `node-simconnect`.

## Quick start

```bash
npm install
npm run agent            # real simulators
npm run agent:mock       # synthetic aircraft, for developing clients (sim: "Mock")
```

Options: `--port`, `--xplane-port`, `--allow-origin <url>`, `--mock` (`aerolink --help`).
X-Plane needs a one-time Data Output setup: [docs/SETUP-XPLANE.md](docs/SETUP-XPLANE.md).

## Use it from TypeScript

```ts
import { AeroLink } from '@aerolink/client';

const link = new AeroLink();
link.onFrame((f) => {
  if (f.connected) console.log(f.sim, f.lat, f.lon, f.altitudeFt, f.groundSpeedKt);
});
link.start();
```

Or without any library, from a plain script:

```js
const ws = new WebSocket('ws://127.0.0.1:4388/aerolink');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

More in [examples/](examples/). The wire format is specified in [docs/PROTOCOL.md](docs/PROTOCOL.md).

## Layout

| Path | What |
|---|---|
| `packages/agent` | The local agent (`aerolink`). Backends live in `src/backends/`, one file per simulator. |
| `packages/protocol` | TypeScript types and constants for the protocol. |
| `packages/client` | Auto-reconnecting TypeScript client. |
| `docs/` | Protocol spec and simulator setup. |

## Adding a simulator

A backend is one file in `packages/agent/src/backends/` exporting `start({ store, log })`. It calls `store.report('<source>', sample)` with a sample using the fields from the protocol, and `store.report('<source>', null)` when its simulator goes away. It returns a function that stops it. See `xplane.js` for a complete example, then register it in `src/index.js`.

## Tests

```bash
npm test
npm run typecheck
```

## Contributing

Contributions are welcome: bug reports, new simulator backends, protocol proposals and documentation.

**Reporting a bug.** Open an issue with the simulator and version (for example MSFS 2024 or X-Plane 12.1), your OS, the Node version, the agent's console output, and what you expected versus what you got. For wrong values, include a frame from `http://127.0.0.1:4388/telemetry`.

**Setting up.**

```bash
git clone https://github.com/joaquingmontes/aerolink.git
cd aerolink
npm install
npm run agent:mock       # runs without a simulator
npm test
npm run typecheck
```

**Sending a pull request.**

1. For anything beyond a small fix, open an issue first so we can agree on the approach.
2. Keep the change focused and add or update tests in `packages/agent/test` (packet decoding and protocol behaviour are easy to cover without a simulator).
3. Make sure `npm test` and `npm run typecheck` pass.

**Rules for the code.**

- Never fabricate data. With no simulator delivering samples the agent reports `connected: false` and no position. Synthetic data is only allowed in the opt-in `--mock` source, which identifies itself as `sim: "Mock"`.
- Protocol changes follow [docs/PROTOCOL.md](docs/PROTOCOL.md#versioning): adding an optional field is fine, renaming or removing a field or changing a unit needs a new major version. Field names carry their unit, and absent values are omitted rather than sent as `null`.
- The agent stays dependency-free. A simulator SDK may be an optional dependency, loaded lazily so the agent still runs without it.
- Document any simulator-side setup in `docs/` (see `docs/SETUP-XPLANE.md`).

By contributing you agree that your work is released under the [MIT License](LICENSE).

## Status

Early (v0.1). Read-only, one aircraft. Planned: commands to the simulator (load a flight plan), fuel, engines, radios and autopilot state.

## License

MIT
