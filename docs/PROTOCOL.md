# AeroLink protocol v1

AeroLink publishes the state of the user's aircraft from a local agent to any number of local clients.

## Transport

| | |
|---|---|
| WebSocket | `ws://127.0.0.1:4388/aerolink` |
| HTTP snapshot | `GET http://127.0.0.1:4388/telemetry` (also `/status`) returns the same JSON once |
| Direction | Agent to client only (v1 is read-only) |
| Rate | One frame every 200 ms while at least one client is connected |
| Encoding | One JSON object per WebSocket text frame |

The agent binds to `127.0.0.1` only. It is not reachable from other machines.

## Frames

Every frame has `type: "telemetry"`, `v: 1` and a `connected` flag. Clients must ignore unknown fields so the protocol can grow without a version bump.

### Simulator not running

```json
{ "type": "telemetry", "v": 1, "connected": false, "sim": "Disconnected", "timestamp": 1760000000000 }
```

The agent is up but no simulator is delivering data. **No position is ever included**, and the agent never substitutes synthetic data (the opt-in `--mock` source identifies itself as `sim: "Mock"`).

### Simulator running

```json
{
  "type": "telemetry", "v": 1, "connected": true,
  "sim": "MSFS 2024",
  "aircraftTitle": "Cessna 172 Skyhawk",
  "lat": -34.8222, "lon": -58.5358,
  "altitudeFt": 3012.4, "indicatedAltitudeFt": 3000,
  "headingDeg": 271.5,
  "groundSpeedKt": 118.2, "indicatedAirspeedKt": 112,
  "verticalSpeedFpm": -50,
  "pitchDeg": 2.1, "bankDeg": -0.4,
  "onGround": false, "gearDown": false, "flapsPct": 0,
  "timestamp": 1760000000000
}
```

| Field | Unit / meaning | Always present |
|---|---|---|
| `sim` | `MSFS`, `MSFS 2024`, `Prepar3D`, `FSX`, `X-Plane`, `Mock` | yes |
| `lat`, `lon` | degrees, WGS84 | yes |
| `altitudeFt` | true altitude above MSL, feet | yes |
| `headingDeg` | true heading, 0 to 360 | yes |
| `groundSpeedKt` | knots | yes |
| `verticalSpeedFpm` | feet per minute, climb positive | yes |
| `timestamp` | ms since Unix epoch, taken when the agent sampled the simulator | yes |
| `aircraftTitle` | loaded aircraft title | MSFS only |
| `indicatedAltitudeFt`, `indicatedAirspeedKt` | as shown on the instruments | when the backend provides it |
| `pitchDeg` | nose-up positive | when available |
| `bankDeg` | right wing down positive | when available |
| `onGround`, `gearDown`, `flapsPct` | | `gearDown`/`flapsPct`: MSFS only |

Field names carry their unit. Optional fields are omitted, not sent as `null`.

## Backend notes

| Simulator | Source | Notes |
|---|---|---|
| MSFS 2020/2024, P3D, FSX | SimConnect through `node-simconnect` | Automatic. Sampled about every 10 sim frames. |
| X-Plane 11/12 | UDP Data Output on port 49000 | Needs rows 3, 4, 17 and 20 enabled. See [SETUP-XPLANE.md](SETUP-XPLANE.md). |

If several simulators are running, the agent publishes the one with the freshest sample. A source is dropped after 4 s without data.

## Browser access and origins

Any web page can open `ws://127.0.0.1`, so the agent checks the `Origin` header on both WebSocket upgrades and HTTP requests:

- no `Origin` (native apps, scripts, `curl`): allowed
- `localhost`, `127.0.0.1`, `[::1]` on any port, and Tauri (`tauri://localhost`, `http://tauri.localhost`): allowed
- anything else: `403`, unless added with `--allow-origin https://your.app` (or `AEROLINK_ALLOW_ORIGINS`)

## Versioning

`v` is the major protocol version. Adding optional fields does not change it. Renaming or removing a field, or changing a unit, does.

Planned for later versions: commands from client to agent (load a flight plan), more state (fuel, engines, radios, autopilot).
