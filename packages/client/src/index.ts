import {
  DEFAULT_PORT,
  WS_PATH,
  type ConnectionState,
  type TelemetryFrame,
} from '@aerolink/protocol';

export * from '@aerolink/protocol';

export interface AeroLinkOptions {
  /** Defaults to ws://127.0.0.1:4388/aerolink */
  url?: string;
  /** Delay before reconnecting after the agent goes away (ms). Default 3000. */
  reconnectMs?: number;
  /** WebSocket implementation; defaults to the global one (browsers, Node 22+). */
  WebSocketImpl?: typeof WebSocket;
}

type FrameListener = (frame: TelemetryFrame) => void;
type StateListener = (state: ConnectionState, detail: string) => void;

/**
 * Connects to a local AeroLink agent and keeps the connection alive.
 *
 *   const link = new AeroLink();
 *   link.onFrame((f) => f.connected && console.log(f.lat, f.lon));
 *   link.start();
 */
export class AeroLink {
  private ws: WebSocket | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private state: ConnectionState = 'disconnected';
  private detail = 'Disconnected';
  private latest: TelemetryFrame | null = null;
  private frameListeners = new Set<FrameListener>();
  private stateListeners = new Set<StateListener>();
  private readonly url: string;
  private readonly reconnectMs: number;
  private readonly WS: typeof WebSocket;

  constructor(options: AeroLinkOptions = {}) {
    this.url = options.url ?? `ws://127.0.0.1:${DEFAULT_PORT}${WS_PATH}`;
    this.reconnectMs = options.reconnectMs ?? 3000;
    this.WS = options.WebSocketImpl ?? globalThis.WebSocket;
    if (!this.WS) throw new Error('No WebSocket implementation available; pass options.WebSocketImpl');
  }

  /** Latest frame received, or null before the first one. */
  get lastFrame(): TelemetryFrame | null {
    return this.latest;
  }

  get connectionState(): ConnectionState {
    return this.state;
  }

  onFrame(fn: FrameListener): () => void {
    this.frameListeners.add(fn);
    if (this.latest) fn(this.latest);
    return () => this.frameListeners.delete(fn);
  }

  onState(fn: StateListener): () => void {
    this.stateListeners.add(fn);
    fn(this.state, this.detail);
    return () => this.stateListeners.delete(fn);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.open();
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.setState('disconnected', 'Disconnected');
  }

  private open(): void {
    this.setState('connecting', 'Looking for the AeroLink agent...');
    let socket: WebSocket;
    try {
      socket = new this.WS(this.url);
    } catch {
      this.scheduleRetry();
      return;
    }
    this.ws = socket;

    socket.onopen = () => this.setState('connecting', 'Agent running, waiting for the simulator...');

    socket.onmessage = (event: MessageEvent) => {
      let frame: TelemetryFrame;
      try {
        frame = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (!frame || frame.type !== 'telemetry') return;
      this.latest = frame;
      if (frame.connected) this.setState('connected', frame.sim);
      else if (this.state === 'connected') this.setState('connecting', 'Agent running, waiting for the simulator...');
      this.frameListeners.forEach((fn) => fn(frame));
    };

    socket.onerror = () => socket.close();
    socket.onclose = () => {
      this.ws = null;
      if (this.state === 'connected') this.setState('disconnected', 'Agent disconnected');
      this.scheduleRetry();
    };
  }

  private scheduleRetry(): void {
    if (!this.running) return;
    this.timer = setTimeout(() => this.open(), this.reconnectMs);
  }

  private setState(state: ConnectionState, detail: string): void {
    this.state = state;
    this.detail = detail;
    this.stateListeners.forEach((fn) => fn(state, detail));
  }
}
