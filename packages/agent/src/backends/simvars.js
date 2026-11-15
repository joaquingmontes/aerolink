'use strict';
// SimConnect variable tables. One table drives both "what we ask the simulator for" and "how we read the reply", so the
// two can never get out of order. Core and extra variables live in separate SimConnect definitions: if the simulator
// rejects an extra variable, position and attitude keep working.

const LB_TO_KG = 0.45359237;
const INHG_TO_HPA = 33.8639;
const MAX_ENGINES = 4;

/** type: 'num' (FLOAT64) or 'str' (STRING256) */
const CORE_VARS = [
  { key: 'lat', name: 'PLANE LATITUDE', units: 'degrees' },
  { key: 'lon', name: 'PLANE LONGITUDE', units: 'degrees' },
  { key: 'altitudeFt', name: 'PLANE ALTITUDE', units: 'feet' },
  { key: 'indicatedAltitudeFt', name: 'INDICATED ALTITUDE', units: 'feet' },
  { key: 'headingDeg', name: 'PLANE HEADING DEGREES TRUE', units: 'degrees' },
  { key: 'groundSpeedKt', name: 'GROUND VELOCITY', units: 'knots' },
  { key: 'indicatedAirspeedKt', name: 'AIRSPEED INDICATED', units: 'knots' },
  { key: 'verticalSpeedFpm', name: 'VERTICAL SPEED', units: 'feet per minute' },
  { key: 'pitchDeg', name: 'PLANE PITCH DEGREES', units: 'degrees' },
  { key: 'bankDeg', name: 'PLANE BANK DEGREES', units: 'degrees' },
  { key: 'onGround', name: 'SIM ON GROUND', units: 'bool' },
  { key: 'gearDown', name: 'GEAR HANDLE POSITION', units: 'bool' },
  { key: 'flapsPct', name: 'FLAPS HANDLE PERCENT', units: 'percent' },
  { key: 'title', name: 'TITLE', type: 'str' },
];

const engineVars = [];
for (let i = 1; i <= MAX_ENGINES; i++) {
  engineVars.push(
    { key: `eng${i}Running`, name: `GENERAL ENG COMBUSTION:${i}`, units: 'bool' },
    { key: `eng${i}Rpm`, name: `GENERAL ENG RPM:${i}`, units: 'rpm' },
    { key: `eng${i}N1`, name: `TURB ENG N1:${i}`, units: 'percent' },
    { key: `eng${i}N2`, name: `TURB ENG N2:${i}`, units: 'percent' },
    { key: `eng${i}FuelFlowPph`, name: `ENG FUEL FLOW PPH:${i}`, units: 'pounds per hour' }
  );
}

const EXTRA_VARS = [
  { key: 'atcModel', name: 'ATC MODEL', type: 'str' },
  { key: 'atcId', name: 'ATC ID', type: 'str' },
  { key: 'trueAirspeedKt', name: 'AIRSPEED TRUE', units: 'knots' },
  { key: 'mach', name: 'AIRSPEED MACH', units: 'mach' },
  { key: 'gForce', name: 'G FORCE', units: 'gforce' },
  { key: 'aglFt', name: 'PLANE ALT ABOVE GROUND', units: 'feet' },
  { key: 'parkingBrake', name: 'BRAKE PARKING POSITION', units: 'bool' },
  { key: 'fuelTotalLb', name: 'FUEL TOTAL QUANTITY WEIGHT', units: 'pounds' },
  { key: 'numEngines', name: 'NUMBER OF ENGINES', units: 'number' },
  { key: 'engineType', name: 'ENGINE TYPE', units: 'enum' },
  ...engineVars,
  { key: 'transponder', name: 'TRANSPONDER CODE:1', units: 'bco16' },
  { key: 'com1Mhz', name: 'COM ACTIVE FREQUENCY:1', units: 'MHz' },
  { key: 'com1StandbyMhz', name: 'COM STANDBY FREQUENCY:1', units: 'MHz' },
  { key: 'nav1Mhz', name: 'NAV ACTIVE FREQUENCY:1', units: 'MHz' },
  { key: 'apMaster', name: 'AUTOPILOT MASTER', units: 'bool' },
  { key: 'apAltitudeFt', name: 'AUTOPILOT ALTITUDE LOCK VAR', units: 'feet' },
  { key: 'apHeadingDeg', name: 'AUTOPILOT HEADING LOCK DIR', units: 'degrees' },
  { key: 'apSpeedKt', name: 'AUTOPILOT AIRSPEED HOLD VAR', units: 'knots' },
  { key: 'apVerticalSpeedFpm', name: 'AUTOPILOT VERTICAL HOLD VAR', units: 'feet per minute' },
  { key: 'windSpeedKt', name: 'AMBIENT WIND VELOCITY', units: 'knots' },
  { key: 'windDirectionDeg', name: 'AMBIENT WIND DIRECTION', units: 'degrees' },
  { key: 'oatC', name: 'AMBIENT TEMPERATURE', units: 'celsius' },
  { key: 'kohlsmanInHg', name: 'KOHLSMAN SETTING HG', units: 'inHg' },
];

