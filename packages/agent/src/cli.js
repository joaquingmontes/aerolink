#!/usr/bin/env node
'use strict';

const { startAgent } = require('./index');

function parseArgs(argv) {
  const out = { allowOrigins: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port') out.port = Number(argv[++i]);
    else if (a === '--xplane-port') out.xplanePort = Number(argv[++i]);
    else if (a === '--allow-origin') out.allowOrigins.push(argv[++i]);
    else if (a === '--mock') out.mock = true;
    else if (a === '-h' || a === '--help') out.help = true;
    else {
      console.error(`Unknown option: ${a}`);
      out.help = true;
    }
  }
  if (process.env.AEROLINK_ALLOW_ORIGINS) {
    out.allowOrigins.push(...process.env.AEROLINK_ALLOW_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean));
  }
  return out;
}

const HELP = `AeroLink - local flight simulator telemetry bridge

Usage: aerolink [options]

  --port <n>             WebSocket/HTTP port (default 4388)
  --xplane-port <n>      UDP port X-Plane sends Data Output to (default 49000)
  --allow-origin <url>   Allow a browser origin (repeatable, or "*" for any). localhost and Tauri are always allowed.
                         Also via AEROLINK_ALLOW_ORIGINS=url1,url2
  --mock                 Serve synthetic telemetry (sim: "Mock") for client development
  -h, --help             Show this help
`;

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  process.stdout.write(HELP);
  process.exit(0);
}

startAgent({ ...args, log: (m) => console.log(m) })
  .then(({ port }) => {
    console.log('========================================================');
    console.log(`AEROLINK READY ON http://127.0.0.1:${port}`);
    console.log(`   - WebSocket: ws://127.0.0.1:${port}/aerolink`);
    if (args.mock) {
      console.log('   - MOCK MODE: synthetic aircraft (sim: "Mock")');
    } else {
      console.log('   - MSFS 2020/2024/P3D/FSX: automatic (SimConnect)');
      console.log(`   - X-Plane: enable Data Output rows 3, 4, 17, 20 -> 127.0.0.1:${args.xplanePort || 49000}`);
      console.log('   - No simulator running = { connected: false } (never fake data)');
    }
    console.log('========================================================');
  })
  .catch((err) => {
    console.error(err.code === 'EADDRINUSE' ? `Port ${args.port || 4388} is already in use.` : err);
    process.exit(1);
  });
