/** AeroLink wire protocol, version 1. See docs/PROTOCOL.md. */

export const PROTOCOL_VERSION = 1 as const;

export type SimId = 'MSFS' | 'MSFS 2024' | 'Prepar3D' | 'FSX' | 'X-Plane' | 'Mock';

/** Sent when the agent is running but no simulator is delivering data. Never contains a position. */
export interface DisconnectedFrame {
  type: 'telemetry';
  v: typeof PROTOCOL_VERSION;
  connected: false;
  sim: 'Disconnected';
  timestamp: number;
}

export type EngineType = 'piston' | 'jet' | 'turboprop' | 'turboshaft';

export interface EngineState {
  running: boolean;
  fuelFlowKgH: number;
  /** Piston and turboprop engines */
  rpm?: number;
  /** Turbine engines */
  n1Pct?: number;
  n2Pct?: number;
}

export interface AutopilotState {
  engaged: boolean;
  /** Selected values, meaningful only while the matching mode is active */
  altitudeFt: number;
  headingDeg: number;
  speedKt: number;
  verticalSpeedFpm: number;
}

export interface WindState {
  speedKt: number;
  /** Direction the wind blows from, degrees true */
  directionDeg: number;
}

/** One sample of the user's aircraft. Units are part of the field name. */
export interface LiveFrame {
  type: 'telemetry';
  v: typeof PROTOCOL_VERSION;
  connected: true;
  sim: SimId | string;
  aircraftTitle?: string;
  /** Degrees, WGS84 */
  lat: number;
  lon: number;
  /** True altitude above MSL */
  altitudeFt: number;
  indicatedAltitudeFt?: number;
  /** True heading, 0-360 */
  headingDeg: number;
  groundSpeedKt: number;
  indicatedAirspeedKt?: number;
  verticalSpeedFpm: number;
  /** Nose-up positive */
  pitchDeg?: number;
  /** Right wing down positive */
  bankDeg?: number;
  onGround?: boolean;
  gearDown?: boolean;
  flapsPct?: number;
  parkingBrake?: boolean;

  /** ICAO type designator, e.g. C172 */
  aircraftIcao?: string;
  /** Tail number / callsign as set in the simulator */
  callsign?: string;

  trueAirspeedKt?: number;
  mach?: number;
  gForce?: number;
  /** Height above ground */
  aglFt?: number;

  fuelTotalKg?: number;
  engineType?: EngineType;
  /** One entry per installed engine; omitted when the aircraft has none */
  engines?: EngineState[];

  /** Squawk code, 4 digits */
  transponder?: string;
  com1Mhz?: number;
  com1StandbyMhz?: number;
  nav1Mhz?: number;

  autopilot?: AutopilotState;

  /** Ambient conditions at the aircraft */
  wind?: WindState;
  oatC?: number;
  /** Altimeter setting (Kohlsman), hPa */
  altimeterSettingHpa?: number;
  /** Milliseconds since the Unix epoch, set by the agent when the sample was taken */
  timestamp: number;
}

export type TelemetryFrame = LiveFrame | DisconnectedFrame;

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export const DEFAULT_PORT = 4388;
export const WS_PATH = '/aerolink';

export function isLiveFrame(frame: TelemetryFrame): frame is LiveFrame {
  return frame.connected === true;
}
