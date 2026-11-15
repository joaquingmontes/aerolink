'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { CORE_VARS, EXTRA_VARS, defineVars, decodeVars, coreToFields, extrasToFields } = require('../src/backends/simvars');

// Fake SimConnect pieces: a handle that records definitions, and a reader that hands values back in order
const DataType = { FLOAT64: 'f64', STRING256: 's256' };
const fakeReader = (values) => {
  const queue = [...values];
  return { readFloat64: () => queue.shift(), readString256: () => queue.shift() };
};

test('every table has unique keys and valid entries', () => {
  for (const table of [CORE_VARS, EXTRA_VARS]) {
    const keys = table.map((v) => v.key);
    assert.strictEqual(new Set(keys).size, keys.length);
    for (const v of table) assert.ok(v.name && (v.type === 'str' || v.units), v.key);
  }
});

test('definitions are registered in the same order the reply is decoded', () => {
  const registered = [];
  defineVars({ addToDataDefinition: (id, name, units, type) => registered.push({ id, name, units, type }) }, 7, EXTRA_VARS, DataType);
  assert.deepStrictEqual(registered.map((r) => r.name), EXTRA_VARS.map((v) => v.name));
  assert.ok(registered.every((r) => r.id === 7));
  const strings = EXTRA_VARS.filter((v) => v.type === 'str').length;
  assert.strictEqual(registered.filter((r) => r.type === 's256').length, strings);

  const raw = decodeVars(fakeReader(EXTRA_VARS.map((v) => (v.type === 'str' ? `s:${v.key}` : EXTRA_VARS.indexOf(v)))), EXTRA_VARS);
  EXTRA_VARS.forEach((v, i) => assert.strictEqual(raw[v.key], v.type === 'str' ? `s:${v.key}` : i));
});

test('core fields: unit-preserving, pitch and bank flipped to nose-up / right-down', () => {
  const raw = Object.fromEntries(CORE_VARS.map((v) => [v.key, v.type === 'str' ? 'Cessna 172\0junk' : 1]));
  Object.assign(raw, { lat: -34.8, lon: -58.5, pitchDeg: 3, bankDeg: -2, onGround: 0, gearDown: 1, flapsPct: 25 });
  const f = coreToFields(raw, 'MSFS 2024');
  assert.strictEqual(f.sim, 'MSFS 2024');
  assert.strictEqual(f.aircraftTitle, 'Cessna 172');
  assert.strictEqual(f.pitchDeg, -3);
  assert.strictEqual(f.bankDeg, 2);
  assert.strictEqual(f.onGround, false);
  assert.strictEqual(f.gearDown, true);
});

const baseExtras = () => {
  const raw = Object.fromEntries(EXTRA_VARS.map((v) => [v.key, v.type === 'str' ? '' : 0]));
  return Object.assign(raw, {
    atcModel: 'C172', atcId: 'LV-ABC', trueAirspeedKt: 112.34, mach: 0.1712, gForce: 1.0049, aglFt: 2500.4,
    fuelTotalLb: 200, transponder: 1200, com1Mhz: 118.1000001, com1StandbyMhz: 121.5, nav1Mhz: 110.3,
    apMaster: 1, apAltitudeFt: 5000, apHeadingDeg: 270, apSpeedKt: 100, apVerticalSpeedFpm: 700,
    windSpeedKt: 12.4, windDirectionDeg: 240, oatC: 14.96, kohlsmanInHg: 29.92,
  });
};

test('piston single: kg conversion, rpm only, no turbine fields', () => {
  const raw = baseExtras();
  Object.assign(raw, { numEngines: 1, engineType: 0, eng1Running: 1, eng1Rpm: 2301.7, eng1FuelFlowPph: 50, eng1N1: 99, eng1N2: 99 });
  const f = extrasToFields(raw);
  assert.strictEqual(f.aircraftIcao, 'C172');
  assert.strictEqual(f.callsign, 'LV-ABC');
  assert.strictEqual(f.fuelTotalKg, 91); // 200 lb
  assert.strictEqual(f.engineType, 'piston');
  assert.deepStrictEqual(f.engines, [{ running: true, fuelFlowKgH: 22.7, rpm: 2302 }]);
  assert.strictEqual(f.transponder, '1200');
  assert.strictEqual(f.com1Mhz, 118.1);
  assert.strictEqual(f.altimeterSettingHpa, 1013.2);
  assert.deepStrictEqual(f.wind, { speedKt: 12, directionDeg: 240 });
  assert.deepStrictEqual(f.autopilot, { engaged: true, altitudeFt: 5000, headingDeg: 270, speedKt: 100, verticalSpeedFpm: 700 });
});

test('twin jet: only as many engines as exist, with N1/N2', () => {
  const raw = baseExtras();
  Object.assign(raw, { numEngines: 2, engineType: 1, eng1Running: 1, eng2Running: 0, eng1N1: 85.26, eng1N2: 92, eng1FuelFlowPph: 2000, eng3N1: 77 });
  const f = extrasToFields(raw);
  assert.strictEqual(f.engines.length, 2);
  assert.deepStrictEqual(f.engines[0], { running: true, fuelFlowKgH: 907.2, n1Pct: 85.3, n2Pct: 92 });
  assert.strictEqual(f.engines[1].running, false);
  assert.strictEqual(f.engines[0].rpm, undefined);
});

test('no engines (glider) and unknown engine type: engine data is omitted, not zero-filled', () => {
  const glider = extrasToFields({ ...baseExtras(), numEngines: 0, engineType: 2 });
  assert.strictEqual(glider.engines, undefined);
  assert.strictEqual(glider.engineType, undefined);
});

test('transponder is a zero-padded 4 digit code; missing strings are omitted', () => {
  const f = extrasToFields({ ...baseExtras(), transponder: 7, atcModel: '', atcId: '\0' });
  assert.strictEqual(f.transponder, '0007');
  assert.strictEqual(f.aircraftIcao, undefined);
  assert.strictEqual(f.callsign, undefined);
});
