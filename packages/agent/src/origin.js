'use strict';
// Origin policy. A browser tab on any website can open ws://127.0.0.1, so without a check any page you visit could read
// your live position. Non-browser clients send no Origin header and are always allowed.

const BUILT_IN = [
  /^https?:\/\/localhost(:\d+)?$/i,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/\[::1\](:\d+)?$/,
  /^tauri:\/\/localhost$/i, // Tauri (macOS/Linux)
  /^https?:\/\/tauri\.localhost$/i, // Tauri (Windows)
];

function makeOriginCheck(extraAllowed = []) {
  const extra = new Set(extraAllowed.map((o) => o.replace(/\/$/, '').toLowerCase()));
  const allowAll = extra.has('*');
  return function isAllowed(origin) {
    if (!origin) return true; // not a browser
    if (allowAll) return true;
    const clean = String(origin).replace(/\/$/, '');
    if (extra.has(clean.toLowerCase())) return true;
    return BUILT_IN.some((re) => re.test(clean));
  };
}

module.exports = { makeOriginCheck };
