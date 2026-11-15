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
  "onGround": false, "gearDown": false, "flapsPct": 0, "parkingBrake": false,
  "aircraftIcao": "C172", "callsign": "LV-ABC",
  "trueAirspeedKt": 114.2, "mach": 0.173, "gForce": 1.0, "aglFt": 2500,
  "fuelTotalKg": 91,
  "engineType": "piston",
  "engines": [{ "running": true, "fuelFlowKgH": 22.7, "rpm": 2302 }],
  "transponder": "1200", "com1Mhz": 118.1, "com1StandbyMhz": 121.5, "nav1Mhz": 110.3,
  "autopilot": { "engaged": true, "altitudeFt": 5000, "headingDeg": 270, "speedKt": 100, "verticalSpeedFpm": 700 },
  "wind": { "speedKt": 12, "directionDeg": 240 }, "oatC": 15, "altimeterSettingHpa": 1013.2,
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
| `aircraftIcao`, `callsign` | ICAO type designator and tail number set in the simulator | MSFS, when set |
| `indicatedAltitudeFt`, `indicatedAirspeedKt` | as shown on the instruments | when the backend provides it |
| `trueAirspeedKt`, `mach`, `gForce` | | MSFS only |
| `aglFt` | height above ground, feet | MSFS only |
| `pitchDeg` | nose-up positive | when available |
| `bankDeg` | right wing down positive | when available |
| `onGround`, `gearDown`, `flapsPct`, `parkingBrake` | `gearDown`/`flapsPct`/`parkingBrake`: MSFS only | |
| `fuelTotalKg` | total fuel on board, kg | MSFS only |
| `engineType` | `piston`, `jet`, `turboprop`, `turboshaft` | MSFS, when the aircraft has engines |
| `engines[]` | one entry per installed engine (max 4): `running`, `fuelFlowKgH`, plus `rpm` (piston, turboprop) or `n1Pct`/`n2Pct` (turbine) | MSFS, when the aircraft has engines |
| `transponder` | squawk, 4 digits as a string | MSFS only |
| `com1Mhz`, `com1StandbyMhz`, `nav1Mhz` | MHz | MSFS only |
| `autopilot` | `engaged`, and the selected `altitudeFt`, `headingDeg`, `speedKt`, `verticalSpeedFpm` | MSFS only |
| `wind` | `speedKt` and `directionDeg` (direction the wind blows from, degrees true) at the aircraft | MSFS only |
| `oatC` | outside air temperature, Celsius | MSFS only |
| `altimeterSettingHpa` | Kohlsman setting, hPa | MSFS only |

Field names carry their unit. Optional fields are omitted, not sent as `null`, and an aircraft with no engines (a glider) has no `engines` field rather than an empty or zero-filled one.

The extra (non-core) fields refresh about once per second, while position and attitude refresh at the full rate. Extras are requested separately from the core fields, so if a simulator or add-on aircraft does not provide one, the rest of the frame is unaffected.

## Backend notes

| Simulator | Source | Notes |
|---|---|---|
| MSFS 2020/2024, P3D, FSX | SimConnect through `node-simconnect` | Automatic. Core fields about every 10 sim frames, extras once per second. |
| X-Plane 11/12 | UDP Data Output on port 49000 | Needs rows 3, 4, 17 and 20 enabled. Core fields only for now. See [SETUP-XPLANE.md](SETUP-XPLANE.md). |

If several simulators are running, the agent publishes the one with the freshest sample. A source is dropped after 4 s without data.

## Browser access and origins

Any web page can open `ws://127.0.0.1`, so the agent checks the `Origin` header on both WebSocket upgrades and HTTP requests:

- no `Origin` (native apps, scripts, `curl`): allowed
- `localhost`, `127.0.0.1`, `[::1]` on any port, and Tauri (`tauri://localhost`, `http://tauri.localhost`): allowed
- anything else: `403`, unless added with `--allow-origin https://your.app` (or `AEROLINK_ALLOW_ORIGINS`)

## Versioning

`v` is the major protocol version. Adding optional fields does not change it. Renaming or removing a field, or changing a unit, does.

Planned for later versions: commands from client to agent (load a flight plan), and the same extra state for X-Plane.