/** Registers a table on a SimConnect handle, in table order. */
function defineVars(handle, defId, vars, SimConnectDataType) {
  for (const v of vars) {
    if (v.type === 'str') handle.addToDataDefinition(defId, v.name, null, SimConnectDataType.STRING256);
    else handle.addToDataDefinition(defId, v.name, v.units, SimConnectDataType.FLOAT64);
  }
}

/** Reads a reply buffer in table order. `reader` needs readFloat64() and readString256(). */
function decodeVars(reader, vars) {
  const raw = {};
  for (const v of vars) raw[v.key] = v.type === 'str' ? reader.readString256() : reader.readFloat64();
  return raw;
}

const round = (n, digits = 0) => {
  const k = 10 ** digits;
  return Math.round(n * k) / k;
};
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const clean = (s) => (typeof s === 'string' ? s.replace(/\0.*$/, '').trim() : '');

/** Core table reply -> protocol fields. */
function coreToFields(raw, simName) {
  return {
    sim: simName,
    aircraftTitle: clean(raw.title),
    lat: raw.lat,
    lon: raw.lon,
    altitudeFt: raw.altitudeFt,
    indicatedAltitudeFt: raw.indicatedAltitudeFt,
    headingDeg: raw.headingDeg,
    groundSpeedKt: raw.groundSpeedKt,
    indicatedAirspeedKt: raw.indicatedAirspeedKt,
    verticalSpeedFpm: raw.verticalSpeedFpm,
    pitchDeg: -raw.pitchDeg, // SimConnect reports nose-down as positive
    bankDeg: -raw.bankDeg,
    onGround: raw.onGround > 0.5,
    gearDown: raw.gearDown > 0.5,
    flapsPct: raw.flapsPct,
  };
}

const ENGINE_TYPES = { 0: 'piston', 1: 'jet', 3: 'turboshaft', 5: 'turboprop' };
const TURBINE_TYPES = new Set(['jet', 'turboshaft', 'turboprop']);

/** Extra table reply -> optional protocol fields. Values the simulator did not provide are left out. */
function extrasToFields(raw) {
  const out = {};
  const set = (k, v) => { if (v !== undefined && v !== '') out[k] = v; };

  set('aircraftIcao', clean(raw.atcModel));
  set('callsign', clean(raw.atcId));
  if (isNum(raw.trueAirspeedKt)) out.trueAirspeedKt = round(raw.trueAirspeedKt, 1);
  if (isNum(raw.mach)) out.mach = round(raw.mach, 3);
  if (isNum(raw.gForce)) out.gForce = round(raw.gForce, 2);
  if (isNum(raw.aglFt)) out.aglFt = round(raw.aglFt);
  out.parkingBrake = raw.parkingBrake > 0.5;
  if (isNum(raw.fuelTotalLb)) out.fuelTotalKg = round(raw.fuelTotalLb * LB_TO_KG);

  const engineType = ENGINE_TYPES[Math.round(raw.engineType)];
  const count = Math.min(Math.max(Math.round(raw.numEngines) || 0, 0), MAX_ENGINES);
  if (engineType && count > 0) {
    out.engineType = engineType;
    out.engines = [];
    for (let i = 1; i <= count; i++) {
      const e = {
        running: raw[`eng${i}Running`] > 0.5,
        fuelFlowKgH: round(raw[`eng${i}FuelFlowPph`] * LB_TO_KG, 1),
      };
      if (TURBINE_TYPES.has(engineType)) {
        e.n1Pct = round(raw[`eng${i}N1`], 1);
        e.n2Pct = round(raw[`eng${i}N2`], 1);
      }
      if (engineType === 'piston' || engineType === 'turboprop') e.rpm = round(raw[`eng${i}Rpm`]);
      out.engines.push(e);
    }
  }

  if (isNum(raw.transponder)) out.transponder = String(Math.max(0, Math.round(raw.transponder))).padStart(4, '0');
  if (isNum(raw.com1Mhz)) out.com1Mhz = round(raw.com1Mhz, 3);
  if (isNum(raw.com1StandbyMhz)) out.com1StandbyMhz = round(raw.com1StandbyMhz, 3);
  if (isNum(raw.nav1Mhz)) out.nav1Mhz = round(raw.nav1Mhz, 3);

  out.autopilot = {
    engaged: raw.apMaster > 0.5,
    altitudeFt: round(raw.apAltitudeFt),
    headingDeg: round(raw.apHeadingDeg),
    speedKt: round(raw.apSpeedKt),
    verticalSpeedFpm: round(raw.apVerticalSpeedFpm),
  };

  if (isNum(raw.windSpeedKt) && isNum(raw.windDirectionDeg)) {
    out.wind = { speedKt: round(raw.windSpeedKt), directionDeg: round(raw.windDirectionDeg) };
  }
  if (isNum(raw.oatC)) out.oatC = round(raw.oatC, 1);
  if (isNum(raw.kohlsmanInHg) && raw.kohlsmanInHg > 0) out.altimeterSettingHpa = round(raw.kohlsmanInHg * INHG_TO_HPA, 1);
  return out;
}

module.exports = { CORE_VARS, EXTRA_VARS, defineVars, decodeVars, coreToFields, extrasToFields, MAX_ENGINES };
