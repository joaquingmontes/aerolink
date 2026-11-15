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
