// Logs one CSV row per second while a simulator is connected.
//   node examples/log-csv.js > flight.csv          (Node 22+ for the global WebSocket)
const ws = new WebSocket('ws://127.0.0.1:4388/aerolink');
let last = 0;

console.log('time_utc,sim,lat,lon,altitude_ft,heading_deg,gs_kt,vs_fpm');
ws.onmessage = (e) => {
  const f = JSON.parse(e.data);
  if (!f.connected || f.timestamp - last < 1000) return;
  last = f.timestamp;
  console.log([new Date(f.timestamp).toISOString(), f.sim, f.lat, f.lon, Math.round(f.altitudeFt), Math.round(f.headingDeg), Math.round(f.groundSpeedKt), Math.round(f.verticalSpeedFpm)].join(','));
};
ws.onerror = () => {
  console.error('Could not reach the AeroLink agent. Is it running?');
  process.exit(1);
};
