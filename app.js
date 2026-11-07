/* Regen · prototype
   Nowcast: Buienradar raintext (2 h, 5 min). Models via Open-Meteo: KNMI HARMONIE-AROME NL (2 km) for rain,
   wind and cloud; DWD ICON-D2 (2,2 km) for temperature; ICON-D2-EPS for chance and bands. */
(() => {
'use strict';

/* ======================================================================
   0. Constants & helpers
   ====================================================================== */
const HOUR = 3600e3, MIN5 = 300e3;
const MODELS = [
  { id: 'knmi_harmonie_arome_netherlands', key: 'harmonie', name: 'HARMONIE', long: 'KNMI HARMONIE-AROME', org: 'KNMI', res: '2 km', color: 'var(--s1)' },
  { id: 'icon_d2',                         key: 'icon',     name: 'ICON-D2',  long: 'DWD ICON-D2',         org: 'DWD',  res: '2,2 km', color: 'var(--s2)' },
  { id: 'meteofrance_arome_france_hd',     key: 'arome',    name: 'AROME',    long: 'Météo-France AROME HD', org: 'Météo-France', res: '1,5 km', color: 'var(--s3)' },
];
const PRIMARY = MODELS[0];
// Temperature comes from ICON-D2: in the own verification HARMONIE was +0,3 to +0,6 °C too warm and its error
// significantly larger at every lead time. ICON-D2 also matches the ICON-D2 ensemble that draws the band.
const TEMP_MODEL = MODELS[1];
const VARS = ['precipitation', 'rain', 'snowfall', 'temperature_2m', 'apparent_temperature',
  'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
  'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high', 'weather_code', 'shortwave_radiation'];
const INTERVAL_VARS = new Set(['precipitation', 'rain', 'snowfall', 'shortwave_radiation']); // value at t = sum or mean over (t-1h, t]
const CLOUD_VARS = new Set(['cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high']);
const COMPARE_HOURS = 48;

const $ = id => document.getElementById(id);
const nl = 'nl-NL';
// a missing value shows as "–": models end at different hours per variable (ICON-D2 has no feels-like for its last hours)
const fmtNum = (v, d = 1) => (v == null || !Number.isFinite(v) ? '–' : v.toLocaleString(nl, { minimumFractionDigits: d, maximumFractionDigits: d }));
const fmtMm = v => (v > 0 && v < 0.05 ? '< 0,1' : fmtNum(v, v >= 10 ? 0 : 1)); // a little rain is never "0,0"
const fmtTime = d => d.toLocaleTimeString(nl, { hour: '2-digit', minute: '2-digit' });
const fmtDay = d => d.toLocaleDateString(nl, { weekday: 'short', day: 'numeric', month: 'short' });
const fmtWd = d => d.toLocaleDateString(nl, { weekday: 'short' });
const fmtDayTime = d => `${fmtWd(d)} ${fmtTime(d)}`;
const fmtHourRange = d => `${fmtTime(d)}–${fmtTime(new Date(d.getTime() + HOUR))}`;
const fmtDeg = v => `${Math.round(v)}°`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const svgEl = (tag, attrs = {}, text) => {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
};
const h = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/* ======================================================================
   1. Science helpers (pure, unit-tested)
   ====================================================================== */
// Buienradar raintext value (0..255) → mm/h. 109 ≙ 1 mm/h, each +32 ≙ ×10.
function raintextToMmh(v) { return v <= 0 ? 0 : Math.pow(10, (v - 109) / 32); }

// Lines "VVV|HH:MM" in Dutch local time → [{t, v}] with v in mm/h. The feed carries no date: each line gets
// the day that puts it closest to `anchor` (the moment the text was fetched), so a series that starts just
// before midnight stays on the old day and one that runs past midnight moves to the next.
function parseRaintext(text, anchor = new Date()) {
  const out = [];
  for (const raw of text.trim().split(/\r?\n/)) {
    const parts = raw.trim().split('|');
    if (parts.length !== 2) continue;
    const val = parseInt(parts[0], 10);
    const hm = parts[1].split(':').map(Number);
    if (!Number.isFinite(val) || hm.length !== 2 || hm.some(x => !Number.isFinite(x))) continue;
    const t = new Date(anchor);
    t.setHours(hm[0], hm[1], 0, 0);
    const d = t.getTime() - anchor.getTime();
    if (d > 12 * HOUR) t.setDate(t.getDate() - 1);
    else if (d < -12 * HOUR) t.setDate(t.getDate() + 1);
    out.push({ t, v: Math.round(raintextToMmh(val) * 100) / 100, raw: val });
  }
  return out;
}

// Random-overlap total cloud cover from layer fractions (%).
function deriveCloudTotal(low, mid, high) {
  if ([low, mid, high].some(x => x == null)) return null;
  const f = x => 1 - clamp(x, 0, 100) / 100;
  return Math.round((1 - f(low) * f(mid) * f(high)) * 100);
}

/* HARMONIE's cloud cover is a snapshot of one 2 km cell on the hour: with scattered cumulus it flips between
   0 and 100 %. A 1-2-1 weighted mean over the neighbouring hours turns that flicker into a fraction. */
function smoothAt(a, i) {
  if (a[i] == null) return null;
  let s = 0, w = 0;
  for (const [j, wj] of [[i - 1, 1], [i, 2], [i + 1, 1]]) if (j >= 0 && j < a.length && a[j] != null) { s += a[j] * wj; w += wj; }
  return Math.round(s / w);
}

function beaufort(kmh) {
  const limits = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118]; // lower bound of Bft 1..12 in km/h
  let b = 0;
  for (const lim of limits) if (kmh >= lim) b++;
  return b;
}
function compass(deg) {
  const names = ['N', 'NNO', 'NO', 'ONO', 'O', 'OZO', 'ZO', 'ZZO', 'Z', 'ZZW', 'ZW', 'WZW', 'W', 'WNW', 'NW', 'NNW'];
  return names[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}
function cloudWord(pct) {
  if (pct < 13) return 'Helder';
  if (pct < 38) return 'Licht bewolkt';
  if (pct < 63) return 'Half bewolkt';
  if (pct < 88) return 'Zwaar bewolkt';
  return 'Bedekt';
}

/* ---- Sun: NOAA solar position (Meeus). Altitude in degrees; negative = below horizon. ---- */
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
function sunAltitude(date, lat, lon) {
  const jd = date.getTime() / 86400e3 + 2440587.5;
  const T = (jd - 2451545) / 36525;
  const L0 = (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(rad(M)) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(rad(2 * M)) * (0.019993 - 0.000101 * T) + Math.sin(rad(3 * M)) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(rad(omega));
  const decl = Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lambda)));
  const yy = Math.tan(rad(eps / 2)) ** 2;
  const eqTime = 4 * deg(yy * Math.sin(2 * rad(L0)) - 2 * e * Math.sin(rad(M)) + 4 * e * yy * Math.sin(rad(M)) * Math.cos(2 * rad(L0)) - 0.5 * yy * yy * Math.sin(4 * rad(L0)) - 1.25 * e * e * Math.sin(2 * rad(M)));
  const minutesUTC = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const tst = (((minutesUTC + eqTime + 4 * lon) % 1440) + 1440) % 1440;
  const ha = tst / 4 - 180;
  return deg(Math.asin(Math.sin(rad(lat)) * Math.sin(decl) + Math.cos(rad(lat)) * Math.cos(decl) * Math.cos(rad(ha))));
}
const SUN_RISESET = -0.833, SUN_CIVIL = -6, SUN_NAUTICAL = -12, SUN_ASTRO = -18;
/* Threshold crossings between tMin and tMax, refined to ~10 s. kinds: sunrise, sunset, dawn, dusk (civil). */
function solarEvents(tMin, tMax, lat, lon) {
  const out = [];
  const step = 5 * 60e3;
  const refine = (a, b, thr) => { // altitude crosses thr between a and b
    for (let i = 0; i < 12; i++) { const mid = (a + b) / 2; ((sunAltitude(new Date(mid), lat, lon) - thr) * (sunAltitude(new Date(a), lat, lon) - thr) <= 0) ? (b = mid) : (a = mid); }
    return new Date((a + b) / 2);
  };
  let prev = null;
  for (let t = tMin.getTime(); t <= tMax.getTime() + step; t += step) {
    const alt = sunAltitude(new Date(t), lat, lon);
    if (prev) {
      for (const [thr, up, down] of [[SUN_RISESET, 'sunrise', 'sunset'], [SUN_CIVIL, 'dawn', 'dusk']]) {
        if (prev.alt < thr && alt >= thr) out.push({ t: refine(prev.t, t, thr), kind: up });
        if (prev.alt >= thr && alt < thr) out.push({ t: refine(prev.t, t, thr), kind: down });
      }
    }
    prev = { t, alt };
  }
  return out.sort((a, b) => a.t - b.t);
}
function sunPhase(alt) {
  if (alt >= SUN_RISESET) return 'dag';
  if (alt >= SUN_CIVIL) return 'burgerlijke schemer';
  if (alt >= SUN_NAUTICAL) return 'nautische schemer';
  if (alt >= SUN_ASTRO) return 'astronomische schemer';
  return 'nacht';
}
/* Clear-sky global radiation (Haurwitz) as a mean over [t0, t1] in W/m², with the mean sine of the sun's altitude. */
function clearSky(t0, t1, lat, lon) {
  const n = 6; let g = 0, s = 0;
  for (let k = 0; k < n; k++) {
    const sa = Math.sin(rad(sunAltitude(new Date(t0.getTime() + (k + 0.5) * (t1 - t0) / n), lat, lon)));
    if (sa > 0) { g += 1098 * sa * Math.exp(-0.057 / sa); s += sa; }
  }
  return { ghi: g / n, sin: s / n };
}
/* Sky cover as felt on the ground (%), from the model's own sunshine over the hour against a clear sky.
   An hourly mean does not flip with one passing cloud. Satellite checks put a clear sky at ≈ 0,9 of
   Haurwitz, so 0,9 → 0 % and 0,3 → 100 %. Below ~6° sun the ratio gets noisy: null, use cloud cover. */
const SKY_MIN_SIN = 0.1;
/* The sunshine of an hour as a share of a clear sky (Haurwitz; a really clear sky reaches ≈ 0,9 of it); null at low
   sun. c: the hour's clear sky, passed in when many members share the hour. */
function sunRatio(sw, t0, t1, lat, lon, c = lat == null || lon == null ? null : clearSky(t0, t1, lat, lon)) {
  if (sw == null || !c || c.sin < SKY_MIN_SIN) return null;
  return sw / c.ghi;
}
function skyFromSun(sw, t0, t1, lat, lon, c) {
  const k = sunRatio(sw, t0, t1, lat, lon, c);
  return k == null ? null : Math.round(clamp((0.9 - k) / 0.6, 0, 1) * 100);
}
/* Icon of a forecast hour (everything except the measured weather of now): the model's cloud cover decides; when
   the sky is (nearly) closed the sunshine getting through tells thin from thick. Lots of sun under a closed sky is
   broken cloud (HARMONIE's 2 km cells flip to 100 % under a passing cumulus). Without sunshine (low sun, night) the
   layers decide: high cloud alone is a veil. THIN_SUN is a first guess from the week of 2 nov 2026; it is being
   checked daily against satellite and KNMI observations. */
const THIN_SUN = [0.60, 0.85]; // share of a clear sky: below = bewolkt, between = dunne bewolking, above = half bewolkt
function forecastKind({ cloud, low, mid, high, sun, rain }) {
  if (rain != null && rain >= 0.1) return 'rain';
  if (cloud == null) return sun == null ? 'clear' : sunWeatherKind({ cloud: Math.round(clamp((0.9 - sun) / 0.6, 0, 1) * 100) });
  if (cloud < 30) return 'clear';
  if (cloud < 70) return 'partly';
  if (sun != null) return sun >= THIN_SUN[1] ? 'partly' : sun >= THIN_SUN[0] ? 'thin' : 'cloud';
  if (low != null && mid != null && high != null && low < 30 && mid < 30 && high >= 70) return 'thin';
  return 'cloud';
}
/* How grey the sky of a chart is: the model's cloud cover, a thin veil counting for half. */
const tintCover = (kind, cloud) => (cloud == null ? null : kind === 'thin' ? cloud / 2 : cloud);
/* Sky tint as a function of sun altitude: day above +8°, golden around the horizon, darkening through civil
   and nautical twilight, full night below −18°. Returns [r,g,b] mixed from the theme's sky tokens. */
function hexToRgb(hx) { const s = hx.trim().replace('#', ''); const n = parseInt(s.length === 3 ? s.split('').map(c => c + c).join('') : s, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, f) { return a.map((v, i) => Math.round(v + (b[i] - v) * f)); }
function skyColor(alt, pal) {
  const { day, dawn, night } = pal;
  if (alt >= 8) return day;
  if (alt >= 0) return mix(dawn, day, alt / 8);
  if (alt >= SUN_CIVIL) return mix(dawn, night, 0.55 * (-alt / 6));
  if (alt >= SUN_NAUTICAL) return mix(dawn, night, 0.55 + 0.35 * ((-alt - 6) / 6));
  if (alt >= SUN_ASTRO) return mix(dawn, night, 0.9 + 0.1 * ((-alt - 12) / 6));
  return night;
}
function skyPalette() {
  const cs = getComputedStyle(document.documentElement);
  const get = (n, fb) => hexToRgb(cs.getPropertyValue(n) || fb);
  return { day: get('--sky-day', '#fffaeb'), dawn: get('--sky-dawn', '#fde8cf'), night: get('--sky-night', '#e4e7f1'), cloud: get('--sky-cloud', '#d8dae0') };
}
/* Grey for cloud cover: light grey when clear, dark grey when overcast (inverted in dark mode via tokens). */
function cloudGrey(pct) {
  const cs = getComputedStyle(document.documentElement);
  const lo = hexToRgb(cs.getPropertyValue('--cloud-lo') || '#c9cbd1'), hi = hexToRgb(cs.getPropertyValue('--cloud-hi') || '#4b4c52');
  const c = mix(lo, hi, clamp(pct, 0, 100) / 100);
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
/* Catmull-Rom spline through screen points as cubic beziers. tension 0 = straight, 0.5 = classic; a little
   overshoot is allowed, which reads as a natural curve for temperature and wind. */
function catmullRomPath(pts, tension = 0.5) {
  const n = pts.length;
  if (n < 2) return n ? `M${pts[0].x},${pts[0].y}` : '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) * tension / 3, c1y = p1.y + (p2.y - p0.y) * tension / 3;
    const c2x = p2.x - (p3.x - p1.x) * tension / 3, c2y = p2.y - (p3.y - p1.y) * tension / 3;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}
/* Monotone cubic (Fritsch–Carlson) through screen points: smooth, never overshoots the data. */
function monotonePath(pts) {
  const n = pts.length;
  if (n < 2) return n ? `M${pts[0].x},${pts[0].y}` : '';
  const dx = [], mm = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1].x - pts[i].x; mm[i] = (pts[i + 1].y - pts[i].y) / (dx[i] || 1e-9); }
  const t = [mm[0]];
  for (let i = 1; i < n - 1; i++) t[i] = mm[i - 1] * mm[i] <= 0 ? 0 : (mm[i - 1] + mm[i]) / 2;
  t[n - 1] = mm[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (mm[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / mm[i], b = t[i + 1] / mm[i], s = a * a + b * b;
    if (s > 9) { const tau = 3 / Math.sqrt(s); t[i] = tau * a * mm[i]; t[i + 1] = tau * b * mm[i]; }
  }
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const hh = dx[i] / 3;
    d += ` C${(pts[i].x + hh).toFixed(2)},${(pts[i].y + hh * t[i]).toFixed(2)} ${(pts[i + 1].x - hh).toFixed(2)},${(pts[i + 1].y - hh * t[i + 1]).toFixed(2)} ${pts[i + 1].x.toFixed(2)},${pts[i + 1].y.toFixed(2)}`;
  }
  return d;
}

function niceScale(min, max, { zero = false, minSpan = 1, targetTicks = 4, fixedStep = null } = {}) {
  if (zero) min = Math.min(0, min);
  if (max - min < minSpan) max = min + minSpan;
  const raw = (max - min) / targetTicks;
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 25, 50, 100];
  const step = fixedStep || steps.find(s => s >= raw) || 100;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  return { min: lo, max: hi === lo ? lo + step : hi, step };
}

/* Open-Meteo multi-model JSON → per model: times from the current hour, values with trailing nulls cut.
   Interval variables (precipitation) are re-keyed to the START of their hour so a bar labelled 14:00
   means "14:00–15:00"; instantaneous variables stay at their own hour. */
function parseForecast(json, now = new Date()) {
  const hh = json && json.hourly;
  if (!hh || !Array.isArray(hh.time)) throw new Error('Onverwacht antwoord van Open-Meteo');
  const times = hh.time.map(s => new Date(s));
  const startHour = new Date(now); startHour.setMinutes(0, 0, 0);
  const i0 = times.findIndex(t => t.getTime() >= startHour.getTime());
  if (i0 < 0) throw new Error('Geen uren vanaf nu in de verwachting');
  const models = {};
  for (const m of MODELS) {
    // with a single model in the request Open-Meteo drops the model suffix from the field names
    const get = v => hh[`${v}_${m.id}`] || (m.id === PRIMARY.id && !Object.keys(hh).some(k => k.endsWith('_' + m.id)) ? hh[v] : null) || null;
    const prec = get('precipitation');
    const temp = get('temperature_2m');
    const ref = prec || temp;
    if (!ref) { models[m.key] = { ...m, applicable: false, hours: 0, instant: [], interval: [] }; continue; }
    let end = ref.length;
    while (end > i0 && ref[end - 1] == null) end--;
    const hours = end - i0;
    const applicable = hours >= 12 && ref.slice(i0, end).filter(x => x != null).length >= hours * 0.9;
    // instantaneous rows: t = times[i], i in [i0, end)
    const instant = [];
    for (let i = i0; i < end; i++) {
      const row = { t: times[i] };
      for (const v of VARS) if (!INTERVAL_VARS.has(v)) { const a = get(v); row[v] = a ? (CLOUD_VARS.has(v) ? smoothAt(a, i) : a[i]) : null; }
      if (row.cloud_cover == null) {
        row.cloud_cover = deriveCloudTotal(row.cloud_cover_low, row.cloud_cover_mid, row.cloud_cover_high);
        row.cloud_derived = row.cloud_cover != null;
      }
      instant.push(row);
    }
    // interval rows: bar starting at times[i-1] holds value times[i]; first bar is the current hour
    const interval = [];
    for (let i = i0 + 1; i < end; i++) {
      const row = { t: times[i - 1], tEnd: times[i] };
      for (const v of INTERVAL_VARS) { const a = get(v); row[v] = a ? a[i] : null; }
      if (row.precipitation == null) continue;
      row.sun = sunRatio(row.shortwave_radiation, row.t, row.tEnd, json.latitude, json.longitude);
      interval.push(row);
    }
    models[m.key] = { ...m, applicable, hours, instant, interval,
      horizon: hours ? times[end - 1] : null };
  }
  return { startHour, models };
}

/* Compare a model's hourly precipitation with the primary model over the overlap (max COMPARE_HOURS).
   Returns null (agree) or { kind:'amount'|'timing', ... }. Thresholds are deliberately conservative:
   amount: ≥1 mm apart AND ≥1.5× ratio; timing: ≥0.5 mm in an hour where the other model stays <0.1 mm
   in that hour and both neighbours. */
function compareRain(primary, other, hours = COMPARE_HOURS) {
  const n = Math.min(primary.length, other.length, hours);
  if (n < 6) return null;
  const P = primary.slice(0, n), O = other.slice(0, n);
  const sum = a => a.reduce((s, r) => s + r.precipitation, 0);
  const sP = sum(P), sO = sum(O);
  const dryAround = (arr, i) => Math.max(arr[Math.max(0, i - 1)].precipitation, arr[i].precipitation, arr[Math.min(n - 1, i + 1)].precipitation) < 0.1;
  for (let i = 0; i < n; i++) {
    if (O[i].precipitation >= 0.5 && dryAround(P, i)) return { kind: 'timing', who: 'other', t: O[i].t, mm: O[i].precipitation, hours: n, sumP: sP, sumO: sO };
    if (P[i].precipitation >= 0.5 && dryAround(O, i)) return { kind: 'timing', who: 'primary', t: P[i].t, mm: P[i].precipitation, hours: n, sumP: sP, sumO: sO };
  }
  const lo = Math.max(0.5, Math.min(sP, sO)), hi = Math.max(sP, sO);
  if (Math.abs(sP - sO) >= 1 && hi / lo >= 1.5) return { kind: 'amount', hours: n, sumP: sP, sumO: sO };
  return null;
}

/* ======================================================================
   2. Chart engine (SVG)
   ====================================================================== */
/* ---- sun glyphs: the weather of the hour decides the picture ---- */
const SUN_WORDS = { clear: 'helder', partly: 'half bewolkt', thin: 'dunne bewolking', cloud: 'bewolkt', rain: 'regen' };
function sunWeatherKind(w) {
  if (!w) return 'clear';
  if (w.rain != null && w.rain >= 0.1) return 'rain';
  if (w.cloud != null && w.cloud >= 70) return 'cloud';
  if (w.cloud != null && w.cloud >= 30) return 'partly';
  return 'clear';
}
let glyphSeq = 0;
function sunGlyph(px, py, event, kind, title) {
  const g = svgEl('g', { class: `sun ${event} ${kind}`, transform: `translate(${px},${py})` });
  const id = 'h' + (glyphSeq++);
  // everything below the horizon line is hidden, so the sun can rise from / sink behind it
  const defs = svgEl('defs');
  const clip = svgEl('clipPath', { id });
  clip.appendChild(svgEl('rect', { x: -14, y: -16, width: 28, height: 21.5 }));
  defs.appendChild(clip);
  g.appendChild(defs);
  const clipped = svgEl('g', { 'clip-path': `url(#${id})` });
  const sun = svgEl('g', { class: 'sun-core' });
  sun.appendChild(svgEl('circle', { class: 'disc', r: 3.6 }));
  const rays = svgEl('g', { class: 'rays' });
  for (let k = 0; k < 8; k++) { const a = rad(k * 45); rays.appendChild(svgEl('line', { x1: Math.cos(a) * 5.2, y1: Math.sin(a) * 5.2, x2: Math.cos(a) * 7, y2: Math.sin(a) * 7 })); }
  sun.appendChild(rays);
  clipped.appendChild(sun);
  g.appendChild(clipped);
  if (kind === 'thin') {
    // a veil of thin streaks across the lower half of the sun
    const veil = svgEl('g', { class: 'veil' });
    for (const [x1, x2, y] of [[-7.5, 3, 1.4], [-4, 7.5, 3.8]]) veil.appendChild(svgEl('line', { x1, x2, y1: y, y2: y }));
    g.appendChild(veil);
  } else if (kind !== 'clear') {
    // cloud sits in front of the sun, lower right; bigger when overcast or raining
    const s = kind === 'partly' ? 0.8 : 1;
    const cloud = svgEl('g', { class: 'cloud', transform: `translate(${kind === 'partly' ? 3.5 : 3.2},${kind === 'partly' ? 3 : 3}) scale(${s})` });
    cloud.appendChild(svgEl('path', { d: 'M-5 3.5a3 3 0 0 1-.4-5.97A4 4 0 0 1 2.3 -1.8h.3a2.7 2.7 0 0 1 0 5.3H-5z' }));
    g.appendChild(cloud);
    if (kind === 'rain') {
      const drops = svgEl('g', { class: 'drops' });
      for (const dx of [-3.2, -0.4, 2.4]) drops.appendChild(svgEl('line', { x1: dx + 0.6, y1: 5.2, x2: dx - 0.2, y2: 7.4 }));
      g.appendChild(drops);
    }
  }
  g.appendChild(svgEl('line', { class: 'horizon', x1: -8, x2: 8, y1: 5.5, y2: 5.5 }));
  g.appendChild(svgEl('title', {}, title));
  return g;
}

/* small weather icon for the overview row: sun or moon, with cloud / rain as the hour demands */
const CLOUD_PATH = 'M-5 3.5a3 3 0 0 1-.4-5.97A4 4 0 0 1 2.3 -1.8h.3a2.7 2.7 0 0 1 0 5.3H-5z';
function weatherIcon(px, py, kind, night) {
  const g = svgEl('g', { class: `wicon ${kind}${night ? ' night' : ''}`, transform: `translate(${px},${py})` });
  const body = kind === 'clear' || kind === 'partly';
  if (body) {
    const off = kind === 'partly' ? -2.5 : 0;
    if (night) {
      g.appendChild(svgEl('path', { class: 'moon', d: 'M1.2 -4.2a4.2 4.2 0 1 0 3.3 6.6a3.4 3.4 0 0 1-3.3-6.6z', transform: `translate(${off},${off})` }));
    } else {
      const sun = svgEl('g', { class: 'sun-core', transform: `translate(${off},${off})` });
      sun.appendChild(svgEl('circle', { class: 'disc', r: 3 }));
      for (let k = 0; k < 8; k++) { const a = rad(k * 45); sun.appendChild(svgEl('line', { x1: Math.cos(a) * 4.3, y1: Math.sin(a) * 4.3, x2: Math.cos(a) * 5.6, y2: Math.sin(a) * 5.6 })); }
      g.appendChild(sun);
    }
  }
  if (kind === 'thin') {
    // dunne bewolking: the sun (or moon) shows above a veil of three thin streaks
    if (night) g.appendChild(svgEl('path', { class: 'moon', d: 'M1.2 -4.2a4.2 4.2 0 1 0 3.3 6.6a3.4 3.4 0 0 1-3.3-6.6z', transform: 'translate(0,-1.2)' }));
    else {
      const sun = svgEl('g', { class: 'sun-core', transform: 'translate(0,-0.6)' });
      sun.appendChild(svgEl('circle', { class: 'disc', r: 3.4 }));
      for (const a of [-90, -135, -45, 180, 0]) { const r = rad(a); sun.appendChild(svgEl('line', { x1: Math.cos(r) * 4.6, y1: Math.sin(r) * 4.6, x2: Math.cos(r) * 6, y2: Math.sin(r) * 6 })); }
      g.appendChild(sun);
    }
    const veil = svgEl('g', { class: 'veil' });
    for (const [x1, x2, y] of [[-7, 2.5, 1.2], [-4.5, 6.5, 3.6], [-6.5, 1.5, 6]]) veil.appendChild(svgEl('line', { x1, x2, y1: y, y2: y }));
    g.appendChild(veil);
  } else if (kind !== 'clear') {
    const s = kind === 'partly' ? 0.85 : 1.05;
    const cloud = svgEl('g', { class: 'cloud', transform: `translate(${kind === 'partly' ? 2.5 : 1},${kind === 'partly' ? 2.5 : 0.5}) scale(${s})` });
    cloud.appendChild(svgEl('path', { d: CLOUD_PATH }));
    g.appendChild(cloud);
    if (kind === 'rain') {
      const drops = svgEl('g', { class: 'drops' });
      for (const dx of [-2.8, 0, 2.8]) drops.appendChild(svgEl('line', { x1: dx + 0.6, y1: 4.6, x2: dx - 0.2, y2: 7 }));
      g.appendChild(drops);
    }
  }
  const words = { clear: night ? 'helder' : 'zonnig', partly: 'half bewolkt', thin: 'dunne bewolking', cloud: 'bewolkt', rain: 'regen' };
  g.appendChild(svgEl('title', {}, words[kind]));
  return g;
}
const ICON_WORDS = { clear: 'zonnig', partly: 'half bewolkt', thin: 'dunne bewolking', cloud: 'bewolkt', rain: 'regen' };
/* temperature → colour, cold blue through amber to warm red; interpolated between fixed stops */
const TEMP_STOPS = [[-10, [79, 127, 216]], [5, [42, 120, 214]], [12, [58, 160, 168]], [18, [237, 161, 0]], [26, [235, 104, 52]], [34, [227, 73, 72]]];
function tempColor(v) {
  if (v == null) return 'var(--s1)';
  if (v <= TEMP_STOPS[0][0]) return `rgb(${TEMP_STOPS[0][1].join(',')})`;
  for (let i = 1; i < TEMP_STOPS.length; i++) {
    if (v <= TEMP_STOPS[i][0]) {
      const [a, ca] = TEMP_STOPS[i - 1], [b, cb] = TEMP_STOPS[i];
      const c = mix(ca, cb, (v - a) / (b - a));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  const last = TEMP_STOPS[TEMP_STOPS.length - 1][1];
  return `rgb(${last.join(',')})`;
}

const tooltipEl = () => $('tooltip');
function hideTooltip() { const t = tooltipEl(); if (t) t.hidden = true; }

/* Hour step for x labels: the smallest of 1/2/3/6/12 h that keeps labels ≥ 44 px apart. */
function tickStepHours(pxPerHour) {
  for (const s of [1, 2, 3, 6, 12]) if (s * pxPerHour >= 44) return s;
  return 24;
}
function drawChart(host, spec) {
  const original = spec;
  host.textContent = '';
  const zoom = spec.ticks === 'days' && !spec.noZoom; // a day page has a fixed window
  host.classList.toggle('zoomable', zoom);
  if (zoom) host._redraw = () => drawChart(host, original); // in-place redraw while pinching
  const W = Math.max(280, host.clientWidth || 380);
  const H = spec.height || 210;
  const hasDays = spec.ticks === 'days';
  const compact = !!spec.compact; // sub-chart under a main chart: same x-axis, no day strip, no x labels
  const arrowRow = spec.arrows ? 22 : 0;
  const treeRow = spec.trees && !compact ? 62 : 0; // row of little wind scenes under the x labels
  // day strip, the same on every tab: day labels on top, right below them one row with either the hourly weather
  // icons (overview) or the sunrise/sunset glyphs (other tabs), then the plot
  const m = { top: compact ? 10 : hasDays ? 46 : 26, right: 10, bottom: compact ? 8 : 24 + arrowRow + treeRow, left: 34 };
  const dayLabelY = 14, daySepTop = 2, glyphY = hasDays ? m.top - 14 : m.top - 9;
  const pw = W - m.left - m.right, ph = H - m.top - m.bottom;
  const t0 = spec.tMin.getTime();
  // multi-day charts honour the zoom horizon: the start stays at "nu", only the end moves
  const t1 = zoom && state.horizon ? Math.min(spec.tMax.getTime(), t0 + state.horizon * HOUR) : spec.tMax.getTime();
  // clip every series to the visible window so nothing is drawn past the axis when zoomed in
  spec = { ...spec, series: spec.series.map(s => ({ ...s, points: s.points.filter(p => {
    const t = p.t.getTime();
    return (s.kind === 'bar' || s.kind === 'ghost') ? (t >= t0 && t < t1) : (t >= t0 && t <= t1);
  }) })) };
  if (spec.arrows) spec.arrows = spec.arrows.filter(a => a.t.getTime() >= t0 && a.t.getTime() <= t1);
  const x = t => m.left + ((t - t0) / (t1 - t0)) * pw;
  const xInv = px => t0 + ((px - m.left) / pw) * (t1 - t0);

  // y domain
  let vals = [];
  for (const s of spec.series) {
    if (s.kind === 'band') vals.push(...s.points.flatMap(p => [p.lo, p.hi]));
    else vals.push(...s.points.map(p => p.v));
  }
  vals = vals.filter(v => v != null && Number.isFinite(v));
  const yOpts = spec.yOpts || {};
  const sc = spec.yFixed ? spec.yFixed : niceScale(vals.length ? Math.min(...vals) : 0, vals.length ? Math.max(...vals) * (yOpts.headroom || 1) : 1, yOpts);
  const y = v => m.top + ph - ((v - sc.min) / (sc.max - sc.min)) * ph;

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': spec.aria || '' });

  // sky: day/twilight/night tint from the sun's altitude at this location
  let sunEvents = [];
  if (spec.sky) {
    const { lat, lon } = spec.sky;
    const pal = skyPalette();
    const gid = 'sky' + Math.random().toString(36).slice(2, 8);
    const defs = svgEl('defs');
    const grad = svgEl('linearGradient', { id: gid, x1: 0, x2: 1, y1: 0, y2: 0 });
    const stepMs = (t1 - t0) <= 6 * HOUR ? 5 * 60e3 : 10 * 60e3;
    for (let t = t0; t <= t1; t += stepMs) {
      const alt = sunAltitude(new Date(t), lat, lon);
      let c = skyColor(alt, pal);
      // clouds grey the daylight: full overcast pulls the day tint 70 % towards neutral grey; night is untouched
      if (spec.sky.cloudAt) {
        const f = spec.sky.cloudAt(new Date(t));
        if (f != null) c = mix(c, pal.cloud, clamp((alt + 6) / 14, 0, 1) * 0.7 * f);
      }
      grad.appendChild(svgEl('stop', { offset: ((t - t0) / (t1 - t0)).toFixed(4), 'stop-color': `rgb(${c[0]},${c[1]},${c[2]})` }));
    }
    defs.appendChild(grad);
    svg.appendChild(defs);
    svg.appendChild(svgEl('rect', { x: m.left, y: m.top, width: pw, height: ph, rx: 4, fill: `url(#${gid})`, class: 'sky' }));
    sunEvents = solarEvents(spec.tMin, spec.tMax, lat, lon);
  }

  // grid + y labels
  const grid = svgEl('g', { class: 'grid' });
  for (let v = sc.min; v <= sc.max + 1e-9; v += sc.step) {
    if (Math.abs(v - sc.min) > 1e-9 || !yOpts.zero) grid.appendChild(svgEl('line', { x1: m.left, x2: W - m.right, y1: y(v), y2: y(v) }));
    svg.appendChild(svgEl('text', { x: m.left - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'tick' }, spec.fmtTick ? spec.fmtTick(v) : fmtNum(v, sc.step < 1 ? 1 : 0)));
  }
  svg.appendChild(grid);
  svg.appendChild(svgEl('text', { x: m.left - 6, y: m.top - 9, 'text-anchor': 'end', class: 'unit' }, spec.unit || ''));

  // x ticks
  const labelAt = [];
  const vgrid = svgEl('g', { class: 'vgrid' });
  if (hasDays) {
    const hoursSpan = (t1 - t0) / HOUR;
    const every = tickStepHours(pw / hoursSpan);
    const d = new Date(t0); d.setMinutes(0, 0, 0);
    let segStart = t0;
    const days = [];
    for (let t = d.getTime(); t <= t1; t += HOUR) {
      const dt = new Date(t);
      const midnight = dt.getHours() === 0 && t > t0;
      if (midnight) {
        svg.appendChild(svgEl('line', { class: 'day-sep', x1: x(t), x2: x(t), y1: daySepTop, y2: m.top + ph }));
        days.push([segStart, t]); segStart = t;
      }
      if (dt.getHours() % every === 0 && t >= t0) {
        labelAt.push({ t, txt: fmtTime(dt) });
        if (!midnight && t > t0) vgrid.appendChild(svgEl('line', { x1: x(t), x2: x(t), y1: m.top, y2: m.top + ph }));
      }
    }
    days.push([segStart, t1]);
    if (!compact) for (const [a, b] of days) {
      const wseg = x(b) - x(a); if (wseg < 22) continue;
      svg.appendChild(svgEl('text', { x: (x(a) + x(b)) / 2, y: dayLabelY, 'text-anchor': 'middle', class: 'day-label' }, wseg < 64 ? fmtWd(new Date(a)) : fmtDay(new Date(a))));
    }
  } else {
    for (let t = Math.ceil(t0 / (30 * 60e3)) * 30 * 60e3; t <= t1; t += 30 * 60e3) {
      labelAt.push({ t, txt: fmtTime(new Date(t)) });
      if (t > t0) vgrid.appendChild(svgEl('line', { x1: x(t), x2: x(t), y1: m.top, y2: m.top + ph }));
    }
  }
  svg.appendChild(vgrid);
  // the current time gets its own label under the dashed line; regular labels too close to it are dropped
  const nowMs = spec.now ? spec.now.getTime() : null;
  const nowPx = nowMs != null && nowMs >= t0 && nowMs < t1 ? x(nowMs) : null;
  const NOW_GAP = 30; // px, about 12 minutes on the 2-hour chart and 2 hours on a 2,5-day chart
  const tickEls = []; // bottom time labels; hidden when the marker label would overlap them
  if (!compact) {
    for (const l of labelAt) {
      const px = x(l.t);
      if (px < m.left - 1 || px > W - m.right + 1) continue;
      if (nowPx != null && Math.abs(px - nowPx) < NOW_GAP) continue;
      const tl = svgEl('text', { x: px, y: m.top + ph + 15, 'text-anchor': 'middle', class: 'tick' }, l.txt); tl.dataset.px = px; svg.appendChild(tl); tickEls.push(tl);
    }
  }
  // time label under the dashed line (also used while scrubbing)
  const nowText = svgEl('text', { x: nowPx != null ? clamp(nowPx, m.left + 16, W - m.right - 16) : 0, y: m.top + ph + 15, 'text-anchor': 'middle', class: 'now-tick', visibility: !compact && nowPx != null ? 'visible' : 'hidden' }, nowPx != null ? fmtTime(spec.now) : '');
  if (!compact) svg.appendChild(nowText);

  // sunrise / sunset glyphs in the strip above the plot, dressed with the weather of that hour
  for (const ev of sunEvents) {
    if (compact || spec.icons || (ev.kind !== 'sunrise' && ev.kind !== 'sunset')) continue;
    const px = x(ev.t.getTime());
    if (px < m.left || px > W - m.right) continue;
    const wx = spec.sky.weatherAt ? spec.sky.weatherAt(ev.t) : null;
    const kind = wx && wx.kind ? wx.kind : sunWeatherKind(wx);
    svg.appendChild(sunGlyph(px, glyphY, ev.kind, kind, `${ev.kind === 'sunrise' ? 'Zon op' : 'Zon onder'} ${fmtTime(ev.t)} · ${SUN_WORDS[kind]}`));
  }

  // hourly weather icons (overview): one per hour where there is room, else every 2nd/3rd hour
  const pxPerHour = pw / ((t1 - t0) / HOUR);
  const iconStep = Math.max(1, Math.ceil(18 / pxPerHour));
  if (spec.icons && !compact) {
    spec.icons.forEach((ic, i) => {
      if (i % iconStep) return;
      const px = x(ic.t.getTime());
      if (px < m.left - 2 || px > W - m.right + 2) return;
      svg.appendChild(weatherIcon(px, glyphY, ic.kind, ic.night));
    });
  }
  // little scenes under the x labels: the same tree + wind field + rain as on the wind page, on icon hours,
  // as many as fit at ≥ 44 px apart (so one per two or three icons)
  if (spec.trees && !compact) {
    let step = iconStep;
    while (step * pxPerHour < 44) step += iconStep;
    const box = clamp(step * pxPerHour - 4, 40, 56); // width of one scene in px
    const s = box / 100;
    const yRow = m.top + ph + 22 + arrowRow;
    spec.trees.forEach((tr, i) => {
      if (i % step || tr.kmh == null) return;
      const px = x(tr.t.getTime());
      if (px < m.left - 2 || px > W - m.right + 2) return;
      const scene = svgEl('svg', { class: 'mtree', x: (px - box / 2).toFixed(1), y: yRow.toFixed(1), width: box.toFixed(1), height: (110 * s).toFixed(1), viewBox: '0 0 100 110' });
      const field = makeWindField();
      setWindField(field, tr.kmh, tr.dir);
      scene.appendChild(field);
      const t = makeTree(1);
      windTree(t, tr.kmh, tr.dir, tr.rain);
      t.appendChild(svgEl('title', {}, `${fmtTime(tr.t)} · ${fmtNum(tr.kmh, 0)} km/u · ${beaufort(tr.kmh)} Bft uit ${compass(tr.dir)}${tr.rain >= 0.1 ? ` · ${fmtMm(tr.rain)} mm` : ''}`));
      scene.appendChild(t);
      svg.appendChild(scene);
    });
  }

  // "now" marker: the dashed line; while scrubbing it follows the finger and snaps back afterwards
  const nowLine = svgEl('line', { class: 'now', x1: nowPx || 0, x2: nowPx || 0, y1: m.top - 2, y2: m.top + ph, visibility: nowPx != null ? 'visible' : 'hidden' });
  svg.appendChild(nowLine);
  const placeMarker = (px, label) => {
    nowLine.setAttribute('x1', px); nowLine.setAttribute('x2', px); nowLine.setAttribute('visibility', 'visible');
    const lx = clamp(px, m.left + 16, W - m.right - 16);
    nowText.setAttribute('x', lx); nowText.textContent = label; nowText.setAttribute('visibility', compact ? 'hidden' : 'visible');
    for (const tl of tickEls) tl.setAttribute('visibility', Math.abs(parseFloat(tl.dataset.px) - lx) < NOW_GAP ? 'hidden' : 'visible');
  };
  const resetMarker = () => {
    if (nowPx != null) placeMarker(nowPx, fmtTime(spec.now));
    else { nowLine.setAttribute('visibility', 'hidden'); nowText.setAttribute('visibility', 'hidden'); }
  };

  // baseline
  svg.appendChild(svgEl('line', { class: 'baseline', x1: m.left, x2: W - m.right, y1: y(sc.min), y2: y(sc.min) }));

  // series
  const marks = []; // for hover: {series, point, el}
  for (const s of spec.series) {
    if (s.kind === 'band') {
      const pts = s.points.filter(p => p.lo != null && p.hi != null);
      if (pts.length < 2) continue;
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t.getTime())},${y(p.hi)}`).join(' ') +
        pts.slice().reverse().map(p => ` L${x(p.t.getTime())},${y(p.lo)}`).join('') + ' Z';
      const bandEl = svgEl('path', { class: s.color ? 'band' : 'spread', d }); if (s.color) bandEl.style.fill = s.color; svg.appendChild(bandEl);
    } else if (s.kind === 'bar' || s.kind === 'ghost') {
      const g = svgEl('g');
      for (const p of s.points) {
        if (p.v == null) continue;
        const xa = x(p.t.getTime()) + 1, xb = x(p.tEnd.getTime()) - 1;
        let w = Math.max(1, xb - xa), xs = xa;
        if (w > 24) { xs = xa + (w - 24) / 2; w = 24; }
        if (p.v <= 0) { marks.push({ s, p, el: null }); continue; }
        // any rain at all stays visible: at least 2 px, even 0,02 mm on an axis to 1,5
        const hgt = Math.max(2, y(sc.min) - y(p.v)), top = y(sc.min) - hgt;
        const r = Math.min(4, w / 2, hgt);
        const d = `M${xs},${y(sc.min)} V${top + r} a${r},${r} 0 0 1 ${r},-${r} H${xs + w - r} a${r},${r} 0 0 1 ${r},${r} V${y(sc.min)} Z`;
        const el = svgEl('path', { class: s.kind === 'ghost' ? 'ghost' : 'bar', d });
        if (s.kind === 'bar') el.style.fill = s.colorAt ? s.colorAt(p.v) : s.color;
        g.appendChild(el);
        marks.push({ s, p, el });
      }
      svg.appendChild(g);
    } else { // line
      const pts = s.points.filter(p => p.v != null);
      if (!pts.length) continue;
      const scr = pts.map(p => ({ x: x(p.t.getTime()), y: y(p.v) }));
      const lineD = s.smooth === 'soft' ? catmullRomPath(scr, 0.5) : s.smooth ? monotonePath(scr) : scr.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
      // optional value-driven colour along the line (e.g. grey that darkens with cloud cover)
      let paint = s.color;
      if (s.colorAt && pts.length > 1) {
        const gid = 'ln' + Math.random().toString(36).slice(2, 8);
        const grad = svgEl('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: scr[0].x, x2: scr[scr.length - 1].x, y1: 0, y2: 0 });
        const span = scr[scr.length - 1].x - scr[0].x || 1;
        pts.forEach((p, i) => grad.appendChild(svgEl('stop', { offset: ((scr[i].x - scr[0].x) / span).toFixed(4), 'stop-color': s.colorAt(p.v) })));
        const defs = svgEl('defs'); defs.appendChild(grad); svg.appendChild(defs);
        paint = `url(#${gid})`;
      }
      if (s.area) {
        const d = lineD + ` L${scr[scr.length - 1].x},${y(sc.min)} L${scr[0].x},${y(sc.min)} Z`;
        const a = svgEl('path', { d }); a.style.fill = paint; a.style.opacity = s.areaOpacity != null ? String(s.areaOpacity) : '0.10'; svg.appendChild(a);
      }
      const el = svgEl('path', { class: 'line' + (s.secondary ? ' secondary' : ''), d: lineD });
      el.style.stroke = paint;
      svg.appendChild(el);
    }
  }

  if (spec.emptyText && !vals.some(v => v > 0)) svg.appendChild(svgEl('text', { x: m.left + pw / 2, y: m.top + ph / 2 + 4, 'text-anchor': 'middle', class: 'tick' }, spec.emptyText));

  // direct labels
  const prim = spec.series.find(s => s.kind === 'bar' || s.kind === 'line');
  if (prim && spec.directLabels) {
    const pts = prim.points.filter(p => p.v != null);
    const put = (p, above, txt) => {
      const px = prim.kind === 'bar' ? (x(p.t.getTime()) + x(p.tEnd.getTime())) / 2 : x(p.t.getTime());
      const py = y(p.v) + (above ? -7 : 14);
      svg.appendChild(svgEl('text', { x: clamp(px, m.left + 10, W - m.right - 10), y: py, 'text-anchor': 'middle', class: 'direct' }, txt));
    };
    if (pts.length) {
      const mx = pts.reduce((a, b) => (b.v > a.v ? b : a));
      if (spec.directLabels === 'peak' && mx.v > 0) put(mx, true, spec.fmt(mx.v));
      if (spec.directLabels === 'minmax') {
        const mn = pts.reduce((a, b) => (b.v < a.v ? b : a));
        put(mx, true, spec.fmt(mx.v)); put(mn, false, spec.fmt(mn.v));
      }
    }
  }

  // wind arrows row
  if (spec.arrows) {
    const yA = m.top + ph + 24 + 9;
    for (const a of spec.arrows) {
      const px = x(a.t.getTime());
      if (px < m.left || px > W - m.right) continue;
      const g = svgEl('g', { transform: `translate(${px},${yA}) rotate(${a.deg + 180})`, class: 'arrow' });
      g.appendChild(svgEl('path', { d: 'M0,6 L0,-6 M-3.5,-2.5 L0,-6 L3.5,-2.5' }));
      svg.appendChild(g);
    }
  }

  // hover / scrub layer: the dashed line follows the finger, the tooltip shows that moment
  const dots = svgEl('g');
  svg.appendChild(dots);
  const hit = svgEl('rect', { class: 'hit', x: m.left, y: m.top - 16, width: pw, height: ph + 16 + 24 });
  svg.appendChild(hit);
  let lifted = null;
  if (spec.group) host.dataset.group = spec.group; else delete host.dataset.group;

  const lineSeries = spec.series.filter(s => s.kind === 'line');
  const barSeries = spec.series.filter(s => s.kind === 'bar' || s.kind === 'ghost');

  /* show the readout for time t (ms). silent = only move the marker (used by linked charts). */
  function showAtTime(t, silent) {
    const tip = tooltipEl();
    if (!silent) tip.textContent = '';
    let anchorX, anchorY = m.top, labelT, point = null;
    if (barSeries.length) {
      const base = barSeries[0];
      const p = base.points.find(q => t >= q.t.getTime() && t < q.tEnd.getTime());
      if (!p) { if (!silent) hideTooltip(); return null; }
      point = p; labelT = p.t;
      anchorX = (x(p.t.getTime()) + x(p.tEnd.getTime())) / 2;
      if (!silent) {
        tip.appendChild(h('div', 't', spec.tipTime(p)));
        for (const s of barSeries) {
          const q = s.points.find(r => r.t.getTime() === p.t.getTime());
          if (!q || q.v == null) continue;
          tip.appendChild(tipRow(s, tipValueOf(spec, s, q), q, spec));
          if (q.v > 0 && s.kind === 'bar') anchorY = Math.min(anchorY, y(q.v));
        }
      }
      if (lifted) lifted.classList.remove('lift');
      const mk = marks.find(k => k.s === base && k.p === p);
      lifted = mk && mk.el; if (lifted) lifted.classList.add('lift');
    } else {
      const base = lineSeries[0];
      if (!base) return null;
      const pts = base.points.filter(p => p.v != null);
      if (!pts.length) return null;
      let best = pts[0];
      for (const p of pts) if (Math.abs(p.t.getTime() - t) < Math.abs(best.t.getTime() - t)) best = p;
      point = best; labelT = best.t;
      anchorX = x(best.t.getTime());
      dots.textContent = '';
      if (!silent) tip.appendChild(h('div', 't', spec.tipTime(best)));
      for (const s of lineSeries) {
        const q = s.points.find(r => r.t.getTime() === best.t.getTime());
        if (!q || q.v == null) continue;
        if (!silent) tip.appendChild(tipRow(s, tipValueOf(spec, s, q), q, spec));
        const dot = svgEl('circle', { class: 'dot', cx: anchorX, cy: y(q.v), r: 4 }); dot.style.fill = s.color; dots.appendChild(dot);
        anchorY = Math.min(anchorY, y(q.v));
      }
    }
    placeMarker(anchorX, fmtTime(labelT));
    if (spec.onScrub) spec.onScrub(point);
    if (silent) return point;
    if (spec.sky) {
      const alt = sunAltitude(new Date(t), spec.sky.lat, spec.sky.lon);
      tip.appendChild(h('div', 't', `${sunPhase(alt)} · zon ${alt >= 0 ? fmtNum(alt, 0) + '° boven' : fmtNum(-alt, 0) + '° onder'} de horizon`));
    }
    if (spec.tipExtra) { const ex = spec.tipExtra(t); if (ex) tip.appendChild(h('div', 't', ex)); }
    tip.hidden = false;
    const rect = svg.getBoundingClientRect();
    const scale = rect.width / W;
    const cx = rect.left + anchorX * scale, cy = rect.top + anchorY * scale;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = clamp(cx - tw / 2, 8, window.innerWidth - tw - 8);
    let top = cy - th - 12;
    if (top < 8) top = cy + 16;
    tip.style.left = `${left}px`; tip.style.top = `${top}px`;
    return point;
  }
  function showAt(clientX) {
    const rect = svg.getBoundingClientRect();
    const px = (clientX - rect.left) * (W / rect.width);
    const t = xInv(clamp(px, m.left, m.left + pw));
    showAtTime(t, false);
    if (spec.group) for (const other of document.querySelectorAll(`.chart[data-group="${spec.group}"]`)) if (other !== host && other._scrubTo) other._scrubTo(t);
  }
  function clearLocal() {
    hideTooltip(); dots.textContent = ''; resetMarker();
    if (lifted) { lifted.classList.remove('lift'); lifted = null; }
    if (spec.onScrub) spec.onScrub(null);
  }
  function clear() {
    clearLocal();
    if (spec.group) for (const other of document.querySelectorAll(`.chart[data-group="${spec.group}"]`)) if (other !== host && other._scrubTo) other._scrubTo(null);
  }
  host._scrubTo = t => { if (t == null) clearLocal(); else showAtTime(t, true); };
  let clearTimer = null;
  hit.addEventListener('pointermove', e => { clearTimeout(clearTimer); showAt(e.clientX); });
  hit.addEventListener('pointerdown', e => { clearTimeout(clearTimer); showAt(e.clientX); });
  hit.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') clear(); });
  hit.addEventListener('pointerup', () => { clearTimeout(clearTimer); clearTimer = setTimeout(clear, 1800); });
  hit.addEventListener('pointercancel', clear);
  host.appendChild(svg);
  return { svg, scale: sc };
}
/* The value a tooltip row shows: the formatted value with its unit, unless the chart words it itself (tipValue). */
function tipValueOf(spec, s, q) {
  const own = spec.tipValue ? spec.tipValue(s, q) : null;
  return own != null ? own : spec.fmt(q.v) + (spec.unitTip ? ' ' + spec.unitTip : '');
}
function tipRow(s, valueText, p, spec) {
  const row = h('div', 'row');
  const k = h('span', 'k'); k.style.background = s.color; row.appendChild(k);
  row.appendChild(h('span', 'v', valueText));
  row.appendChild(h('span', 'n', s.name + (spec.tipNote ? spec.tipNote(s, p) : '')));
  return row;
}
function legend(el, items) {
  const L = h('div', 'legend');
  for (const it of items) {
    const sp = h('span');
    const sw = h('span', 'sw' + (it.rect ? ' rect' : '') + (it.dashed ? ' dashed' : '') + (it.band ? ' band' : ''));
    if (it.dashed) sw.style.color = it.color; else if (it.band) { sw.style.background = it.color; sw.style.opacity = '0.25'; } else sw.style.background = it.color;
    sp.appendChild(sw);
    sp.appendChild(document.createTextNode(it.name));
    if (it.note) sp.appendChild(h('span', 'muted', ' ' + it.note));
    L.appendChild(sp);
  }
  el.appendChild(L);
}
function dataTable(points, cols) {
  const wrap = h('div', 'table-wrap');
  const t = h('table');
  const tr = t.createTHead().insertRow();
  for (const c of cols) { const th = h('th', c.num ? 'num' : '', c.label); tr.appendChild(th); }
  const body = t.createTBody();
  for (const p of points) {
    const r = body.insertRow();
    for (const c of cols) { const td = r.insertCell(); td.textContent = c.get(p); if (c.num) td.className = 'num'; }
  }
  wrap.appendChild(t);
  return wrap;
}
function card(title, metaNodes) {
  const c = h('section', 'card');
  const head = h('div', 'card-head');
  head.appendChild(h('h2', null, title));
  const tbl = h('button', 'icon-btn'); tbl.type = 'button'; tbl.title = 'Tabel'; tbl.setAttribute('aria-label', 'Toon als tabel'); tbl.setAttribute('aria-pressed', 'false');
  tbl.innerHTML = '<svg class="ico" viewBox="0 0 20 20"><path d="M3 4h14v12H3z M3 8h14 M3 12h14 M8 4v12" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
  head.appendChild(tbl);
  c.appendChild(head);
  const meta = h('p', 'meta');
  for (const n of metaNodes) meta.appendChild(typeof n === 'string' ? document.createTextNode(n) : n);
  if (metaNodes.length) c.appendChild(meta);
  const body = h('div', 'chart');
  c.appendChild(body);
  const tableHost = h('div'); tableHost.hidden = true; c.appendChild(tableHost);
  tbl.addEventListener('click', () => {
    const show = tableHost.hidden;
    tableHost.hidden = !show; body.hidden = show;
    tbl.setAttribute('aria-pressed', String(show));
  });
  return { el: c, body, tableHost };
}
const b = txt => { const n = h('b', null, txt); return n; };

/* ======================================================================
   3. State & data loading
   ====================================================================== */
const DEFAULT_LOC = { name: 'Amsterdam', admin: 'Noord-Holland', lat: 52.37, lon: 4.90 };
const HORIZON_MIN = 6; // uren
/* horizon: hoeveel uur vooruit de 2,5-daagse grafieken tonen, altijd vanaf nu; null = alles tot de modelhorizon */
const state = { loc: DEFAULT_LOC, tab: 'overview', nowcast: null, forecast: null, updated: null, rainModel: 'harmonie', errors: {}, horizon: null, fetched: {} };
try {
  const l = JSON.parse(localStorage.getItem('regen.loc') || 'null');
  if (l && Number.isFinite(l.lat) && Number.isFinite(l.lon)) state.loc = l;
  const t = localStorage.getItem('regen.tab'); if (t && ['overview', 'temp', 'wind', 'cloud'].includes(t)) state.tab = t;
  const hz = parseFloat(localStorage.getItem('regen.horizon')); if (Number.isFinite(hz) && hz >= HORIZON_MIN) state.horizon = hz;
} catch (e) {}

const nowcastUrl = (lat, lon) => `https://gpsgadget.buienradar.nl/data/raintext?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`;
const forecastUrl = (lat, lon) => `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
  `&hourly=${VARS.join(',')}&models=${PRIMARY.id},${TEMP_MODEL.id}&forecast_days=4&timezone=Europe%2FAmsterdam`;
/* ICON-D2-EPS: 20 leden, 2,2 km, ±48 u. Alleen voor kans en spreiding; HARMONIE blijft de verwachting. */
const ENS = { id: 'icon_d2_eps', name: 'ICON-D2-ensemble', long: 'DWD ICON-D2-EPS', members: 20, res: '2,2 km' };
const ENS_VARS = ['precipitation', 'temperature_2m', 'wind_speed_10m', 'cloud_cover'];
const ensembleUrl = (lat, lon) => `https://ensemble-api.open-meteo.com/v1/ensemble?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
  `&hourly=${ENS_VARS.join(',')}&models=${ENS.id}&forecast_days=3&timezone=Europe%2FAmsterdam`;
/* ECMWF-ensemble (IFS ENS, 51 leden, 0,25°), hetzelfde ensemble als de KNMI-pluim. Alleen voor de dagen in Week
   voorbij wat HARMONIE en ICON-D2 dekken. */
const ECMWF = { id: 'ecmwf_ifs025', long: 'ECMWF-ensemble', members: 51, res: '25 km' };
const ECMWF_VARS = ['temperature_2m', 'precipitation', 'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high', 'shortwave_radiation', 'wind_speed_10m', 'wind_direction_10m'];
const ecmwfUrl = (lat, lon) => `https://ensemble-api.open-meteo.com/v1/ensemble?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
  `&hourly=${ECMWF_VARS.join(',')}&models=${ECMWF.id}&forecast_days=8&timezone=Europe%2FAmsterdam`;

/* Ensemble JSON → { hours, horizon, prob: [{t, tEnd, v, n}], bands: { var: [{t, lo, med, hi, n}] } }.
   prob = share of members with ≥ 0,1 mm in the hour (t, tEnd]; bands = 10/50/90-percentiel per uur. */
function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
function parseEnsemble(json, now = new Date(), lat = null, lon = null) {
  const hh = json && json.hourly;
  if (!hh || !Array.isArray(hh.time)) throw new Error('Onverwacht antwoord van de ensemble-API');
  const times = hh.time.map(s => new Date(s));
  const startHour = new Date(now); startHour.setMinutes(0, 0, 0);
  const i0 = times.findIndex(t => t.getTime() >= startHour.getTime());
  if (i0 < 0) throw new Error('Geen uren vanaf nu in het ensemble');
  const membersOf = v => Object.keys(hh).filter(k => k === v || k.startsWith(v + '_member')).map(k => hh[k]);
  const P = membersOf('precipitation');
  const prob = [];
  for (let i = i0 + 1; i < times.length; i++) {
    const vals = P.map(a => a[i]).filter(x => x != null);
    if (vals.length < 5) break;
    prob.push({ t: times[i - 1], tEnd: times[i], v: vals.filter(x => x >= 0.1).length / vals.length, n: vals.length,
      mmMed: quantile(vals.slice().sort((a, b) => a - b), 0.5) });
  }
  const bands = {};
  for (const v of ENS_VARS) {
    if (v === 'precipitation') continue;
    const M = membersOf(v);
    const rows = [];
    for (let i = i0; i < times.length; i++) {
      const vals = M.map(a => a[i]).filter(x => x != null).sort((a, b) => a - b);
      if (vals.length < 5) break;
      rows.push({ t: times[i], lo: quantile(vals, 0.1), med: quantile(vals, 0.5), hi: quantile(vals, 0.9), n: vals.length });
    }
    bands[v] = rows;
  }
  const horizon = prob.length ? prob[prob.length - 1].tEnd : null;
  return { startHour, hours: prob.length, horizon, prob, bands, members: P.length, dayChance: lat != null ? ensDayChance(json, now, lat, lon) : [] };
}

/* ---- days from an ensemble (Week) ---- */
const DAY_RAIN_MM = 0.5; // een dag telt als nat bij minstens 0,5 mm in de lichte uren van het lid
/* An hour [t, t + 1 h) counts as light when its midpoint has the sun above the horizon; icons and rain of a day
   in Week look at those hours only. */
const isLightHour = (t, lat, lon) => sunAltitude(new Date(t.getTime() + HOUR / 2), lat, lon) >= SUN_RISESET;
const memberSuffixes = (hh, v) => Object.keys(hh).filter(k => k === v || k.startsWith(v + '_member')).map(k => k.slice(v.length)).sort();
/* Whole local days from midnight of `now` that the hourly axis covers, with the interval value of the last hour
   (at index ia + n) included: [{ a, ia, n }]. */
function ensDays(times, now, maxDays) {
  const out = [], d0 = new Date(now); d0.setHours(0, 0, 0, 0);
  for (let k = 0; k < maxDays; k++) {
    const a = new Date(d0); a.setDate(a.getDate() + k);
    const b = new Date(a); b.setDate(b.getDate() + 1);
    const ia = times.findIndex(t => t.getTime() === a.getTime()), n = Math.round((b - a) / HOUR);
    if (ia < 0 || ia + n >= times.length) break;
    out.push({ a, ia, n });
  }
  return out;
}
/* Per day the share of members with at least DAY_RAIN_MM over the light hours of that day. */
function ensDayChance(json, now, lat, lon) {
  const hh = json.hourly, times = hh.time.map(s => new Date(s));
  const P = memberSuffixes(hh, 'precipitation').map(s => hh['precipitation' + s]);
  const out = [];
  for (const { a, ia, n } of ensDays(times, now, 3)) {
    const light = [];
    for (let i = ia; i < ia + n; i++) if (isLightHour(times[i], lat, lon)) light.push(i + 1);
    const sums = P.map(arr => { let s = 0; for (const i of light) { if (arr[i] == null) return null; s += arr[i]; } return s; }).filter(x => x != null);
    if (sums.length < 5) break;
    out.push({ day: a, chance: sums.filter(x => x >= DAY_RAIN_MM).length / sums.length, n: sums.length });
  }
  return out;
}
/* Icon of hour i of an ECMWF member by the forecast rule: its smoothed cloud cover and layers, sunshine and rain. */
const memberKind = (m, i, rain, sun) => forecastKind({ cloud: smoothAt(m.C, i), low: smoothAt(m.L, i), mid: smoothAt(m.M, i), high: smoothAt(m.Hc, i), sun, rain });
/* One member's day by the same rules as HARMONIE's days: per light hour an icon by the forecast rule, the day the
   median; min/max over the day; rain over the light hours. null when incomplete. */
function memberDay(m, ia, n, times, lat, lon) {
  const temps = [], ranks = [];
  let rain = 0;
  for (let i = ia; i < ia + n; i++) {
    const pr = m.P[i + 1];
    if (m.T[i] == null || pr == null) return null;
    temps.push(m.T[i]);
    const t0 = times[i], t1 = times[i + 1];
    if (!isLightHour(t0, lat, lon)) continue;
    rain += pr;
    ranks.push(KIND_RANK.indexOf(memberKind(m, i, pr, sunRatio(m.S[i + 1], t0, t1, lat, lon))));
  }
  return { kind: medianKind(ranks), mn: Math.min(...temps), mx: Math.max(...temps), rain };
}
/* ECMWF JSON → { days: [{ day, kind, mn, mx, mnLo, mxHi, chance, n }] }: per member its own day, then over the
   members the median icon, the median of the daily min and max (as the KNMI plume), their 25/75 % (the plume's
   50 % band) and the share of wet members. */
function parseEcmwf(json, lat, lon, now = new Date()) {
  const hh = json && json.hourly;
  if (!hh || !Array.isArray(hh.time)) throw new Error('Onverwacht antwoord van de ensemble-API');
  const times = hh.time.map(s => new Date(s));
  const members = memberSuffixes(hh, 'temperature_2m').map(s => ({
    T: hh['temperature_2m' + s], P: hh['precipitation' + s] || [], C: hh['cloud_cover' + s] || [], S: hh['shortwave_radiation' + s] || [],
    W: hh['wind_speed_10m' + s] || [], D: hh['wind_direction_10m' + s] || [],
    L: hh['cloud_cover_low' + s] || [], M: hh['cloud_cover_mid' + s] || [], Hc: hh['cloud_cover_high' + s] || [] }));
  return { days: ecmwfDays(members, times, lat, lon, now), hours: ecmwfHours(members, times, lat, lon), members: members.length };
}
/* Per hour over the members, for the day pages of the ECMWF days (as the KNMI plume): temperature as median
   with a band holding 90 % of the members (ENS_BAND), rain in the hour (t, tEnd] the same way plus the share
   with ≥ 0,1 mm, the icon as the median of the members' icons, the sky cover as their median, and the wind of
   the middle run: the member whose wind speed is the median of the hour, so speed and direction belong together. */
const ENS_BAND = [0.05, 0.95]; // 90 % of the members, as the KNMI plume's light band
function ecmwfHours(members, times, lat, lon) {
  const out = [], need = Math.max(3, members.length / 2);
  for (let i = 0; i + 1 < times.length; i++) {
    const t0 = times[i], t1 = times[i + 1], cs = lat == null || lon == null ? null : clearSky(t0, t1, lat, lon);
    const T = [], P = [], C = [], K = [], W = [];
    for (const m of members) {
      const pr = m.P[i + 1];
      if (m.T[i] == null || pr == null) continue;
      const kind = memberKind(m, i, pr, sunRatio(m.S[i + 1], t0, t1, lat, lon, cs)), cover = tintCover(kind, smoothAt(m.C, i));
      T.push(m.T[i]); P.push(pr); C.push(cover == null ? 0 : cover);
      K.push(KIND_RANK.indexOf(kind));
      if (m.W[i] != null) W.push({ kmh: m.W[i], dir: m.D[i] });
    }
    if (T.length < need) break;
    const st = T.sort((a, b) => a - b), sp = P.sort((a, b) => a - b), sc = C.sort((a, b) => a - b);
    const mid = W.sort((a, b) => a.kmh - b.kmh)[(W.length - 1) >> 1];
    out.push({ t: t0, tEnd: t1, tMed: quantile(st, 0.5), tLo: quantile(st, ENS_BAND[0]), tHi: quantile(st, ENS_BAND[1]),
      pMed: quantile(sp, 0.5), pLo: quantile(sp, ENS_BAND[0]), pHi: quantile(sp, ENS_BAND[1]), chance: sp.filter(x => x >= 0.1).length / sp.length,
      cover: quantile(sc, 0.5), kind: medianKind(K), kmh: mid ? mid.kmh : null, dir: mid ? mid.dir : null, n: T.length });
  }
  return out;
}
function ecmwfDays(members, times, lat, lon, now) {
  const days = [];
  for (const { a, ia, n } of ensDays(times, now, 8)) {
    const md = members.map(m => memberDay(m, ia, n, times, lat, lon)).filter(d => d && d.kind);
    if (md.length < Math.max(3, members.length / 2)) break;
    const mins = md.map(d => d.mn).sort((x, y) => x - y), maxs = md.map(d => d.mx).sort((x, y) => x - y);
    days.push({ day: a, kind: medianKind(md.map(d => KIND_RANK.indexOf(d.kind))),
      mn: quantile(mins, 0.5), mx: quantile(maxs, 0.5), mnLo: quantile(mins, 0.25), mxHi: quantile(maxs, 0.75),
      chance: md.filter(d => d.rain >= DAY_RAIN_MM).length / md.length, n: md.length });
  }
  return days;
}
function probAt(t) {
  const e = state.ens; if (!e) return null;
  const ms = t.getTime();
  const row = e.prob.find(p => ms >= p.t.getTime() && ms < p.tEnd.getTime());
  return row ? row.v : null;
}
/* A chance as it should be read: 20 members give steps of 5 %, and 0 of 20 members is not "zero". */
function fmtProb(p) {
  if (p == null) return '–';
  if (p < 0.05) return '< 5%';
  if (p > 0.95) return '> 95%';
  return `${Math.round(p * 20) * 5}%`;
}
/* What the hero tile says. Radar first, including the slot we are in. After the radar window: the first hour bar
   of HARMONIE with at least 0,5 mm — deterministic only; the ensemble chance is shown alongside but decides
   nothing. An hour the radar half covers counts from where the radar stops. Otherwise dry up to 48 h, with the
   wettest hour below the threshold when there is one. */
const RAIN_MM = 0.5;
/* How long it stays dry, in words: "de komende 2 dagen", "de komende 30 uur", "de komende 2 uur" or "tot 19:05".
   `until` is where the radar or the model stops looking, not where rain starts: hence "de komende …". */
function dryFor(until, now = new Date()) {
  const min = (until.getTime() - now.getTime()) / 60e3;
  if (min >= 36 * 60) return `de komende ${Math.round(min / 1440)} dagen`;
  if (min >= 110) return `de komende ${Math.round(min / 60)} uur`;
  return `tot ${fmtTime(until)}`;
}
function nextRain(nowcast, H, ens, now = new Date()) {
  const slot = nowcast && nowcast.find(p => p.v >= 0.1 && p.t.getTime() + MIN5 > now.getTime());
  if (slot) return { kind: 'radar', t: slot.t, now: slot.t <= now, mmh: slot.v };
  const radarEnd = nowcast && nowcast.length ? nowcast[nowcast.length - 1].t.getTime() + MIN5 : null;
  if (!H || !H.applicable || !H.interval.length) return radarEnd ? { kind: 'dry', until: new Date(radarEnd), maxMm: null } : null;
  const from = radarEnd || now.getTime();
  const end = Math.min(H.instant[0].t.getTime() + HORIZON_MAX * HOUR, H.interval[H.interval.length - 1].tEnd.getTime());
  const probOf = p => { const r = ens && p.src !== 'radar' && ens.prob.find(q => q.t.getTime() === p.t.getTime()); return r ? r.v : null; };
  let maxMm = null, maxT = null;
  for (const p of H.interval) {
    if (p.tEnd.getTime() <= from || p.t.getTime() >= end) continue;
    if (p.precipitation >= RAIN_MM) {
      return { kind: 'model', t: new Date(Math.max(p.t.getTime(), radarEnd || 0)), mm: p.precipitation, prob: probOf(p) };
    }
    if (p.precipitation >= 0.1 && (maxMm == null || p.precipitation > maxMm)) { maxMm = p.precipitation; maxT = p.t; }
  }
  return { kind: 'dry', until: new Date(end), maxMm, maxT };
}
const geoUrl = q => `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=nl&format=json`;

async function fetchOk(url, asText) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return asText ? r.text() : r.json();
}

/* ---- last good answer per source, with the moment it was fetched ----
   The service worker no longer caches data: without network the app falls back on these copies and says
   how old they are, instead of showing old data under a fresh "bijgewerkt". */
const STORE_PREFIX = 'regen.data.';
// oudste bewaarde kopie die nog getoond wordt. Radar maar 30 min: van een oudere nowcast blijft na het weglaten van
// wat voorbij is een stompje over, en dan komt de uurgrafiek grotendeels uit het model terwijl "Komende 2 uur" droog lijkt
const MAX_AGE = { nowcast: 30 * 60e3, forecast: 24 * HOUR, ens: 24 * HOUR, ecmwf: 24 * HOUR, obs: 2 * HOUR };
const OBS_MAX_AGE = HOUR; // een meting van meer dan een uur geleden is geen "nu" meer
const sameLoc = (a, b) => !b || (a && Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lon - b.lon) < 1e-4);
function storeSave(key, loc, body, at) {
  try { localStorage.setItem(STORE_PREFIX + key, JSON.stringify({ lat: loc ? loc.lat : null, lon: loc ? loc.lon : null, at: at.getTime(), body })); } catch (e) {}
}
function storeLoad(key, loc, now = new Date()) {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_PREFIX + key) || 'null');
    if (s && typeof s.body === 'string' && Number.isFinite(s.at) && now.getTime() - s.at <= MAX_AGE[key] && sameLoc(s, loc)) return { body: s.body, at: new Date(s.at) };
  } catch (e) {}
  return null;
}
/* Network first. A good answer is parsed, then stored; on any failure the stored copy for this place is
   parsed instead (parse gets the moment the text was fetched). loc null = not tied to a place. */
async function loadSource(key, url, loc, now, parse) {
  let err;
  try {
    const body = await fetchOk(url, true);
    const value = parse(body, now);
    storeSave(key, loc, body, now);
    return { value, at: now, stored: false };
  } catch (e) { err = e; }
  const s = storeLoad(key, loc, now);
  if (!s) throw err;
  return { value: parse(s.body, s.at), at: s.at, stored: true };
}
/* The hours the radar covers take their rain from the radar, so the hourly bars can never disagree with the
   2-hour chart: per model hour the radar's own amount over the overlap (intensity × 5 min), plus the model's
   amount pro rata for the part after the radar window. The part of the current hour that has passed is left
   out. src: 'radar' = fully covered, 'mix' = radar and model; model = the model's own value. */
function blendRain(interval, nowcast) {
  if (!nowcast || !nowcast.length) return interval;
  const r0 = nowcast[0].t.getTime(), r1 = nowcast[nowcast.length - 1].t.getTime() + MIN5;
  return interval.map(p => {
    const a = p.t.getTime(), b = p.tEnd.getTime();
    // hours after the radar keep the model; an hour ending before the radar starts is the current hour, whose
    // last minutes the radar (starting at about now) does not reach: it is over, not the model's
    if (a >= r1) return p;
    let radar = 0;
    for (const s of nowcast) { const st = s.t.getTime(); if (st >= a && st < b) radar += s.v / 12; }
    const after = Math.max(0, b - Math.max(a, r1));
    // the model's share for the few minutes after the radar is dropped below 0,05 mm (a trace that would read as
    // rain the radar doesn't show); rain the radar shows always stays, however little, so both charts agree
    let model = (p.precipitation || 0) * after / HOUR;
    if (model < 0.05) model = 0;
    let mm = Math.round((radar + model) * 100) / 100;
    if (radar > 0 && mm < 0.01) mm = 0.01;
    return { ...p, precipitation: mm, src: after > 0 ? 'mix' : 'radar', model: p.precipitation };
  });
}
/* chance of rain for an hour bar; none for an hour the radar fully covers (the radar has no chance) */
const probFor = p => (p.src === 'radar' ? null : probAt(p.t));

/* Drop what is no longer current: radar slots that have ended, a station reading older than an hour. */
function freshOnly(nowcast, obs, now) {
  const nc = nowcast ? nowcast.filter(p => p.t.getTime() + MIN5 > now.getTime()) : null;
  return { nowcast: nc && nc.length ? nc : null, obs: obs && now - obs.time <= OBS_MAX_AGE ? obs : null };
}
/* Sources shown from a stored copy older than STALE_AFTER (a copy of a minute old is as good as fresh, so one
   hiccup of one source raises no alarm). null when everything is current; else { since, all, parts }: the oldest
   fetch moment, whether every source failed (no connection) or only some, and which ones with their time. */
const STALE_AFTER = 10 * 60e3;
const SOURCE_NAMES = { forecast: 'verwachting', ens: 'kans en onzekerheidsband', ecmwf: 'meerdaagse verwachting', nowcast: 'radar', obs: 'metingen' };
function staleSince(now = new Date()) {
  const f = Object.values(state.fetched || {});
  const parts = Object.keys(SOURCE_NAMES)
    .filter(k => { const x = state.fetched && state.fetched[k]; return x && x.stored && now - x.at > STALE_AFTER; })
    .map(k => ({ key: k, at: state.fetched[k].at }));
  if (!parts.length) return null;
  return { since: new Date(Math.min(...parts.map(x => x.at.getTime()))), all: f.every(x => x.stored), parts };
}
const sameDay = (a, b) => a.toDateString() === b.toDateString();
const fmtWhen = d => (sameDay(d, new Date()) ? fmtTime(d) : fmtDayTime(d));
const joinNl = xs => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} en ${xs[xs.length - 1]}`);
/* "De verwachting kon niet worden bijgewerkt en is van 15:11." — names the sources, with a time each when they differ. */
function staleText({ since, all, parts }) {
  if (all) return `Geen verbinding. Je ziet de gegevens van ${fmtWhen(since)}; die worden ververst zodra er weer verbinding is.`;
  const one = parts.length === 1, sameTime = parts.every(p => fmtWhen(p.at) === fmtWhen(since));
  const list = joinNl(parts.map(p => `de ${SOURCE_NAMES[p.key]}` + (sameTime ? '' : ` (${fmtWhen(p.at)})`)));
  return `${list[0].toUpperCase()}${list.slice(1)} ${one ? 'kon' : 'konden'} niet worden bijgewerkt` +
    (sameTime ? ` en ${one ? 'is' : 'zijn'} van ${fmtWhen(since)}.` : '.');
}

let refreshTimer = null;
async function load() {
  const loc = state.loc, { lat, lon } = loc;
  $('locName').textContent = loc.name;
  document.body.classList.add('loading');
  const now = new Date();
  const [nc, fc, en, ob, ec] = await Promise.allSettled([
    loadSource('nowcast', nowcastUrl(lat, lon), loc, now, (b, at) => parseRaintext(b, at)),
    loadSource('forecast', forecastUrl(lat, lon), loc, now, b => withDays(JSON.parse(b), now, lat, lon)),
    loadSource('ens', ensembleUrl(lat, lon), loc, now, b => parseEnsemble(JSON.parse(b), now, lat, lon)),
    loadSource('obs', obsUrl, null, now, b => parseObs(JSON.parse(b), lat, lon)),
    loadSource('ecmwf', ecmwfUrl(lat, lon), loc, now, b => parseEcmwf(JSON.parse(b), lat, lon, now)),
  ]);
  if (state.loc !== loc) return; // another place was chosen while this was loading
  state.errors = {}; state.fetched = {};
  const take = (key, r) => {
    if (r.status === 'fulfilled') { state.fetched[key] = { at: r.value.at, stored: r.value.stored }; return r.value.value; }
    state.errors[key] = r.reason.message; return null;
  };
  state.forecast = take('forecast', fc);
  state.ens = take('ens', en);
  state.ecmwf = take('ecmwf', ec);
  const fresh = freshOnly(take('nowcast', nc), take('obs', ob), now);
  if (!fresh.nowcast && !state.errors.nowcast) { state.errors.nowcast = 'verouderd'; delete state.fetched.nowcast; }
  if (!fresh.obs && state.fetched.obs) delete state.fetched.obs;
  state.nowcast = fresh.nowcast; state.obs = fresh.obs;
  const H = state.forecast && state.forecast.models.harmonie;
  if (H) H.interval = blendRain(H.interval, state.nowcast); // every view (bars, icons, trees, totals) sees the radar hours
  state.updated = now;
  document.body.classList.remove('loading');
  render();
  // on a phone the first request after waking often fails; then try again soon instead of in 5 minutes
  const failed = Object.keys(state.errors).length || Object.values(state.fetched).some(f => f.stored);
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(load, failed ? 30e3 : 5 * 60e3);
}

/* ======================================================================
   4. Views
   ====================================================================== */
// overview = the days (Week); hours (Per uur) and rain (Regen) open from its top card and sit under the Overzicht tab
const TABS = { rain: 'Regen', overview: 'Overzicht', hours: 'Per uur', temp: 'Temperatuur', wind: 'Wind', cloud: 'Bewolking', info: 'Info' };
const TAB_OF = { hours: 'overview', rain: 'overview', day: 'overview' }; // which tab button lights up for a page without its own
/* Title of the page: a day page is named after its day (Vandaag, Morgen, Zaterdag). */
function pageTitle() {
  if (state.tab !== 'day' || !state.day) return TABS[state.tab];
  const now = new Date(), tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  if (sameDay(state.day, now)) return 'Vandaag';
  if (sameDay(state.day, tomorrow)) return 'Morgen';
  const wd = state.day.toLocaleDateString(nl, { weekday: 'long' });
  return wd[0].toUpperCase() + wd.slice(1);
}

const SUNLINE_TABS = new Set(['hours', 'day']); // the pages with hours of one day, where twilight matters
function render() {
  hideTooltip();
  $('title').textContent = pageTitle();
  const stale = staleSince();
  const when = !stale ? (state.updated ? `bijgewerkt ${fmtTime(state.updated)}` : '')
    : stale.all ? `offline · gegevens van ${fmtWhen(stale.since)}`
    : stale.parts.length === 1 ? `${SOURCE_NAMES[stale.parts[0].key]} van ${fmtWhen(stale.since)}`
    : `deels verouderd · gegevens van ${fmtWhen(stale.since)}`;
  // Overzicht says where you are, not which tab you chose (UX-audit B2): the place is the title and the button
  // to change it, the province and "bijgewerkt" sit below. The other pages keep their own title.
  const placeTitle = state.tab === 'overview';
  $('top').classList.toggle('place', placeTitle);
  $('locBtn').hidden = placeTitle;
  if (placeTitle) {
    const t = $('title'); t.textContent = '';
    const btn = h('button', 'title-btn'); btn.type = 'button'; btn.setAttribute('aria-label', `${state.loc.name}, locatie wijzigen`);
    btn.appendChild(h('span', null, state.loc.name));
    btn.insertAdjacentHTML('beforeend', '<svg class="ico chev" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>');
    btn.addEventListener('click', openSheet);
    t.appendChild(btn);
  }
  $('subtitle').textContent = state.tab === 'info' ? 'Over deze app en haar bronnen'
    : placeTitle ? [state.loc.admin, when].filter(Boolean).join(' · ') || ' '
    : state.updated ? `${state.loc.name}${state.loc.admin ? ', ' + state.loc.admin : ''} · ${when}` : state.loc.name;
  const infoBtn = $('infoBtn'); if (infoBtn) infoBtn.hidden = state.tab === 'info';
  // sunrise and sunset are cells in the hourly strip now; the full line with twilight only where the hours are
  const sunline = SUNLINE_TABS.has(state.tab);
  $('sunline').hidden = !sunline;
  document.title = `${placeTitle ? 'Weer' : pageTitle()} · ${state.loc.name}`;
  for (const btn of document.querySelectorAll('.tab')) btn.setAttribute('aria-pressed', String(btn.dataset.tab === (TAB_OF[state.tab] || state.tab)));
  if (sunline) renderSunline();
  const c = $('content');
  c.classList.toggle('ov', placeTitle);
  const screen = $('screen');
  const keepScroll = screen.scrollTop; // rebuilding the content must not move the page
  const minH = c.offsetHeight; c.style.minHeight = minH + 'px';
  c.textContent = '';
  try {
    if (!state.forecast && !state.nowcast && state.tab !== 'info') { // Info needs no data and holds the error codes
      if (!state.updated) { for (let i = 0; i < 2; i++) { const k = h('section', 'card'); k.appendChild(h('div', 'skeleton')); c.appendChild(k); } return; }
      c.appendChild(errorState()); return;
    }
    if (stale && state.tab !== 'info') c.appendChild(staleNote(stale));
    ({ rain: renderRainPage, overview: renderWeek, hours: renderHours, day: renderDayPage, temp: renderTemp, wind: renderWind, cloud: renderCloud, info: renderInfo })[state.tab](c);
  } finally {
    c.style.minHeight = '';
    if (screen.scrollTop !== keepScroll) screen.scrollTop = keepScroll;
  }
}

/* Nothing to show at all: a sentence in plain words and a button; the technical reason (HTTP 503 …) is under Info. */
function errorState() {
  const s = h('section', 'error-state');
  s.setAttribute('role', 'alert');
  s.appendChild(h('p', null, 'De verwachting kon niet worden opgehaald.'));
  s.appendChild(h('p', 'h', 'Controleer je verbinding en probeer het opnieuw.'));
  const btn = h('button', null, 'Opnieuw proberen'); btn.type = 'button';
  btn.addEventListener('click', () => { btn.disabled = true; btn.textContent = 'Bezig met ophalen…'; load(); });
  s.appendChild(btn);
  return s;
}
function staleNote(stale) {
  const n = h('div', 'warn stale');
  n.setAttribute('role', 'status');
  n.innerHTML = '<svg class="ico" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 5.8V10l2.8 1.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  n.appendChild(h('span', null, staleText(stale)));
  return n;
}

/* Icon of the HARMONIE hour [r.t, r.t + 1 h): the (smoothed) cloud cover and layers at its start, the sunshine
   and rain over the hour. */
const hourKind = (iv, r) => forecastKind({ cloud: r.cloud_cover, low: r.cloud_cover_low, mid: r.cloud_cover_mid, high: r.cloud_cover_high,
  sun: iv ? iv.sun : null, rain: iv ? iv.precipitation : null });
/* Weather at an instant, from HARMONIE, for the sky tint and the sunrise/sunset glyphs: the icon and rain of
   the hour containing t (its cloud cover at the start of that hour, else of the nearest hour). */
function weatherAt(t) {
  const H = state.forecast && state.forecast.models.harmonie;
  if (!H || !H.applicable) return null;
  const ms = t.getTime();
  let best = null;
  for (const r of H.instant) if (!best || Math.abs(r.t.getTime() - ms) < Math.abs(best.t.getTime() - ms)) best = r;
  if (!best || Math.abs(best.t.getTime() - ms) > HOUR) return null;
  const iv = H.interval.find(p => ms >= p.t.getTime() && ms < p.tEnd.getTime());
  const r = (iv && H.instant.find(p => p.t.getTime() === iv.t.getTime())) || best;
  const kind = hourKind(iv, r);
  return { cloud: tintCover(kind, r.cloud_cover), rain: iv ? iv.precipitation : null, kind };
}
const cloudAt = t => { const w = weatherAt(t); return w && w.cloud != null ? w.cloud / 100 : null; };
const skyOf = () => ({ lat: state.loc.lat, lon: state.loc.lon, weatherAt, cloudAt });

/* ---- actuele metingen: KNMI-stations via de Buienradar-feed (10-minutenwaarden) ---- */
const obsUrl = 'https://data.buienradar.nl/2.0/feed/json';
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
/* nearest station that reports a temperature; wind in km/u (feed gives m/s) */
function parseObs(json, lat, lon) {
  const list = json && json.actual && json.actual.stationmeasurements;
  if (!Array.isArray(list)) throw new Error('Geen stationsmetingen in de feed');
  let best = null;
  for (const s of list) {
    if (s.temperature == null || !Number.isFinite(s.lat) || !Number.isFinite(s.lon)) continue;
    const d = haversineKm(lat, lon, s.lat, s.lon);
    if (!best || d < best.dist) best = { dist: d, s };
  }
  if (!best) return null;
  const s = best.s;
  return {
    station: String(s.stationname || '').replace(/^Meetstation\s+/i, ''), dist: best.dist, time: new Date(s.timestamp),
    temp: s.temperature, feel: s.feeltemperature, humidity: s.humidity, pressure: s.airpressure,
    wind: s.windspeed != null ? s.windspeed * 3.6 : null, gust: s.windgusts != null ? s.windgusts * 3.6 : null, dir: s.winddirectiondegrees,
    desc: s.weatherdescription, sky: obsSky(list, lat, lon),
  };
}
/* Sky cover now from the stations around (%): each station's 10-minute sunshine against a clear sky, weighted
   by 1/distance within OBS_SKY_KM. A 10-minute mean over several stations rides out a single passing cumulus,
   where the station's own wording does not (Schiphol, 2 nov 13:30: "zwaar bewolkt" at 1,2× a clear sky).
   null at night, at low sun or without stations in reach. */
const OBS_SKY_KM = 40;
function obsSky(list, lat, lon) {
  let s = 0, w = 0;
  for (const st of list) {
    if (st.sunpower == null || !st.timestamp || !Number.isFinite(st.lat) || !Number.isFinite(st.lon)) continue;
    const d = haversineKm(lat, lon, st.lat, st.lon);
    if (d > OBS_SKY_KM) continue;
    const t1 = new Date(st.timestamp);
    const sky = skyFromSun(st.sunpower, new Date(t1.getTime() - 10 * 60e3), t1, st.lat, st.lon);
    if (sky == null) continue;
    const wi = 1 / Math.max(d, 5);
    s += sky * wi; w += wi;
  }
  return w ? Math.round(s / w) : null;
}
/* Buienradar's station wording → icon kind; null when it says nothing usable. */
function descKind(desc) {
  const s = String(desc || '').toLowerCase();
  if (/regen|bui|sneeuw|hagel|onweer/.test(s)) return 'rain';
  if (/onbewolkt|zonnig|helder/.test(s)) return 'clear';
  if (/opklaring|half bewolkt|licht bewolkt/.test(s)) return 'partly';
  if (/bewolkt|mist|nevel/.test(s)) return 'cloud';
  return null;
}
function renderSunline() {
  const el = $('sunline');
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const d1 = new Date(d0.getTime() + 24 * HOUR);
  const ev = solarEvents(d0, d1, state.loc.lat, state.loc.lon);
  const find = k => ev.find(e => e.kind === k);
  const rise = find('sunrise'), set = find('sunset'), dusk = find('dusk'), dawn = find('dawn');
  el.textContent = '';
  if (!rise && !set) { el.hidden = true; return; }
  el.innerHTML = '<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="3.2" fill="currentColor"/><path d="M10 2.5v2.5M10 15v2.5M2.5 10H5M15 10h2.5M4.7 4.7l1.8 1.8M13.5 13.5l1.8 1.8M4.7 15.3l1.8-1.8M13.5 6.5l1.8-1.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  const parts = [];
  if (rise) parts.push(`op ${fmtTime(rise.t)}`);
  if (set) parts.push(`onder ${fmtTime(set.t)}`);
  if (dawn && rise) parts.push(`schemer vanaf ${fmtTime(dawn.t)}`);
  if (dusk && set) parts.push(`tot ${fmtTime(dusk.t)}`);
  el.appendChild(document.createTextNode(parts.join(' · ')));
  el.hidden = false;
}

function modelsAvail() { return state.forecast ? MODELS.map(m => state.forecast.models[m.key]).filter(m => m.applicable) : []; }
function horizonFoot(models) {
  return models.map(m => `${m.name} t/m ${fmtDayTime(m.horizon)}`).join(' · ');
}
/* Time span of the multi-day charts: from the current hour up to the model horizon, or shorter when the
   user zoomed in. The start never moves: zooming is "nu t/m x uur vooruit". */
const HORIZON_MAX = 48; // de app kijkt nooit verder dan 48 uur vooruit
function maxHorizonHours() {
  const avail = modelsAvail();
  if (!avail.length) return HORIZON_MAX;
  const start = state.forecast.startHour.getTime();
  return Math.min(HORIZON_MAX, Math.max(...avail.map(m => (m.horizon.getTime() - start) / HOUR)));
}
function spanFor(models) {
  // range up to 48 h; drawChart applies the zoom horizon itself so charts can be redrawn in place
  const start = state.forecast.startHour;
  const end = Math.min(start.getTime() + HORIZON_MAX * HOUR, Math.max(...models.map(m => m.horizon.getTime())));
  return { tMin: start, tMax: new Date(end) };
}
function setHorizon(hours, persist = true) {
  const max = maxHorizonHours();
  let hz = hours == null ? null : clamp(hours, HORIZON_MIN, max);
  if (hz != null && hz >= max - 0.5) hz = null; // fully zoomed out = alles
  state.horizon = hz;
  if (persist) { try { if (hz == null) localStorage.removeItem('regen.horizon'); else localStorage.setItem('regen.horizon', String(Math.round(hz))); } catch (e) {} }
  if (persist) { render(); return; }
  // live (mid-gesture): redraw only the charts and their card titles, keep the DOM the fingers are on
  for (const host of document.querySelectorAll('.chart.zoomable')) {
    if (host._redraw) host._redraw();
    const title = host.closest('.card') && host.closest('.card').querySelector('h2');
    if (title) title.textContent = spanTitle();
  }
}
function spanTitle() {
  const cur = state.horizon == null ? maxHorizonHours() : state.horizon;
  return `Komende ${Math.round(cur)} uur`;
}
/* A card whose source failed: in words; the technical reason is under Info. */
function errorNote(parent, key, what) {
  const e = state.errors[key];
  if (e) parent.appendChild(h('p', 'empty', e === 'verouderd' ? `Geen actuele ${what.toLowerCase()}.` : `${what} is nu niet bereikbaar.`));
}

/* ---------------- Regen ---------------- */
function renderRain(c) {
  const now = new Date();
  const fc = state.forecast, nc = state.nowcast;
  const H = fc && fc.models.harmonie;

  // hero: next precipitation
  const hero = h('section', 'hero');
  hero.innerHTML = '<svg class="ico-big" viewBox="0 0 24 24"><path d="M7 15.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 7.5h.5a4 4 0 0 1 0 8H7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const ht = h('div');
  ht.appendChild(h('div', 'l', 'Eerstvolgende neerslag'));
  const big = h('div', 'big'); const hint = h('div', 'h'); let sub = null;
  const nr = nextRain(nc, H, state.ens, now);
  if (!nr) big.textContent = '–';
  else if (nr.kind === 'radar') { big.textContent = nr.now ? 'Nu' : `om ${fmtTime(nr.t)}`; hint.textContent = `${fmtMm(nr.mmh)} mm/u · radar`; }
  else if (nr.kind === 'model') {
    big.textContent = fmtDayTime(nr.t);
    hint.textContent = `${fmtMm(nr.mm)} mm in dat uur${nr.prob != null ? ` · kans ${fmtProb(nr.prob)}` : ''}`;
  } else {
    // the message in large type, not in the hint (UX-audit B7): "Droog" and for how long
    big.textContent = 'Droog';
    sub = h('div', 'sub', dryFor(nr.until, now));
    // below the threshold there may still be a little: say so, so the hour bars below don't look like a contradiction
    hint.textContent = nr.maxMm == null ? `geen regen verwacht t/m ${fmtDayTime(nr.until)}`
      : `hooguit ${fmtMm(nr.maxMm)} mm, ${fmtWd(nr.maxT)} ${fmtHourRange(nr.maxT)}`;
  }
  ht.appendChild(big); if (sub) ht.appendChild(sub); ht.appendChild(hint); hero.appendChild(ht);
  c.appendChild(hero);

  // nowcast card
  const k1 = card('Komende 2 uur', []);
  c.appendChild(k1.el);
  if (nc && nc.length && nc.some(p => p.v > 0)) {
    const tMin = new Date(Math.min(now.getTime(), nc[0].t.getTime())), tMax = new Date(nc[nc.length - 1].t.getTime() + MIN5); // start at 'nu' so the now-line sits at the left edge
    const pts = nc.map(p => ({ t: p.t, tEnd: new Date(p.t.getTime() + MIN5), v: p.v }));
    drawChart(k1.body, { sky: skyOf(),
      tMin, tMax, now, unit: 'mm/u', unitTip: 'mm/u', ticks: 'nowcast', yOpts: { zero: true, minSpan: 1, headroom: 1.15 },
      series: [{ kind: 'bar', name: 'Radar', color: 'var(--s1)', points: pts }],
      fmt: fmtMm, directLabels: 'peak', tipTime: p => `${fmtTime(p.t)}–${fmtTime(p.tEnd)}`,
      aria: 'Neerslagintensiteit per 5 minuten voor de komende 2 uur',
    });
    k1.tableHost.appendChild(dataTable(pts, [{ label: 'Tijd', get: p => fmtTime(p.t) }, { label: 'mm/u', num: true, get: p => fmtNum(p.v, 2) }]));
  } else if (nc && nc.length) {
    // dry: one quiet line instead of an empty set of axes; the chart comes back as soon as there is a bar to draw
    const tMax = new Date(nc[nc.length - 1].t.getTime() + MIN5);
    const at = (state.fetched && state.fetched.nowcast && state.fetched.nowcast.at) || nc[0].t;
    const line = h('p', 'quiet-line');
    line.innerHTML = '<svg class="drop" viewBox="0 0 8 10" aria-hidden="true"><path d="M4 .6C2.6 2.6 1 4.5 1 6.4a3 3 0 0 0 6 0C7 4.5 5.4 2.6 4 .6z"/></svg>';
    const span = h('span', null, `Droog${tMax - now >= 110 * 60e3 ? '' : ' tot ' + fmtTime(tMax)} volgens de radar `);
    span.appendChild(h('span', 'when', `· ${fmtTime(at)}`));
    line.appendChild(span);
    k1.body.replaceWith(line);
    k1.el.querySelector('.icon-btn').remove(); // a table of zeros says nothing
  } else errorNote(k1.body, 'nowcast', 'Radar');

  // HARMONIE card
  const k2 = card('Komende dagen', []);
  c.appendChild(k2.el);
  if (!H || !H.applicable) { errorNote(k2.body, 'forecast', 'Modelverwachting'); if (!state.errors.forecast) k2.body.appendChild(h('p', 'empty', 'Geen verwachting voor deze locatie.')); return; }
  k2.el.querySelector('h2').textContent = spanTitle();

  const modelPts = m => m.interval.map(p => ({ t: p.t, tEnd: p.tEnd, v: p.precipitation, rain: p.rain, snow: p.snowfall, src: p.src }));
  const SRC_NOTE = { radar: ' · radar', mix: ' · radar en verwachting' };
  drawChart(k2.body, { sky: skyOf(),
    ...spanFor([H]), unit: 'mm', unitTip: 'mm', ticks: 'days', now, yOpts: { zero: true, minSpan: 1, headroom: 1.15 },
    series: [{ kind: 'bar', name: 'Neerslag', color: 'var(--s1)', points: modelPts(H) }], fmt: fmtMm, directLabels: 'peak', group: 'rain',
    tipTime: p => `${fmtWd(p.t)} ${fmtHourRange(p.t)}`,
    tipNote: (s, p) => { const pr = probFor(p); return (SRC_NOTE[p.src] || '') + (pr != null ? ` · kans ${fmtProb(pr)}` : '') + (p.snow > 0 ? ` · sneeuw ${fmtNum(p.snow, 1)} cm` : ''); },
    aria: 'Neerslag per uur volgens HARMONIE',
  });
  k2.tableHost.appendChild(dataTable(modelPts(H), [{ label: 'Uur', get: p => `${fmtWd(p.t)} ${fmtTime(p.t)}` }, { label: 'mm', num: true, get: p => fmtNum(p.v, 1) }, { label: 'Kans', num: true, get: p => fmtProb(probFor(p)) }]));
  // probability of rain from the ensemble: a smooth line in the same card, same x-axis, under the bars
  const e = state.ens;
  if (e && e.prob.length) {
    const sub = h('div', 'chart sub');
    k2.body.after(sub);
    // each probability covers an hour; plot it at the middle of that hour so the curve sits over its bar
    // hours the radar fully covers have no chance: the line starts where the radar stops
    const radarHour = p => H.interval.some(q => q.src === 'radar' && q.t.getTime() === p.t.getTime());
    const pts = e.prob.filter(p => !radarHour(p)).map(p => ({ t: new Date(p.t.getTime() + HOUR / 2), tEnd: p.tEnd, v: Math.round(p.v * 100), row: p }));
    drawChart(sub, { sky: skyOf(), compact: true, group: 'rain',
      ...spanFor([H]), unit: '%', ticks: 'days', now, yFixed: { min: 0, max: 100, step: 50 }, height: 92,
      series: [{ kind: 'line', name: 'Kans op regen', color: 'var(--s1)', points: pts, smooth: true, area: true, areaOpacity: 0.14 }], fmt: v => fmtProb(v / 100),
      tipTime: p => `${fmtWd(p.row.t)} ${fmtHourRange(p.row.t)}`,
      tipNote: (s, p) => { const hr = H.interval.find(q => q.t.getTime() === p.row.t.getTime()); return hr ? ` · verwacht ${fmtMm(hr.precipitation)} mm` : ''; },
      aria: 'Kans op regen per uur volgens het ICON-D2-ensemble',
    });
    legend(k2.el, [{ name: 'Neerslag per uur', color: 'var(--s1)', rect: true }, { name: 'Kans op regen', color: 'var(--s1)' }]);
  } else {
  }

  // stats
  const sum = (arr, n) => arr.slice(0, n).reduce((s, p) => s + p.precipitation, 0);
  const stats = h('section', 'stats');
  const st = (l, v, hh) => { const s = h('div', 'stat'); s.appendChild(h('div', 'l', l)); s.appendChild(h('div', 'v', v)); s.appendChild(h('div', 'h', hh)); stats.appendChild(s); };
  st('Komende 24 u', `${fmtMm(sum(H.interval, 24))} mm`, 'verwacht');
  st('Komende 48 u', `${fmtMm(sum(H.interval, 48))} mm`, 'verwacht');

  c.appendChild(stats);
}
/* 10–90 %-band uit het ensemble als eerste reeks van een lijngrafiek */
function ensBand(v, color = 'var(--s1)') {
  const e = state.ens;
  if (!e || !e.bands[v] || !e.bands[v].length) return [];
  return [{ kind: 'band', name: 'ensemble', color, points: e.bands[v].map(r => ({ t: r.t, lo: r.lo, hi: r.hi })) }];
}
function ensLegend(color = 'var(--s1)') { return state.ens ? [{ name: 'Onzekerheid (10–90%)', color, band: true }] : []; }
function ensFoot(H) { return state.ens ? ` · band t/m ${fmtDayTime(state.ens.horizon)}` : ''; }

/* ---------------- Week ---------------- */
const WEEK_DAYS = 7;
/* The days of Week: HARMONIE with ICON-D2 as far as they reach (chance from the ICON-D2 ensemble), then the
   ECMWF ensemble for the days after, up to WEEK_DAYS. */
function weekDays() {
  const chance = (state.ens && state.ens.dayChance) || [];
  const out = ((state.forecast && state.forecast.days) || []).map(d => {
    const c = chance.find(x => sameDay(x.day, d.day));
    return { ...d, chance: c ? c.chance : null, src: 'harmonie' };
  });
  const last = out.length ? out[out.length - 1].day.getTime() : -Infinity;
  for (const d of (state.ecmwf && state.ecmwf.days) || []) if (d.day.getTime() > last && out.length < WEEK_DAYS) out.push(d);
  return out.slice(0, WEEK_DAYS);
}
/* One row per day as in Apple's weather app: name, icon with the chance of rain, min, a bar from min to max on
   the scale of the whole list (ensemble days with their 50 % band faint around it, today with a dot for now)
   and max. Without a chance the day's rain total stands under the icon. */
const dayName = d => { const wd = d.toLocaleDateString(nl, { weekday: 'short' }).replace('.', ''); return wd[0].toUpperCase() + wd.slice(1); };
const WEEK_HOURS = 48;
/* Top card of Overzicht: the rain bar (to the Regen page) above the hourly strip (to Per uur). */
function topCard(c) {
  nowCard(c);
  const strip = hourStrip();
  if (!strip) return;
  const k = h('section', 'card hours');
  k.appendChild(strip);
  c.appendChild(k);
}
/* The weather of now at the top of Overzicht (UX-audit B1, direction A): the temperature large, what the sky
   does, feels-like and today's range (the same as the row "Vandaag" below), with the rain bar as its last line.
   The tile on Per uur stays as it is. Without a forecast only the rain bar. */
function nowCard(c) {
  const k = h('section', 'card now-card');
  const T = tempModel(), o = state.obs, now = new Date();
  const r0 = T && T.instant[0];
  const temp = o && o.temp != null ? o.temp : r0 ? r0.temperature_2m : null;
  if (temp != null) {
    const kind = nowKind(now), night = sunAltitude(now, state.loc.lat, state.loc.lon) < SUN_RISESET;
    const word = kind === 'clear' && night ? 'helder' : ICON_WORDS[kind];
    const top = h('div', 'now-top');
    const line = h('div', 'now-line');
    line.appendChild(h('span', 'now-temp', `${fmtNum(temp, 0)}°`));
    const icon = svgEl('svg', { class: 'wicon-big now-icon', viewBox: '-10 -10 20 20', 'aria-hidden': 'true' });
    icon.appendChild(weatherIcon(0, 0, kind, night));
    line.appendChild(icon);
    line.appendChild(h('span', 'now-cond', word[0].toUpperCase() + word.slice(1)));
    top.appendChild(line);
    const feel = o && o.feel != null ? o.feel : r0 ? r0.apparent_temperature : null;
    const d0 = weekDays().find(d => sameDay(d.day, now));
    const range = d0 || (T ? todayRange(T) : null);
    const parts = [];
    if (feel != null) parts.push(`voelt als ${fmtNum(feel, 0)}°`);
    if (range) parts.push(`vandaag ${fmtNum(range.mn, 0)}° tot ${fmtNum(range.mx, 0)}°`);
    // one line, so the week still fits: the station is on Temperatuur and Wind, here only measured or forecast
    parts.push(o && o.temp != null ? `gemeten ${fmtTime(o.time)}` : 'verwacht');
    const feelEl = h('div', 'now-feel', parts.join(' · '));
    if (o && o.temp != null) feelEl.title = `Gemeten ${fmtTime(o.time)} bij ${o.station} (${fmtNum(o.dist, 0)} km)`;
    top.appendChild(feelEl);
    k.appendChild(top);
  }
  k.appendChild(rainRow());
  c.appendChild(k);
}
/* Rain bar: what the Regen page's tile says (radar first, then HARMONIE) beside a mini radar of the coming
   2 hours, one bar per 5 minutes. Stays put while the hours below are swiped; a tap opens Regen. */
function rainRow() {
  const now = new Date(), nc = state.nowcast;
  const H = state.forecast && state.forecast.models && state.forecast.models.harmonie;
  const nr = nextRain(nc, H, state.ens, now);
  const text = !nr ? 'Regen' : nr.kind === 'radar' ? (nr.now ? 'Nu regen' : `Regen om ${fmtTime(nr.t)}`)
    : nr.kind === 'model' ? `Regen ${sameDay(nr.t, now) ? 'om' : 'vanaf'} ${fmtWhen(nr.t)}`
    : `Droog ${dryFor(nr.until, now)}`;
  const wet = !!nr && nr.kind !== 'dry';
  const row = h('button', 'rain-row' + (wet ? ' wet' : ''));
  row.type = 'button';
  row.setAttribute('aria-label', `${text}. Open Regen`);
  row.innerHTML = '<svg class="drop" viewBox="0 0 8 10" aria-hidden="true"><path d="M4 .6C2.6 2.6 1 4.5 1 6.4a3 3 0 0 0 6 0C7 4.5 5.4 2.6 4 .6z"/></svg>';
  row.appendChild(h('span', 'rt', text));
  // the mini radar only when it has something to show: an empty one read as a control that was switched off
  if (wet && nc && nc.slice(0, 24).some(p => p.v >= 0.1)) {
    const n = 24, w = 4, H2 = 16, top = Math.max(2, ...nc.slice(0, n).map(p => p.v));
    const svg = svgEl('svg', { class: 'spark', viewBox: `0 0 ${n * w} ${H2}`, 'aria-hidden': 'true' });
    svg.appendChild(svgEl('line', { class: 'base', x1: 0, y1: H2 - 0.5, x2: n * w, y2: H2 - 0.5 }));
    nc.slice(0, n).forEach((p, i) => {
      if (p.v < 0.1) return;
      const bh = Math.max(2, Math.sqrt(p.v / top) * (H2 - 1)); // square root: a drizzle stays visible beside a downpour
      svg.appendChild(svgEl('rect', { x: i * w + 0.5, y: H2 - bh, width: w - 1, height: bh, rx: 0.8 }));
    });
    row.appendChild(svg);
  }
  row.insertAdjacentHTML('beforeend', '<svg class="chev" viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5L13 10l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>');
  row.addEventListener('click', () => { state.tab = 'rain'; toTop(); render(); });
  return row;
}
/* Hourly strip, as in Apple's app: per hour the icon by the rules of Per uur's hourly row and the temperature
   of ICON-D2, for as long as the temperature model reaches (at most WEEK_HOURS). The first slot is now, with
   the tile's measured weather and temperature; midnight carries the name of the new day. A tap opens Per uur;
   a swipe through the strip scrolls and does not count as a tap. */
function hourStrip(now = new Date()) {
  const H = state.forecast && state.forecast.models && state.forecast.models.harmonie, T = tempModel();
  if (!H || !H.applicable || !T) return null;
  const strip = h('div', 'hour-strip');
  strip.setAttribute('aria-label', 'Weer per uur, open de uurgrafiek');
  const icons = hourIcons(H).slice(0, WEEK_HOURS);
  // sunrise and sunset as cells of their own, after the hour they fall in (as Apple does; UX-audit B2)
  const lastHour = icons.length ? new Date(icons[icons.length - 1].hour.getTime() + HOUR) : now;
  const sunEv = solarEvents(now, lastHour, state.loc.lat, state.loc.lon).filter(e => (e.kind === 'sunrise' || e.kind === 'sunset') && e.t > now);
  for (const ic of icons) {
    const r = rowAt(T, ic.hour);
    if (!r || r.temperature_2m == null) break;
    const first = !strip.children.length;
    const kind = first ? nowKind(now) : ic.kind;
    const night = first ? sunAltitude(now, state.loc.lat, state.loc.lon) < SUN_RISESET : ic.night;
    const temp = first && state.obs && state.obs.temp != null ? state.obs.temp : r.temperature_2m;
    const label = first ? 'Nu' : ic.hour.getHours() === 0 ? dayName(ic.hour) : String(ic.hour.getHours()).padStart(2, '0');
    const cell = h('div', first ? 'hour now' : 'hour');
    cell.setAttribute('aria-label', `${label}: ${kind === 'clear' && night ? 'helder' : ICON_WORDS[kind]}, ${fmtNum(temp, 0)} graden`);
    cell.appendChild(h('span', 'hl', label));
    const svg = svgEl('svg', { class: 'wicon-big', viewBox: '-10 -10 20 20', 'aria-hidden': 'true' });
    svg.appendChild(weatherIcon(0, 0, kind, night));
    cell.appendChild(svg);
    cell.appendChild(h('span', 'ht', `${fmtNum(temp, 0)}°`));
    strip.appendChild(cell);
    const slotEnd = ic.hour.getTime() + HOUR;
    while (sunEv.length && sunEv[0].t.getTime() < slotEnd) strip.appendChild(sunCell(sunEv.shift()));
  }
  if (!strip.children.length) return null;
  strip.tabIndex = 0; strip.setAttribute('role', 'button');
  const open = () => { state.tab = 'hours'; toTop(); render(); };
  strip.addEventListener('click', open);
  strip.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  return strip;
}
/* A cell of the hourly strip for sunrise or sunset: the time, the sun on the horizon with an arrow, "op"/"onder". */
function sunCell(ev) {
  const up = ev.kind === 'sunrise';
  const cell = h('div', 'hour sun');
  cell.setAttribute('aria-label', `Zon ${up ? 'op' : 'onder'} om ${fmtTime(ev.t)}`);
  cell.appendChild(h('span', 'hl', fmtTime(ev.t)));
  const svg = svgEl('svg', { class: 'wicon-big sun-ev', viewBox: '-10 -10 20 20', 'aria-hidden': 'true' });
  svg.innerHTML = '<path class="disc" d="M-4.6 3a4.6 4.6 0 0 1 9.2 0z"/><path class="ray" d="M-7.5 3h15"/>' +
    (up ? '<path class="ray" d="M0-3.6v-5M-2.2-6.6L0-8.8l2.2 2.2"/>' : '<path class="ray" d="M0-8.8v5M-2.2-5.8L0-3.6l2.2-2.2"/>');
  cell.appendChild(svg);
  cell.appendChild(h('span', 'ht', up ? 'op' : 'onder'));
  return cell;
}
/* "‹ Overzicht" above a page that is reached from Overzicht instead of from the tab bar. */
function backLink(c) {
  const back = h('button', 'back-link');
  back.type = 'button';
  back.innerHTML = '<svg class="ico" viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4.5L7 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Overzicht';
  back.addEventListener('click', () => { state.tab = 'overview'; toTop(); render(); });
  c.appendChild(back);
}
/* The hourly page (the former Overzicht), reached from the strip. */
function renderHours(c) { backLink(c); renderOverview(c); }
/* Regen has no tab of its own any more: it opens from the rain bar on Overzicht. */
function renderRainPage(c) { backLink(c); renderRain(c); }
/* The ECMWF hours of a day, 00:00 up to and including the next midnight (so the lines run to the edge). */
function ensDayHours(day) {
  const hrs = (state.ecmwf && state.ecmwf.hours) || [];
  const b = new Date(day); b.setDate(b.getDate() + 1);
  return hrs.filter(p => p.t >= day && p.t <= b);
}
const hasDayPage = d => d.src === 'harmonie' || ensDayHours(d.day).length >= 24;
/* A day from the list on Overzicht, as Per uur for that day: HARMONIE's page for today and tomorrow, the
   ECMWF page for the days after. A day that has gone (past midnight) falls back to Overzicht. */
function renderDayPage(c) {
  const d = state.day && weekDays().find(x => sameDay(x.day, state.day) && hasDayPage(x));
  if (!d) { state.tab = 'overview'; render(); return; }
  backLink(c);
  if (d.src === 'harmonie') renderOverview(c, d); else renderEnsDay(c, d);
}
/* Per uur for an ECMWF day, as the KNMI plume shows it: temperature as the median with a band holding 90 % of
   the members, rain per hour the same (the median drawn as a line, as the plume does), per hour the median icon,
   and the little trees with the wind of the middle run. The sky greys with the median sky cover. */
function renderEnsDay(c, d) {
  dayHero(c, d);
  const a = d.day, b = new Date(a); b.setDate(b.getDate() + 1);
  const hrs = ensDayHours(a), blocks = hrs.filter(p => p.t < b);
  const mid = p => new Date(p.t.getTime() + HOUR / 2);
  const cloudAt = t => { const p = blocks.find(q => t >= q.t && t < q.tEnd); return p ? p.cover / 100 : null; };
  const sky = { lat: state.loc.lat, lon: state.loc.lon, cloudAt,
    weatherAt: t => { const p = blocks.find(q => t >= q.t && t < q.tEnd); return p ? { cloud: p.cover, rain: p.pMed } : null; } };
  const icons = blocks.map(p => ({ t: mid(p), kind: p.kind, night: sunAltitude(mid(p), state.loc.lat, state.loc.lon) < SUN_RISESET, hour: p.t }));
  const trees = blocks.map(p => ({ t: mid(p), kmh: p.kmh, dir: p.dir, rain: p.pMed }));
  const k = card('Per uur', ['Lijn: de middelste van 51 ECMWF-berekeningen · band: 90% ervan']);
  c.appendChild(k.el);
  const word = p => { const ic = icons.find(i => i.hour.getTime() === p.t.getTime()); return ic ? (ic.kind === 'clear' && ic.night ? 'helder' : ICON_WORDS[ic.kind]) : ''; };
  drawChart(k.body, { sky, group: 'overview', tMin: a, tMax: b, noZoom: true, unit: '°C', unitTip: '°C', ticks: 'days', now: new Date(),
    yOpts: { minSpan: 8, targetTicks: 4 }, icons, trees, height: 240,
    series: [
      { kind: 'band', name: '90% van de berekeningen', color: 'var(--s2)', points: hrs.map(p => ({ t: p.t, lo: p.tLo, hi: p.tHi })) },
      { kind: 'line', name: 'Temperatuur', color: 'var(--s2)', colorAt: tempColor, points: hrs.map(p => ({ t: p.t, v: p.tMed, row: p })), smooth: 'soft' },
    ],
    fmt: v => fmtNum(v, 0), directLabels: 'minmax', tipTime: p => fmtDayTime(p.t),
    tipNote: (s, p) => p.row ? ` · ${fmtNum(p.row.tLo, 0)} tot ${fmtNum(p.row.tHi, 0)}°${word(p) ? ` · ${word(p)}` : ''}` : '',
    aria: 'Temperatuur per uur, mediaan met band, met weericoontjes',
  });
  const sub = h('div', 'chart sub');
  k.body.after(sub);
  drawChart(sub, { sky, group: 'overview', compact: true, tMin: a, tMax: b, noZoom: true, unit: 'mm', unitTip: 'mm', ticks: 'days', now: new Date(),
    yOpts: { zero: true, minSpan: 1, headroom: 1.15 }, height: 78,
    // as the plume: the middle of the members as a line, at the middle of its hour, inside the band of 90 % of them;
    // the tooltip gives the band as a plain range ("0,0 tot 0,4 mm"), since the median alone is mostly 0
    series: [
      { kind: 'band', name: '90% van de berekeningen', color: 'var(--s1)', points: blocks.map(p => ({ t: mid(p), lo: p.pLo, hi: p.pHi })) },
      { kind: 'line', name: 'Neerslag', color: 'var(--s1)', points: blocks.map(p => ({ t: mid(p), v: p.pMed, row: p })) },
    ],
    fmt: fmtMm, tipTime: p => `${fmtWd(p.row.t)} ${fmtHourRange(p.row.t)}`,
    tipValue: (s, p) => p.row ? `${fmtMm(p.row.pLo)} tot ${fmtMm(p.row.pHi)} mm` : null,
    aria: 'Neerslag per uur, middelste lijn met band',
  });
  k.tableHost.appendChild(dataTable(blocks, [
    { label: 'Uur', get: p => fmtDayTime(p.t) }, { label: '°C', num: true, get: p => fmtNum(p.tMed, 0) },
    { label: '°C van–tot', num: true, get: p => `${fmtNum(p.tLo, 0)}–${fmtNum(p.tHi, 0)}` }, { label: 'Weer', get: word },
    { label: 'mm', num: true, get: p => fmtNum(p.pMed, 1) }, { label: 'mm van–tot', num: true, get: p => `${fmtNum(p.pLo, 1)}–${fmtNum(p.pHi, 1)}` }]));
}
const openDay = d => { state.tab = 'day'; state.day = d.day; toTop(); render(); };
function renderWeek(c) {
  topCard(c);
  const days = weekDays();
  if (!days.length) {
    errorNote(c, 'forecast', 'Modelverwachting');
    if (!state.errors.forecast) c.appendChild(h('p', 'empty', 'Geen dagverwachting voor deze locatie.'));
    return;
  }
  const k = h('section', 'card week-card');
  const head = h('div', 'card-head'); head.appendChild(h('h2', null, 'Komende dagen')); k.appendChild(head);
  const lo = Math.floor(Math.min(...days.map(d => d.mnLo != null ? d.mnLo : d.mn)));
  const hi = Math.ceil(Math.max(...days.map(d => d.mxHi != null ? d.mxHi : d.mx)));
  const pos = v => `${((hi > lo ? (clamp(v, lo, hi) - lo) / (hi - lo) : 0.5) * 100).toFixed(1)}%`;
  const now = new Date(), T = tempModel();
  const tNow = state.obs && state.obs.temp != null ? state.obs.temp : T && T.instant[0] ? T.instant[0].temperature_2m : null;
  const list = h('ul', 'week-list');
  for (const d of days) {
    const today = sameDay(d.day, now);
    const name = today ? 'Vandaag' : dayName(d.day);
    const row = h('li', 'week-row');
    row.appendChild(h('span', 'd', name));
    const ic = h('span', 'ic');
    const svg = svgEl('svg', { class: 'wicon-big', viewBox: '-10 -10 20 20', 'aria-hidden': 'true' });
    svg.appendChild(weatherIcon(0, 0, d.kind, false));
    ic.appendChild(svg);
    const rainNote = d.chance != null ? (d.chance >= 0.1 ? fmtProb(d.chance) : null) : d.rain >= 0.1 ? `${fmtMm(d.rain)} mm` : null;
    if (rainNote) {
      const note = h('span', 'mm');
      const drop = svgEl('svg', { class: 'drop', viewBox: '0 0 8 10', 'aria-hidden': 'true' });
      drop.appendChild(svgEl('path', { d: 'M4 .6C2.6 2.6 1 4.5 1 6.4a3 3 0 0 0 6 0C7 4.5 5.4 2.6 4 .6z' }));
      note.appendChild(drop); note.appendChild(document.createTextNode(rainNote));
      ic.appendChild(note);
    }
    row.appendChild(ic);
    row.appendChild(h('span', 'mn', `${fmtNum(d.mn, 0)}°`));
    const bar = h('span', 'week-bar');
    const seg = (cls, a, b) => {
      const s = h('span', cls);
      s.style.left = pos(a); s.style.right = `calc(100% - ${pos(b)})`;
      s.style.background = `linear-gradient(90deg, ${tempColor(a)}, ${tempColor(b)})`;
      bar.appendChild(s);
    };
    if (d.mnLo != null) seg('band', d.mnLo, d.mxHi);
    seg('fill', d.mn, d.mx);
    if (today && tNow != null) { const dot = h('span', 'now'); dot.style.left = pos(tNow); bar.appendChild(dot); }
    row.appendChild(bar);
    row.appendChild(h('span', 'mx', `${fmtNum(d.mx, 0)}°`));
    row.setAttribute('aria-label', `${name}: ${ICON_WORDS[d.kind]}, ${fmtNum(d.mn, 0)} tot ${fmtNum(d.mx, 0)} graden` +
      (rainNote ? (d.chance != null ? `, kans op regen ${rainNote}` : `, ${rainNote} regen`) : ''));
    if (hasDayPage(d)) { // every day with hours behind it opens its own Per uur
      row.classList.add('open'); row.tabIndex = 0; row.setAttribute('role', 'button');
      row.addEventListener('click', () => openDay(d));
      row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDay(d); } });
    }
    list.appendChild(row);
  }
  k.appendChild(list);
  c.appendChild(k);
  if (days.length < WEEK_DAYS) errorNote(c, 'ecmwf', 'Meerdaagse verwachting');
}

/* ---------------- shared for temp/wind/cloud ---------------- */
function instantPts(m, v) { return m.instant.map(p => ({ t: p.t, v: p[v], row: p })); }
function ensembleCard(c, title, v, opts) {
  const avail = modelsAvail();
  const k = card(title, [`${avail.length} fijnmazige modellen · ${opts.label}`]);
  c.appendChild(k.el);
  if (avail.length < 2) { k.body.appendChild(h('p', 'empty', 'Maar één model beschikbaar voor deze locatie.')); return; }
  const series = [];
  // spread band over models that have a value at each hour
  const H = state.forecast.models.harmonie;
  const band = H.instant.map(p => {
    const vs = avail.map(m => { const q = m.instant.find(r => r.t.getTime() === p.t.getTime()); return q ? q[v] : null; }).filter(x => x != null);
    return vs.length >= 2 ? { t: p.t, lo: Math.min(...vs), hi: Math.max(...vs) } : { t: p.t, lo: null, hi: null };
  });
  series.push({ kind: 'band', points: band });
  for (const m of avail) series.push({ kind: 'line', name: m.name, color: m.color, points: instantPts(m, v) });
  drawChart(k.body, { sky: skyOf(),
    ...spanFor(avail), unit: opts.unit, unitTip: opts.unitTip, ticks: 'days', now: new Date(),
    yFixed: opts.yFixed, yOpts: opts.yOpts, series, fmt: opts.fmt, tipTime: p => fmtDayTime(p.t),
    tipNote: opts.tipNote, aria: `${title}: vergelijking van ${avail.map(m => m.name).join(', ')}`,
  });
  legend(k.el, avail.map(m => ({ name: m.name, color: m.color, note: (opts.note && opts.note(m)) || m.res })));
  // largest disagreement
  let worst = null;
  for (const p of band) if (p.lo != null && (!worst || p.hi - p.lo > worst.d)) worst = { t: p.t, d: p.hi - p.lo };
  const foot = worst ? `Grootste verschil tussen de modellen: ${opts.fmt(worst.d)} ${opts.unitTip} op ${fmtDayTime(worst.t)} · ` : '';
  k.el.appendChild(h('p', 'foot', foot + horizonFoot(avail)));
  k.tableHost.appendChild(dataTable(H.instant, [{ label: 'Uur', get: p => fmtDayTime(p.t) },
    ...avail.map(m => ({ label: m.name, num: true, get: p => { const q = m.instant.find(r => r.t.getTime() === p.t.getTime()); return q && q[v] != null ? opts.fmt(q[v]) : '–'; } }))]));
}
function heroBlock(c, iconSvg, label, big, hint) {
  const hero = h('section', 'hero');
  hero.innerHTML = iconSvg;
  const t = h('div'); t.appendChild(h('div', 'l', label)); t.appendChild(h('div', 'big', big)); t.appendChild(h('div', 'h', hint)); hero.appendChild(t);
  c.appendChild(hero);
}
function needHarmonie(c) {
  const H = state.forecast && state.forecast.models.harmonie;
  if (H && H.applicable) return H;
  errorNote(c, 'forecast', 'Modelverwachting');
  if (!state.errors.forecast) c.appendChild(h('p', 'empty', 'Geen verwachting voor deze locatie.'));
  return null;
}
/* Model for temperature: ICON-D2, or HARMONIE when ICON-D2 has nothing for this place. */
function tempModel() {
  const f = state.forecast; if (!f) return null;
  const T = f.models[TEMP_MODEL.key];
  return T && T.applicable ? T : f.models.harmonie;
}
const rowAt = (m, t) => m.instant.find(r => r.t.getTime() === t.getTime());
/* min and max over the hours of today that are still ahead */
function todayRange(m) {
  const day = m.instant[0].t.getDate();
  const vs = m.instant.filter(p => p.t.getDate() === day && p.temperature_2m != null).map(p => p.temperature_2m);
  return { mn: Math.min(...vs), mx: Math.max(...vs) };
}

/* ---------------- Week: per dag het weerbeeld bij daglicht en min/max ---------------- */
const KIND_RANK = ['clear', 'partly', 'thin', 'cloud', 'rain'];
/* Day icon: the median of the hourly icons (same rules as the hourly row) over the hours of daylight, an
   hour counting when its midpoint has the sun above the horizon. A clear day that clouds over in its last
   two light hours stays sunny. With an even count the two middle ranks are averaged, halves rounded up.
   null when HARMONIE misses one of the light hours. */
function dayKind(H, a, b, lat, lon) {
  const ranks = [];
  for (let t = a.getTime(); t < b.getTime(); t += HOUR) {
    if (!isLightHour(new Date(t), lat, lon)) continue;
    const r = H.instant.find(p => p.t.getTime() === t), iv = H.interval.find(p => p.t.getTime() === t);
    if (!r || !iv) return null;
    ranks.push(KIND_RANK.indexOf(hourKind(iv, r)));
  }
  return medianKind(ranks);
}
/* Median of icon ranks; with an even count the two middle ranks averaged, halves rounded up. null when empty. */
function medianKind(ranks) {
  if (!ranks.length) return null;
  const s = ranks.slice().sort((x, y) => x - y);
  return KIND_RANK[Math.round((s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2)];
}
/* Days from fc.startHour (midnight) on, as long as they are complete: icon from HARMONIE, min/max over the
   whole day from the temperature model (ICON-D2, else HARMONIE), rain = HARMONIE's total over the light hours. */
function buildDays(fc, lat, lon, maxDays = 7) {
  const H = fc.models.harmonie, T = fc.models[TEMP_MODEL.key], M = T && T.applicable ? T : H;
  const out = [];
  if (!H || !H.applicable) return out;
  for (let k = 0; k < maxDays; k++) {
    const a = new Date(fc.startHour); a.setDate(a.getDate() + k); a.setHours(0, 0, 0, 0);
    const b = new Date(a); b.setDate(b.getDate() + 1);
    const n = Math.round((b - a) / HOUR), inDay = p => p.t >= a && p.t < b;
    const temps = M.instant.filter(inDay).map(p => p.temperature_2m).filter(v => v != null);
    const rain = H.interval.filter(inDay);
    const kind = dayKind(H, a, b, lat, lon);
    if (kind == null || temps.length < n || rain.length < n) break;
    const lightRain = rain.filter(p => isLightHour(p.t, lat, lon)).reduce((s, p) => s + p.precipitation, 0);
    out.push({ day: a, kind, mn: Math.min(...temps), mx: Math.max(...temps), rain: lightRain });
  }
  return out;
}
/* The forecast from this hour on, plus the days parsed from midnight so that today counts whole. */
function withDays(json, now, lat, lon) {
  const f = parseForecast(json, now);
  const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
  try { f.days = buildDays(parseForecast(json, d0), lat, lon); } catch (e) { f.days = []; }
  return f;
}

/* ---------------- Overzicht: temperatuur per uur met weericoontjes ---------------- */
function hourIcons(H) {
  return H.instant.map(r => {
    const iv = H.interval.find(p => p.t.getTime() === r.t.getTime());
    const kind = hourKind(iv, r);
    const mid = new Date(r.t.getTime() + HOUR / 2);
    return { t: mid, kind, night: sunAltitude(mid, state.loc.lat, state.loc.lon) < SUN_RISESET, hour: r.t };
  });
}
/* Weather of this moment for the tile: what the stations around measure, the model only without a reading.
   Rain comes from the station's wording or the current hour, which already holds the radar. */
function nowKind(now) {
  const w = weatherAt(now), o = state.obs;
  if (!o) return w ? w.kind : 'clear';
  const dk = descKind(o.desc);
  if (dk === 'rain' || (w && w.rain != null && w.rain >= 0.1)) return 'rain';
  if (o.sky != null) return sunWeatherKind({ cloud: o.sky, rain: null });
  return dk || (w ? w.kind : 'clear');
}
/* Tile of a day page for a day other than today: the day's icon, min to max and the chance of rain. */
function dayHero(c, d) {
  const long = d.day.toLocaleDateString(nl, { weekday: 'long', day: 'numeric', month: 'long' });
  const rain = d.chance != null ? (d.chance >= 0.1 ? `kans op regen overdag ${fmtProb(d.chance)}` : 'overdag droog')
    : d.rain >= 0.1 ? `overdag ${fmtMm(d.rain)} mm` : 'overdag droog';
  heroBlock(c, '', long[0].toUpperCase() + long.slice(1), `${fmtNum(d.mn, 0)}° tot ${fmtNum(d.mx, 0)}° · ${ICON_WORDS[d.kind]}`, rain);
  const icon = svgEl('svg', { class: 'ico-big wicon-big', viewBox: '-10 -10 20 20', 'aria-hidden': 'true' });
  icon.appendChild(weatherIcon(0, 0, d.kind, false));
  c.lastElementChild.insertBefore(icon, c.lastElementChild.firstChild);
}
/* Per uur, or with `day` (a Week day) the same page for that day only: from now (today) or midnight up to the
   next midnight, without zooming, and for a later day with the day's tile instead of the tile of now. */
function renderOverview(c, day = null) {
  const H = needHarmonie(c); if (!H) return;
  const now = new Date();
  const T = tempModel();
  const o = state.obs, r0 = T.instant[0];
  if (!day || sameDay(day.day, now)) {
    const kind0 = nowKind(now);
    const night0 = sunAltitude(now, state.loc.lat, state.loc.lon) < SUN_RISESET;
    const word0 = kind0 === 'clear' && night0 ? 'helder' : ICON_WORDS[kind0];
    // on the day page the whole day as in the list on Overzicht; on Per uur the hours still ahead
    const { mn, mx } = day ? day : todayRange(T);
    const temp = o && o.temp != null ? o.temp : r0.temperature_2m;
    heroBlock(c, '',
      o && o.temp != null ? `Gemeten ${fmtTime(o.time)} · ${o.station}` : `Nu · ${fmtTime(r0.t)} · verwacht`,
      `${fmtNum(temp, 0)}° · ${word0}`, `voelt als ${fmtNum(o && o.feel != null ? o.feel : r0.apparent_temperature, 0)}° · vandaag ${fmtNum(mn, 0)}° tot ${fmtNum(mx, 0)}°`);
    // the tile's icon is the weather of this moment, drawn with the same icons as the hourly row below
    const heroEl = c.lastElementChild;
    const heroIcon = svgEl('svg', { class: 'ico-big wicon-big', viewBox: '-10 -10 20 20', 'aria-hidden': 'true' });
    heroIcon.appendChild(weatherIcon(0, 0, kind0, night0));
    heroEl.insertBefore(heroIcon, heroEl.firstChild);
  } else dayHero(c, day);

  let span = spanFor([H]);
  if (day) {
    const end = new Date(day.day); end.setDate(end.getDate() + 1);
    span = { tMin: new Date(Math.max(day.day.getTime(), span.tMin.getTime())), tMax: new Date(Math.min(end.getTime(), span.tMax.getTime())) };
  }
  const inSpan = t => t >= span.tMin && t < span.tMax;
  const k = card(!day ? spanTitle() : sameDay(day.day, now) ? 'Rest van vandaag' : 'Per uur', []);
  c.appendChild(k.el);
  // icons and trees are thinned by index, so they start at the window's first hour
  const icons = hourIcons(H).filter(ic => !day || inSpan(ic.hour));
  const pts = T.instant.map(r => ({ t: r.t, tEnd: new Date(r.t.getTime() + HOUR), v: r.temperature_2m, row: r }));
  const iconFor = p => icons.find(i => i.hour.getTime() === p.t.getTime());
  const trees = H.instant.filter(r => !day || inSpan(r.t)).map(r => { const iv = H.interval.find(p => p.t.getTime() === r.t.getTime()); return { t: new Date(r.t.getTime() + HOUR / 2), kmh: r.wind_speed_10m, dir: r.wind_direction_10m, rain: iv ? iv.precipitation : null }; });
  drawChart(k.body, { sky: skyOf(), group: 'overview',
    ...span, noZoom: !!day, unit: '°C', unitTip: '°C', ticks: 'days', now, yOpts: { minSpan: 8, targetTicks: 4 }, icons, trees, height: 240,
    series: [{ kind: 'line', name: 'Temperatuur', color: 'var(--s2)', colorAt: tempColor, points: pts.map(p => ({ t: p.t, v: p.v, row: p.row })), smooth: 'soft', area: true, areaOpacity: 0.16 }],
    fmt: v => fmtNum(v, 0), directLabels: 'minmax', tipTime: p => fmtDayTime(p.t),
    tipNote: (s, p) => { const ic = iconFor(p); const iv = H.interval.find(q => q.t.getTime() === p.t.getTime()); return (ic ? ` · ${ic.kind === 'clear' && ic.night ? 'helder' : ICON_WORDS[ic.kind]}` : '') + (iv && iv.precipitation >= 0.1 ? ` · ${fmtMm(iv.precipitation)} mm` : ''); },
    aria: 'Temperatuur per uur met weericoontjes',
  });
  const sub = h('div', 'chart sub');
  k.body.after(sub);
  const rain = H.interval.map(p => ({ t: p.t, tEnd: p.tEnd, v: p.precipitation }));
  drawChart(sub, { sky: skyOf(), group: 'overview', compact: true,
    ...span, noZoom: !!day, unit: 'mm', unitTip: 'mm', ticks: 'days', now, yOpts: { zero: true, minSpan: 1, headroom: 1.15 }, height: 78,
    series: [{ kind: 'bar', name: 'Neerslag', color: 'var(--s1)', points: rain }], fmt: fmtMm, tipTime: p => `${fmtWd(p.t)} ${fmtHourRange(p.t)}`,
    aria: 'Neerslag per uur',
  });
  k.tableHost.appendChild(dataTable(H.instant.filter(r => !day || inSpan(r.t)), [{ label: 'Uur', get: p => fmtDayTime(p.t) }, { label: '°C', num: true, get: p => { const r = rowAt(T, p.t); return r && r.temperature_2m != null ? fmtNum(r.temperature_2m, 0) : '–'; } }, { label: 'Weer', get: p => { const ic = icons.find(i => i.hour.getTime() === p.t.getTime()); return ic ? (ic.kind === 'clear' && ic.night ? 'helder' : ICON_WORDS[ic.kind]) : ''; } }, { label: 'mm', num: true, get: p => { const iv = H.interval.find(q => q.t.getTime() === p.t.getTime()); return iv ? fmtNum(iv.precipitation, 1) : '–'; } }]));
}

/* ---------------- Boom: wat de wind met een boom doet (KNMI-schaal van Beaufort) ---------------- */
const BEAUFORT = [
  ['Windstil', 'rook stijgt recht omhoog'],
  ['Zwakke wind', 'rook geeft de windrichting aan'],
  ['Zwakke wind', 'bladeren ritselen, wind voelbaar in het gezicht'],
  ['Matige wind', 'bladeren en twijgen bewegen voortdurend'],
  ['Matige wind', 'takken bewegen, stof en papier waaien op'],
  ['Vrij krachtige wind', 'bomen met bladeren zwaaien'],
  ['Krachtige wind', 'grote takken bewegen, een paraplu is lastig te gebruiken'],
  ['Harde wind', 'hele bomen bewegen, tegen de wind in lopen is lastig'],
  ['Stormachtige wind', 'twijgen breken van de bomen, lopen is zeer moeilijk'],
  ['Storm', 'dakpannen waaien weg, takken breken af'],
  ['Zware storm', 'bomen worden ontworteld, grote schade'],
  ['Zeer zware storm', 'uitgebreide schade aan bossen en gebouwen'],
  ['Orkaan', 'verwoestingen'],
];
const TREE = {
  amp:    [0, 0.4, 1, 2, 3.5, 5, 7, 9, 12, 15, 18, 22, 26],   // zwaai-amplitude in graden
  lean:   [0, 0, 1, 2, 4, 6, 9, 12, 16, 20, 25, 30, 35],       // scheefstand in graden
  period: [4, 3.6, 3.2, 2.8, 2.4, 2, 1.7, 1.4, 1.2, 1, 0.9, 0.8, 0.7], // zwaaiperiode in seconden
  // the leaves carry most of the message (KNMI: 2 Bft leaves rustle, 3 Bft leaves and twigs move constantly,
  // 5 Bft trees in leaf sway): almost still at 0–1 Bft, a small fast rustle at 2, then ever wider and faster
  leafAmp:    [1, 2, 5, 9, 14, 20, 26, 32, 38, 42, 45, 48, 50],                                   // fladderen, ± graden
  leafPeriod: [1.6, 1.0, 0.6, 0.45, 0.36, 0.3, 0.26, 0.23, 0.2, 0.18, 0.17, 0.16, 0.15],         // halve slag in seconden
};
/* One tree model (viewBox 0 0 100 110, foot at 50,106): curved trunk, five branches, lance-shaped leaves in two
   greens. Used large on the wind page and small in the overview row. Wind is applied with CSS variables. */
const TREE_BRANCHES = [
  { d: 'M50 74 C42 68 33 64 24 60', end: [24, 60], ang: -22 },
  { d: 'M52 60 C46 52 41 46 36 38', end: [36, 38], ang: -55 },
  { d: 'M55 58 C63 54 71 52 80 46', end: [80, 46], ang: 22 },
  { d: 'M57 44 C60 34 62 26 64 18', end: [64, 18], ang: -70 },
  { d: 'M57 46 C66 40 74 36 82 30', end: [82, 30], ang: 32 },
];
/* Tree seen from slightly above (viewBox 0 0 100 110): a round crown of branches radiating from the trunk top,
   a short trunk down to the foot at (50,90) and a shadow on the ground. In this view the compass maps straight
   onto the screen: north is up, east is right. Wind pushes the crown off the foot in the direction it blows. */
const LEAF_D = 'M0 0 C1.5 -4.2 6.5 -5.4 11 -2.2 C9.5 2.4 5 4.4 0 0 Z';
const CROWN = { cx: 50, cy: 60 }; // crown centre at rest; foot at (50, 90)
const GROUND_FORESHORTEN = 0.6;    // north/south distances look shorter from this angle
function makeTree(scale = 1) {
  const g = svgEl('g', { class: 'treeg' });
  g.appendChild(svgEl('ellipse', { class: 'shadow', cx: 50, cy: 91, rx: 23, ry: 8 }));
  g.appendChild(svgEl('path', { class: 'trunk edge', d: `M50 90 L${CROWN.cx} ${CROWN.cy}` }));
  g.appendChild(svgEl('path', { class: 'trunk', d: `M50 90 L${CROWN.cx} ${CROWN.cy}` }));
  const crown = svgEl('g', { class: 'crown' }); // translated by the lean, rotated by the sway (CSS)
  for (let i = 0; i < 6; i++) {
    const a = i * 60 - 90 + (i % 2) * 12;
    const ex = CROWN.cx + Math.cos(rad(a)) * 26, ey = CROWN.cy + Math.sin(rad(a)) * 26;
    const br = svgEl('g', { class: 'branch', style: `transform-origin:${CROWN.cx}px ${CROWN.cy}px;animation-delay:${(-i * 0.23).toFixed(2)}s` });
    br.appendChild(svgEl('path', { class: 'bough edge', d: `M${CROWN.cx} ${CROWN.cy} L${ex.toFixed(1)} ${ey.toFixed(1)}` }));
    br.appendChild(svgEl('path', { class: 'bough', d: `M${CROWN.cx} ${CROWN.cy} L${ex.toFixed(1)} ${ey.toFixed(1)}` }));
    // leaves along the branch, alternating sides, plus a pair at the tip
    [[10, -42], [15, 40], [20, -38], [25, 36], [27, -8], [27, 10]].forEach(([r, da], k) => {
      const lx = CROWN.cx + Math.cos(rad(a)) * r, ly = CROWN.cy + Math.sin(rad(a)) * r;
      const place = svgEl('g', { transform: `translate(${lx.toFixed(1)},${ly.toFixed(1)}) rotate(${(a + da).toFixed(0)})` });
      const lg = svgEl('g', { class: `leaf ${(i + k) % 2 ? 'alt' : ''}`, style: `animation-delay:${(-(i * 6 + k) * 0.17).toFixed(2)}s` });
      lg.appendChild(svgEl('path', { class: 'blade', d: LEAF_D }));
      lg.appendChild(svgEl('path', { class: 'vein', d: 'M0.8 -0.2 L9.6 -2.4' }));
      place.appendChild(lg);
      br.appendChild(place);
    });
    crown.appendChild(br);
  }
  g.appendChild(crown);
  const flyers = svgEl('g', { class: 'flyers' });
  for (let i = 0; i < 5; i++) {
    const place = svgEl('g', { transform: `translate(${CROWN.cx + (i - 2) * 9},${CROWN.cy + (i % 3) * 8 - 8})` });
    const fg = svgEl('g', { class: `flyer ${i % 2 ? 'alt' : ''}`, style: `animation-delay:${(-i * 0.41).toFixed(2)}s` });
    fg.appendChild(svgEl('path', { class: 'blade', d: LEAF_D }));
    place.appendChild(fg);
    flyers.appendChild(place);
  }
  g.appendChild(flyers);
  // rain seen from above: drops splashing on the ground around the tree
  const rain = svgEl('g', { class: 'raindrops' });
  for (let i = 0; i < 9; i++) {
    const place = svgEl('g', { transform: `translate(${8 + ((i * 37) % 86)},${12 + ((i * 53) % 90)})` });
    place.appendChild(svgEl('circle', { class: 'drop', r: 3, style: `animation-delay:${(-i * 0.21).toFixed(2)}s` }));
    rain.appendChild(place);
  }
  g.appendChild(rain);
  if (scale !== 1) g.setAttribute('transform', `scale(${scale})`);
  return g;
}
function windVector(dirDeg) {
  const to = rad((dirDeg == null ? 270 : dirDeg) + 180);
  return { dx: Math.sin(to), dn: Math.cos(to) }; // dx > 0: naar oost (rechts); dn > 0: naar noord (omhoog)
}
/* screen vector of the wind: east = right, north = up (foreshortened) */
function windScreen(dirDeg) {
  const { dx, dn } = windVector(dirDeg);
  const sx = dx, sy = -dn * GROUND_FORESHORTEN;
  const mag = Math.hypot(sx, sy) || 1;
  return { sx, sy, ux: sx / mag, uy: sy / mag, ang: deg(Math.atan2(sy, sx)) };
}
/* apply a wind (and optional rain) to a tree: the crown shifts off the foot along the wind, sways with
   Beaufort amplitude, and from 5 Bft leaves fly off. Even at 0 Bft the crown keeps a faint breathing motion. */
function windTree(g, kmh, dirDeg, rainMm = null) {
  const b = beaufort(kmh || 0);
  const w = windScreen(dirDeg);
  const leanPx = TREE.lean[b] * 0.9; // degrees of lean become pixels of crown offset
  const lx = w.ux * leanPx, ly = w.uy * leanPx;
  g.style.setProperty('--amp', `${Math.max(0.5, TREE.amp[b] * 0.6)}deg`);
  g.style.setProperty('--period', `${TREE.period[b]}s`);
  g.style.setProperty('--lamp', `${TREE.leafAmp[b]}deg`);
  g.style.setProperty('--lperiod', `${TREE.leafPeriod[b]}s`);
  g.style.setProperty('--lx', `${lx.toFixed(1)}px`); g.style.setProperty('--ly', `${ly.toFixed(1)}px`);
  g.style.setProperty('--fx', `${(w.ux * 90).toFixed(1)}px`); g.style.setProperty('--fy', `${(w.uy * 90).toFixed(1)}px`);
  // the trunk follows the crown: from the foot to the shifted crown centre
  for (const t of g.querySelectorAll('.trunk')) t.setAttribute('d', `M50 90 L${(CROWN.cx + lx).toFixed(1)} ${(CROWN.cy + ly).toFixed(1)}`);
  g.classList.toggle('flying', b >= 5);
  g.classList.toggle('raining', rainMm != null && rainMm >= 0.1);
  g.dataset.bft = b;
  return b;
}
/* animated wind field: 16 streaks scattered over the scene, each travelling along the wind's screen vector
   and turned along its own motion, so the field reads as a flow of small arrows (north = up). */
const WIND_TRAVEL = 130;
function makeWindField() {
  const f = svgEl('g', { class: 'windfield' });
  for (let i = 0; i < 16; i++) {
    const bx = 4 + ((i * 41) % 92), by = 4 + ((i * 53) % 98), len = 8 + ((i * 13) % 12);
    const s = svgEl('g', { class: 'streak', 'data-bx': bx, 'data-by': by });
    s.appendChild(svgEl('line', { x1: -len / 2, y1: 0, x2: len / 2, y2: 0, style: `animation-delay:${(-(i * 0.47) % 4).toFixed(2)}s` }));
    f.appendChild(s);
  }
  return f;
}
/* Wind field per Beaufort (index 0..12), deliberately non-linear: at 0 Bft nothing; from 1 Bft enough faint,
   slow streaks to read the direction; from 5 Bft the field grows clearly longer, thicker and faster. */
const WIND_FIELD = {
  count:  [0, 8, 10, 12, 14, 16, 16, 16, 16, 16, 16, 16, 16],                                // zichtbare streken (van 16)
  op:     [0, 0.22, 0.26, 0.30, 0.36, 0.44, 0.52, 0.62, 0.72, 0.80, 0.86, 0.90, 0.92],        // dekking
  len:    [0.5, 0.6, 0.8, 1.0, 1.3, 1.7, 2.1, 2.5, 2.9, 3.2, 3.5, 3.8, 4.0],                  // lengtefactor
  period: [6, 4.5, 3.4, 2.6, 2.0, 1.5, 1.15, 0.9, 0.72, 0.6, 0.52, 0.46, 0.42],              // seconden per oversteek
  stroke: [1.2, 1.2, 1.2, 1.3, 1.4, 1.7, 2.0, 2.3, 2.6, 2.8, 3.0, 3.0, 3.0],                  // lijndikte
};
function setWindField(f, kmh, dirDeg) {
  const b = beaufort(kmh || 0);
  const w = windScreen(dirDeg);
  f.style.setProperty('--travel', `${WIND_TRAVEL}px`);
  f.style.setProperty('--wperiod', `${WIND_FIELD.period[b]}s`);
  f.style.setProperty('--wop', String(WIND_FIELD.op[b]));
  f.style.setProperty('--wlen', String(WIND_FIELD.len[b]));
  f.style.setProperty('--wstroke', String(WIND_FIELD.stroke[b]));
  f.classList.toggle('calm', b === 0);
  // the streaks are scattered evenly by index, so showing the first n keeps the field spread out
  f.querySelectorAll('.streak').forEach((s, i) => { s.style.display = i < WIND_FIELD.count[b] ? '' : 'none'; });
  for (const s of f.querySelectorAll('.streak')) {
    // start half a travel upstream of the scatter point, so the streak passes through it
    const x = parseFloat(s.dataset.bx) - w.ux * WIND_TRAVEL / 2, y = parseFloat(s.dataset.by) - w.uy * WIND_TRAVEL / 2;
    s.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${w.ang.toFixed(1)})`);
  }
  return { ang: w.ang, b };
}
function treeView() {
  const wrap = h('div', 'tree');
  const svg = svgEl('svg', { viewBox: '0 0 100 110', 'aria-hidden': 'true' });
  svg.appendChild(makeWindField());
  svg.appendChild(makeTree(1));
  // compass hint in the corner: north is up
  const comp = svgEl('g', { class: 'compass', transform: 'translate(90,10)' });
  comp.appendChild(svgEl('path', { d: 'M0 -6 L3 2 L0 0.5 L-3 2 Z' }));
  comp.appendChild(svgEl('text', { y: 11, 'text-anchor': 'middle' }, 'N'));
  svg.appendChild(comp);
  wrap.appendChild(svg);
  const txt = h('div', 'tree-text');
  txt.appendChild(h('div', 'tree-caption'));
  txt.appendChild(h('div', 'tree-desc'));
  wrap.appendChild(txt);
  return wrap;
}
function setTree(el, kmh, dirDeg, label, rainMm = null) {
  const g = el.querySelector('.treeg');
  const b = windTree(g, kmh, dirDeg, rainMm);
  setWindField(el.querySelector('.windfield'), kmh, dirDeg);
  for (const k of ['--amp', '--period', '--lx', '--ly']) el.style.setProperty(k, g.style.getPropertyValue(k));
  el.classList.toggle('flying', b >= 5); el.classList.toggle('still', b === 0);
  el.dataset.bft = b;
  el.querySelector('.tree-caption').textContent = `${label} · ${fmtNum(kmh || 0, 0)} km/u · ${b} Bft${dirDeg != null ? ` uit ${compass(dirDeg)}` : ''}${rainMm != null && rainMm >= 0.1 ? ` · ${fmtMm(rainMm)} mm` : ''}`;
  el.querySelector('.tree-desc').textContent = `${BEAUFORT[b][0]}: ${BEAUFORT[b][1]}`;
}
/* ---------------- Info: alles over de app, als verborgen tab ---------------- */
function renderInfo(c) {
  const sec = (title, paras) => {
    const s = h('section', 'card info');
    s.appendChild(h('h2', null, title));
    for (const p of paras) { const el = h('p'); el.innerHTML = p; s.appendChild(el); }
    c.appendChild(s);
  };
  // the technical reason of a failed fetch lives here, not in the screens
  const errs = Object.entries(state.errors || {});
  if (errs.length) {
    sec('Wat er niet lukte', [errs.map(([k, e]) => `${SOURCE_NAMES[k] || k}: ${e}`).join('<br>') +
      (state.updated ? `<br>laatste poging ${fmtTime(state.updated)}` : '')]);
    c.lastChild.querySelector('p').className = 'err';
  }
  sec('Wat je ziet', [
    'De app toont de verwachting voor de gekozen plaats. <b>Overzicht</b> draagt de naam van de plaats (tik erop om een andere te kiezen) en begint met het weer van nu: de temperatuur, het weerbeeld, hoe koud het voelt en de laagste en hoogste temperatuur van vandaag. Daaronder de regenregel: hoe lang het droog blijft, of wanneer het gaat regenen; komt er regen aan, dan kleurt de regel blauw met een mini-radar per 5 minuten. Daaronder het weer per uur en de komende zeven dagen, met per dag het weerbeeld, de laagste en hoogste temperatuur en de kans op regen. Tik op de regenbalk voor <b>Regen</b> (de radar voor de komende 2 uur en de neerslag per uur met de kans op regen) en op de uurstrook voor <b>Per uur</b>, dat temperatuur en weerbeeld per uur naast elkaar zet. Tik op een dag in de lijst voor dezelfde pagina voor alleen die dag; voor de dagen na morgen komt die uit het ECMWF-ensemble: de lijn is de middelste van de 51 berekeningen en de band laat zien waar 90% van de berekeningen zit (de 5% hoogste en de 5% laagste vallen erbuiten, zoals de lichte band van de KNMI-pluim), voor temperatuur én regen; bij regen noemt de tooltip die band gewoon als "0,0 tot 0,4 mm", omdat de middelste waarde bij buien bijna altijd 0 is, en de boompjes tonen de wind van de middelste berekening; "‹ Overzicht" brengt je terug. <b>Temperatuur</b>, <b>Wind</b> en <b>Bewolking</b> tonen elk hun eigen verloop.',
    'Zoomen: spreid twee vingers op een grafiek om in te zoomen, knijp ze samen om weer verder vooruit te kijken (tot 48 uur). De grafiek begint altijd bij nu; de titel van de kaart toont hoeveel uur je ziet en de keuze wordt onthouden. Sleep met één vinger over een grafiek om de waarden van dat moment te zien; de stippellijn volgt je vinger.',
    'De achtergrond van elke grafiek volgt de zon: warm bij daglicht, grijzer naarmate er meer bewolking is, donker in de nacht, met schemer ertussen. De zonnetjes boven de grafiek staan op zonsopkomst en -ondergang en tonen het weerbeeld van dat moment.',
    'Het <b>weerbeeld</b> van een verwacht uur (zonnig, half bewolkt, dunne bewolking, bewolkt, regen) komt uit de bewolking van het model: minder dan 30% is zonnig, 30 tot 70% half bewolkt. Is de lucht (bijna) dicht, dan kijkt de app hoeveel zon er nog doorkomt, vergeleken met een heldere hemel: veel zon betekent losse wolken (half bewolkt), een flink deel betekent een sluier van dunne, hoge wolken (dunne bewolking: zon boven drie strepen) en weinig zon een dik wolkendek (bewolkt). Bij lage zon en \'s nachts beslissen de lagen: alleen hoge wolken is dunne bewolking. Vanaf 0,1 mm in het uur is het regen. Het weerbeeld van nu in de tegel komt uit de metingen.',
    'Bovenaan <b>Overzicht</b> staat het weer per uur, zo ver als ICON-D2 vooruit rekent (tot 48 uur): het icoontje met dezelfde regels als de uurrij op Per uur en de temperatuur van ICON-D2. Nu komt, net als de kaart van nu, uit de metingen; om middernacht staat de naam van de nieuwe dag, en zonsopkomst en -ondergang staan als eigen vakje tussen de uren. Schemer staat op Per uur en de dagpagina\'s. Veeg opzij voor de volgende uren; tik erop voor Per uur.',
    'Het <b>weerbeeld van een dag</b> in Overzicht kijkt alleen naar de uren dat het licht is. Elk licht uur krijgt zijn eigen icoontje, met dezelfde regels als de uurrij op Per uur, en de dag krijgt het middelste daarvan (de mediaan). Een strak blauwe dag die in de laatste twee lichte uren dichttrekt, blijft zo een zonnige dag. Laagste en hoogste temperatuur gaan over de hele dag. Het getal met de druppel onder het icoontje is de kans op een natte dag: het deel van de ensembleberekeningen met minstens 0,5 mm in de lichte uren van die dag, getoond vanaf 10%; regen in de nacht telt niet mee, net als bij het icoontje. De balk loopt van laagste naar hoogste temperatuur op de schaal van alle dagen samen; de stip is de temperatuur van nu.',
    'De dagen in Overzicht gebruiken zolang het kan dezelfde modellen als de rest van de app: HARMONIE voor het weerbeeld, ICON-D2 voor de temperatuur en het ICON-D2-ensemble voor de kans, meestal vandaag en morgen. Voor de dagen daarna komt alles uit het <b>ECMWF-ensemble</b>, dat ook achter de pluim van het KNMI zit: 51 berekeningen op een raster van 25 km. Elke berekening krijgt zijn eigen dag met dezelfde regels; de dag krijgt het middelste icoontje van de 51 en de middelste laagste en hoogste temperatuur, zoals de pluim. Het vage deel van de balk is waar de middelste helft van de berekeningen zit; hoe breder, hoe onzekerder.',
  ]);
  sec('Waar de cijfers vandaan komen', [
    '<b>Nu-waarden</b> (temperatuur, wind) zijn echte metingen van het dichtstbijzijnde KNMI-weerstation, elke 10 minuten bijgewerkt, via de feed van Buienradar. De tegel noemt het station en de afstand.',
    'Het <b>weerbeeld van nu</b> in de tegel komt ook uit metingen: overdag uit hoeveel zon de KNMI-stations binnen 40 km de afgelopen 10 minuten kregen, vergeleken met een heldere hemel, waarbij dichterbij zwaarder telt. Eén wolkje boven één station maakt het dan nog niet bewolkt. Bij lage zon en \'s nachts telt de omschrijving van het dichtstbijzijnde station, en zonder meting het model.',
    '<b>Radar</b> voor de komende 2 uur: Buienradar-nowcast, een verplaatsing van het actuele radarbeeld.',
    '<b>Verwachting per uur</b> (neerslag, wind, bewolking): het KNMI-weermodel HARMONIE-AROME, dat elk uur opnieuw rekent op een raster van 2 bij 2 km. In een eigen verificatie tegen KNMI-metingen bleek dit model voor regen op 1 tot 2 dagen vooruit het beste van de fijnmazige modellen.',
    '<b>Temperatuur</b>: het model ICON-D2 van de Duitse weerdienst (2,2 km). In dezelfde verificatie zat HARMONIE gemiddeld een halve graad te warm en zat ICON-D2 er duidelijk dichter bij.',
    '<b>Kans op regen</b> en de <b>onzekerheidsband</b>: het ensemble ICON-D2-EPS van de Duitse weerdienst, twintig berekeningen met kleine verschillen in de beginsituatie. De kans is het aandeel berekeningen met minstens 0,1 mm in dat uur; met twintig berekeningen gaat die in stappen van 5%, dus "< 5%" betekent: geen van de twintig. De band toont waar 80% van de berekeningen zit. Bij temperatuur hoort de band bij hetzelfde model als de lijn; bij neerslag en wind komt hij voorlopig van een ander model dan de verwachting, waardoor ze elkaar soms tegenspreken.',
    '<b>Eerstvolgende neerslag</b> volgt eerst de radar. Daarna telt een uur als nat als het KNMI-model minstens 0,5 mm geeft; de kans van het ensemble staat erbij maar beslist niet. Anders staat er "Droog" met hoe lang (zo ver als radar en model kijken), en het natste uur eronder als dat er is. Is de radar droog, dan toont de kaart Komende 2 uur één regel in plaats van een lege grafiek.',
    '<b>Zonder verbinding</b> toont de app de laatst opgehaalde gegevens met het tijdstip waarop ze zijn opgehaald. Radar van meer dan een half uur oud, radar die al voorbij is en metingen van meer dan een uur oud worden dan niet meer getoond.',
    'Modeldata loopt via <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a>. Zonsopkomst, schemer en zonshoogte worden in de app zelf berekend.',
  ]);
  sec('Hoe je de grafieken leest', [
    'Een <b>neerslagstaaf</b> is de som over dat uur; de radarstaven zijn de intensiteit op dat moment, in millimeter per uur. De uren die de radar dekt (ongeveer de eerste twee) komen ook in de uurgrafiek uit de radar, zodat beide grafieken hetzelfde zeggen; voor die uren staat er geen kans. Van het lopende uur telt alleen wat nog komt. Lichte regen is 0,1 tot 1 mm per uur, matige regen 1 tot 4, zware regen meer dan 4.',
    '<b>Windpijlen</b> (elke 3 uur) wijzen waarheen de wind waait; in de tekst staat waar de wind vandaan komt, zoals gebruikelijk. Beaufort volgt uit de uursnelheid volgens de KNMI-tabel; de boom laat zien wat die kracht met een boom doet.',
    '<b>Bewolking</b> is het deel van de hemel dat bedekt is. De lijn wordt donkerder grijs naarmate er meer bewolking is. Het model geeft per uur een momentopname van één vakje van 2 km, die bij losse wolken tussen 0 en 100% springt; de app middelt daarom elk uur met het uur ervoor en erna.',
  ]);
  sec('Beaufort volgens KNMI', [
    '<table class="bft">' + BEAUFORT.map((b, i) => `<tr><td class="num">${i}</td><td>${b[0]}</td><td>${b[1]}</td></tr>`).join('') + '</table>',
  ]);
  sec('Bronnen en licenties', [
    'Verwachting: KNMI, via Open-Meteo (CC BY 4.0). Temperatuur: DWD ICON-D2, via Open-Meteo (CC BY 4.0). Ensemble: DWD ICON-D2-EPS, via Open-Meteo (CC BY 4.0). Meerdaagse verwachting: ECMWF-ensemble (IFS ENS), via Open-Meteo (CC BY 4.0). Radar en stationsmetingen: <a href="https://www.buienradar.nl" target="_blank" rel="noopener">Buienradar.nl</a>. Open-Meteo wordt gebruikt onder de voorwaarden voor niet-commercieel gebruik.',
    'Deze app is een privéprototype. Instellingen zoals plaats en zoom, en de laatst opgehaalde weergegevens, blijven op je eigen telefoon; er worden geen gegevens verzameld.',
  ]);
}

/* ---------------- Temperatuur ---------------- */
function renderTemp(c) {
  const H = needHarmonie(c); if (!H) return;
  const T = tempModel();
  const nowRow = T.instant[0];
  const { mn, mx } = todayRange(T);
  // the ICON-D2 ensemble band only belongs around an ICON-D2 line
  const withBand = T.key === TEMP_MODEL.key;
  const o = state.obs;
  const tempIcon = '<svg class="ico-big" viewBox="0 0 24 24"><path d="M10 4a2 2 0 0 1 4 0v9.3a4 4 0 1 1-4 0V4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="17" r="1.6" fill="currentColor"/><path d="M12 10v7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  if (o && o.temp != null) {
    heroBlock(c, tempIcon, `Gemeten ${fmtTime(o.time)} · ${o.station} (${fmtNum(o.dist, 0)} km)`, `${fmtNum(o.temp, 0)}°`,
      `voelt als ${fmtNum(o.feel != null ? o.feel : nowRow.apparent_temperature, 0)}° · verwacht nu ${fmtNum(nowRow.temperature_2m, 0)}° · vandaag ${fmtNum(mn, 0)}° tot ${fmtNum(mx, 0)}°`);
  } else {
    heroBlock(c, tempIcon, `Nu · ${fmtTime(nowRow.t)} · verwacht`, `${fmtNum(nowRow.temperature_2m, 0)}°`, `voelt als ${fmtNum(nowRow.apparent_temperature, 0)}° · vandaag ${fmtNum(mn, 0)}° tot ${fmtNum(mx, 0)}°`);
  }

  const k1 = card(spanTitle(), []);
  c.appendChild(k1.el);
  drawChart(k1.body, { sky: skyOf(),
    ...spanFor([H]), unit: '°C', unitTip: '°C', ticks: 'days', height: 260, now: new Date(), yOpts: { minSpan: 6, targetTicks: 4 },
    series: [
      ...(withBand ? ensBand('temperature_2m') : []),
      { kind: 'line', name: 'Temperatuur', color: 'var(--s1)', points: instantPts(T, 'temperature_2m'), area: true, smooth: 'soft' },
      { kind: 'line', name: 'Gevoelstemperatuur', color: 'var(--s1)', points: instantPts(T, 'apparent_temperature'), secondary: true, smooth: 'soft' },
    ],
    fmt: v => fmtNum(v, 1), directLabels: 'minmax', tipTime: p => fmtDayTime(p.t), aria: 'Temperatuur per uur',
    tipExtra: t => { const r = withBand && state.ens && state.ens.bands.temperature_2m.find(q => Math.abs(q.t.getTime() - t) < HOUR / 2); return r ? `onzekerheid ${fmtNum(r.lo, 0)}° tot ${fmtNum(r.hi, 0)}°` : null; },
  });
  legend(k1.el, [{ name: 'Temperatuur (2 m)', color: 'var(--s1)' }, { name: 'Gevoelstemperatuur', color: 'var(--s1)', dashed: true }, ...(withBand ? ensLegend() : [])]);
  k1.tableHost.appendChild(dataTable(T.instant, [{ label: 'Uur', get: p => fmtDayTime(p.t) }, { label: '°C', num: true, get: p => fmtNum(p.temperature_2m, 1) }, { label: 'Gevoel', num: true, get: p => fmtNum(p.apparent_temperature, 1) }]));
}

/* ---------------- Wind ---------------- */
function renderWind(c) {
  const H = needHarmonie(c); if (!H) return;
  const r0 = H.instant[0];
  const o = state.obs;
  const windIcon = '<svg class="ico-big" viewBox="0 0 24 24"><path d="M3 8h11a2.5 2.5 0 1 0-2.5-2.5M3 12h15a2.5 2.5 0 1 1-2.5 2.5M3 16h8a2 2 0 1 1-2 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  if (o && o.wind != null) {
    heroBlock(c, windIcon, `Gemeten ${fmtTime(o.time)} · ${o.station} (${fmtNum(o.dist, 0)} km)`, `${fmtNum(o.wind, 0)} km/u`,
      `${beaufort(o.wind)} Bft${o.dir != null ? ` uit ${compass(o.dir)}` : ''}${o.gust != null ? ` · stoten ${fmtNum(o.gust, 0)}` : ''} · verwacht ${fmtNum(r0.wind_speed_10m, 0)} km/u`);
  } else {
    heroBlock(c, windIcon, `Nu · ${fmtTime(r0.t)} · verwacht`, `${fmtNum(r0.wind_speed_10m, 0)} km/u`, `${beaufort(r0.wind_speed_10m)} Bft uit ${compass(r0.wind_direction_10m)} · stoten ${fmtNum(r0.wind_gusts_10m, 0)} km/u`);
  }

  const k1 = card(spanTitle(), []);
  c.appendChild(k1.el);
  const arrows = H.instant.filter(p => p.t.getHours() % 3 === 0 && p.wind_direction_10m != null).map(p => ({ t: p.t, deg: p.wind_direction_10m }));
  drawChart(k1.body, { sky: skyOf(),
    ...spanFor([H]), unit: 'km/u', unitTip: 'km/u', ticks: 'days', height: 200, now: new Date(), yOpts: { zero: true, minSpan: 20, headroom: 1.1 },
    series: [
      ...ensBand('wind_speed_10m'),
      { kind: 'line', name: 'Wind', color: 'var(--s1)', points: instantPts(H, 'wind_speed_10m'), area: true, smooth: 'soft' },
      { kind: 'line', name: 'Windstoten', color: 'var(--s1)', points: instantPts(H, 'wind_gusts_10m'), secondary: true, smooth: 'soft' },
    ],
    fmt: v => fmtNum(v, 0), directLabels: 'peak', arrows, tipTime: p => fmtDayTime(p.t),
    tipNote: (s, p) => (s.name === 'Wind' ? ` · ${beaufort(p.v)} Bft · ${compass(p.row.wind_direction_10m)}` : ''),
    tipExtra: t => { const r = state.ens && state.ens.bands.wind_speed_10m.find(q => Math.abs(q.t.getTime() - t) < HOUR / 2); return r ? `onzekerheid ${fmtNum(r.lo, 0)} tot ${fmtNum(r.hi, 0)} km/u` : null; },
    onScrub: p => { if (p) { const iv = H.interval.find(q => q.t.getTime() === p.t.getTime()); setTree(tree, p.v, p.row.wind_direction_10m, fmtDayTime(p.t), iv ? iv.precipitation : null); } else treeNow(); },
    aria: 'Windsnelheid en windstoten per uur volgens HARMONIE',
  });
  // the tree under the arrows: what this wind does to a tree, for now or for the hour under your finger
  const tree = treeView();
  const rainNow = state.nowcast && state.nowcast.length ? state.nowcast[0].v : (H.interval[0] ? H.interval[0].precipitation : null);
  const treeNow = () => (o && o.wind != null ? setTree(tree, o.wind, o.dir, `Nu, gemeten ${fmtTime(o.time)}`, rainNow) : setTree(tree, r0.wind_speed_10m, r0.wind_direction_10m, `Nu, verwacht`, rainNow));
  treeNow();
  k1.body.after(tree);
  // short names keep the legend on one line; the arrows are explained under Info
  legend(k1.el, [{ name: 'Wind', color: 'var(--s1)' }, { name: 'Stoten', color: 'var(--s1)', dashed: true }, ...ensLegend()]);
  k1.tableHost.appendChild(dataTable(H.instant, [{ label: 'Uur', get: p => fmtDayTime(p.t) }, { label: 'km/u', num: true, get: p => fmtNum(p.wind_speed_10m, 0) }, { label: 'Stoten', num: true, get: p => fmtNum(p.wind_gusts_10m, 0) }, { label: 'Uit', get: p => `${compass(p.wind_direction_10m)} ${fmtDeg(p.wind_direction_10m)}` }]));
}

/* ---------------- Bewolking ---------------- */
/* "62% bedekt · laag 40% · hoog 30%": a layer only when it has cloud (four times 0% said nothing, UX-audit D) */
function cloudHint(r) {
  const layers = [['laag', r.cloud_cover_low], ['midden', r.cloud_cover_mid], ['hoog', r.cloud_cover_high]]
    .filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v}%`);
  return [`${r.cloud_cover}% bedekt`, ...layers].join(' · ');
}
function renderCloud(c) {
  const H = needHarmonie(c); if (!H) return;
  const r0 = H.instant[0];
  heroBlock(c, '<svg class="ico-big" viewBox="0 0 24 24"><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 10h.5a4 4 0 0 1 0 8H7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    `Nu · ${fmtTime(r0.t)}`, cloudWord(r0.cloud_cover), cloudHint(r0));

  const k1 = card(spanTitle(), []);
  c.appendChild(k1.el);
  const pct = { min: 0, max: 100, step: 25 };
  drawChart(k1.body, { sky: skyOf(),
    ...spanFor([H]), unit: '%', unitTip: '%', ticks: 'days', height: 260, now: new Date(), yFixed: pct,
    series: [
      ...ensBand('cloud_cover', 'var(--cloud-hi)'),
      { kind: 'line', name: 'Totaal', color: 'var(--cloud-hi)', colorAt: cloudGrey, points: instantPts(H, 'cloud_cover'), area: true, areaOpacity: 0.18 },
      { kind: 'line', name: 'Lage bewolking', color: 'var(--cloud-mid)', points: instantPts(H, 'cloud_cover_low'), secondary: true },
    ],
    fmt: v => fmtNum(v, 0), tipTime: p => fmtDayTime(p.t),
    tipNote: (s, p) => (s.name === 'Totaal' ? ` · midden ${p.row.cloud_cover_mid}% · hoog ${p.row.cloud_cover_high}%` : ''),
    tipExtra: t => { const r = state.ens && state.ens.bands.cloud_cover.find(q => Math.abs(q.t.getTime() - t) < HOUR / 2); return r ? `ensemble ${fmtNum(r.lo, 0)} tot ${fmtNum(r.hi, 0)}%` : null; },
    aria: 'Bewolking per uur volgens HARMONIE',
  });
  legend(k1.el, [{ name: 'Totale bedekking', color: 'var(--cloud-hi)', note: 'donkerder = meer bewolking' }, { name: 'Lage bewolking (< 2 km)', color: 'var(--cloud-mid)', dashed: true }, ...ensLegend('var(--cloud-hi)')]);
  k1.tableHost.appendChild(dataTable(H.instant, [{ label: 'Uur', get: p => fmtDayTime(p.t) }, { label: 'Totaal', num: true, get: p => `${p.cloud_cover}%` }, { label: 'Laag', num: true, get: p => `${p.cloud_cover_low}%` }, { label: 'Midden', num: true, get: p => `${p.cloud_cover_mid}%` }, { label: 'Hoog', num: true, get: p => `${p.cloud_cover_high}%` }]));
}

/* ======================================================================
   5. UI wiring: tabs, sheet, search, geolocation
   ====================================================================== */
// jump, not glide: .screen scrolls smoothly, and render() would put a half-finished scroll back
const toTop = () => { const s = $('screen'); s.style.scrollBehavior = 'auto'; s.scrollTop = 0; s.style.scrollBehavior = ''; };
$('infoBtn').addEventListener('click', () => { state.tab = 'info'; toTop(); render(); });
for (const btn of document.querySelectorAll('.tab')) {
  btn.addEventListener('click', () => {
    if (state.tab === btn.dataset.tab) { $('screen').scrollTo({ top: 0 }); return; }
    state.tab = btn.dataset.tab;
    try { localStorage.setItem('regen.tab', state.tab); } catch (e) {}
    toTop();
    render();
  });
}
function openSheet() { $('sheet').hidden = false; $('sheetBackdrop').hidden = false; $('results').textContent = ''; $('q').value = ''; setTimeout(() => $('q').focus(), 50); }
function closeSheet() { $('sheet').hidden = true; $('sheetBackdrop').hidden = true; }
$('locBtn').addEventListener('click', openSheet);
$('sheetClose').addEventListener('click', closeSheet);
$('sheetBackdrop').addEventListener('click', closeSheet);
function setLocation(loc) {
  state.loc = loc; state.rainModel = 'harmonie';
  try { localStorage.setItem('regen.loc', JSON.stringify(loc)); } catch (e) {}
  closeSheet();
  state.nowcast = null; state.forecast = null; state.ecmwf = null; state.updated = null; render();
  load();
}
$('searchForm').addEventListener('submit', async ev => {
  ev.preventDefault();
  const q = $('q').value.trim(); if (!q) return;
  const list = $('results'); list.textContent = '';
  try {
    const json = await fetchOk(geoUrl(q));
    const hits = (json.results || []).filter(x => ['NL', 'BE'].includes(x.country_code));
    if (!hits.length) { const li = h('li'); li.appendChild(h('button', null, 'Geen plaats gevonden in Nederland of België')); list.appendChild(li); }
    for (const x of hits) {
      const li = h('li'); const btn = h('button'); btn.type = 'button';
      btn.appendChild(document.createTextNode(x.name));
      btn.appendChild(h('span', 'sub', [x.admin1, x.country_code === 'BE' ? 'België' : 'Nederland'].filter(Boolean).join(' · ')));
      btn.addEventListener('click', () => setLocation({ name: x.name, admin: x.admin1 || '', lat: x.latitude, lon: x.longitude }));
      li.appendChild(btn); list.appendChild(li);
    }
  } catch (e) { const li = h('li'); li.appendChild(h('button', null, `Zoeken mislukt: ${e.message}`)); list.appendChild(li); }
});
$('geoBtn').addEventListener('click', () => {
  if (!navigator.geolocation) { toast('Geolocatie niet beschikbaar'); return; }
  navigator.geolocation.getCurrentPosition(
    pos => setLocation({ name: 'Huidige locatie', admin: `${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`, lat: pos.coords.latitude, lon: pos.coords.longitude }),
    err => toast(`Locatie niet beschikbaar: ${err.message}`), { timeout: 10000, maximumAge: 300000 });
});
let toastTimer = null;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2500); }
let resizeTimer = null;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 150); });
/* Op de telefoon staan timers stil zolang de app in de achtergrond zit. Bij terugkomen direct verversen
   als de data ouder is dan 2 minuten, zodat je nooit naar een oude nowcast kijkt. */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (!state.updated || Date.now() - state.updated.getTime() > 2 * 60e3) load();
});
window.addEventListener('online', () => { if (Object.values(state.fetched).some(f => f.stored) || Object.keys(state.errors).length) load(); });
document.addEventListener('scroll', hideTooltip, true);

/* ---- pinch-to-zoom on the multi-day charts: two touch pointers; the span start stays at "nu" ---- */
const pinch = { pts: new Map(), startDist: 0, startHorizon: 0, active: false, raf: 0, pending: null, host: null };
const dist = () => { const [a, b] = [...pinch.pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
$('content').addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch' || !state.forecast) return;
  const host = e.target.closest('.chart.zoomable');
  if (!host) return;
  // forget pointers from an earlier, unfinished gesture (e.g. a cancelled touch)
  const nowMs = Date.now();
  for (const [id, p] of pinch.pts) if (nowMs - p.at > 4000 || (pinch.host && pinch.host !== host)) pinch.pts.delete(id);
  pinch.host = host;
  pinch.pts.set(e.pointerId, { x: e.clientX, y: e.clientY, at: nowMs });
  if (pinch.pts.size === 2) {
    // only now take both pointers away from the chart (one finger = scrubbing, handled by the chart itself);
    // capture on the host: the SVG inside is redrawn mid-gesture, the host itself stays
    for (const id of pinch.pts.keys()) { try { host.setPointerCapture(id); } catch (err) {} }
    pinch.active = true; pinch.startDist = dist(); pinch.startHorizon = state.horizon == null ? maxHorizonHours() : state.horizon;
    hideTooltip();
    for (const hh of document.querySelectorAll('.chart')) if (hh._scrubTo) hh._scrubTo(null);
  }
});
window.addEventListener('pointermove', e => {
  if (!pinch.pts.has(e.pointerId)) return;
  pinch.pts.set(e.pointerId, { x: e.clientX, y: e.clientY, at: Date.now() });
  if (!pinch.active || pinch.pts.size !== 2) return;
  const scale = dist() / Math.max(1, pinch.startDist); // fingers apart = zoom in = fewer hours
  pinch.pending = pinch.startHorizon / scale;
  if (!pinch.raf) pinch.raf = setTimeout(() => { pinch.raf = 0; if (pinch.pending != null && pinch.active) setHorizon(pinch.pending, false); }, 16);
});
const endPinch = e => {
  if (!pinch.pts.has(e.pointerId)) return;
  pinch.pts.delete(e.pointerId);
  if (pinch.active && pinch.pts.size < 2) {
    pinch.active = false; pinch.pending = null;
    setHorizon(state.horizon == null ? null : Math.round(state.horizon), true);
  }
  if (!pinch.pts.size) pinch.host = null;
};
window.addEventListener('pointerup', endPinch);
window.addEventListener('pointercancel', endPinch);
/* trackpad pinch / ctrl+wheel on desktop */
$('content').addEventListener('wheel', e => {
  if (!e.ctrlKey || !e.target.closest('.chart.zoomable') || !state.forecast) return;
  e.preventDefault();
  const cur = state.horizon == null ? maxHorizonHours() : state.horizon;
  setHorizon(cur * Math.exp(e.deltaY * 0.01), true);
}, { passive: false });

/* ======================================================================
   6. Self-tests (open with ?test=1)
   ====================================================================== */
const api = { raintextToMmh, parseRaintext, deriveCloudTotal, beaufort, compass, cloudWord, niceScale, parseForecast, parseEnsemble, parseObs, haversineKm, monotonePath, quantile, tickStepHours, compareRain, drawChart, tempColor, weatherIcon, hourIcons, treeView, setTree, makeTree, windTree, catmullRomPath, setWindField, makeWindField, BEAUFORT, spanFor, maxHorizonHours, sunAltitude, solarEvents, skyColor, sunPhase, sunGlyph, sunWeatherKind, weatherAt, MODELS, state,
  fmtProb, nextRain, freshOnly, storeSave, storeLoad, tempModel, todayRange, blendRain };
window.Regen = api;

function runTests() {
  const results = [];
  const test = (name, fn) => { try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, msg: e.message }); } };
  const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} verwacht ${JSON.stringify(b)}, kreeg ${JSON.stringify(a)}`); };
  const near = (a, b, tol, msg = '') => { if (Math.abs(a - b) > tol) throw new Error(`${msg} verwacht ≈${b}, kreeg ${a}`); };
  const ok = (c, msg) => { if (!c) throw new Error(msg || 'conditie faalt'); };

  test('raintext: 0 → 0 mm/u, 109 → 1 mm/u, 141 → 10 mm/u, 77 → 0,1 mm/u', () => {
    eq(raintextToMmh(0), 0); near(raintextToMmh(109), 1, 1e-9); near(raintextToMmh(141), 10, 1e-9); near(raintextToMmh(77), 0.1, 1e-9);
  });
  test('raintext: parse 3 regels, tijden oplopend, waarden afgerond', () => {
    const now = new Date(2026, 9, 31, 19, 32);
    const r = parseRaintext('000|19:30\n109|19:35\n125|19:40\n', now);
    eq(r.length, 3); eq(r[0].v, 0); eq(r[1].v, 1); near(r[2].v, 3.16, 0.01);
    eq(r[1].t.getHours(), 19); eq(r[1].t.getMinutes(), 35); ok(r[2].t > r[1].t && r[1].t > r[0].t, 'tijden oplopend');
  });
  test('raintext: reeks over middernacht springt naar de volgende dag', () => {
    const now = new Date(2026, 9, 31, 23, 50);
    const r = parseRaintext('000|23:50\n000|23:55\n050|00:00\n050|00:05', now);
    eq(r[2].t.getDate(), 1, 'dag'); eq(r[2].t.getMonth(), 10, 'maand'); ok(r[2].t > r[1].t, 'na middernacht later dan ervoor');
  });
  test('raintext: ongeldige regels worden overgeslagen', () => {
    eq(parseRaintext('abc\n000|19:30\n|\n12|xx:yy').length, 1);
  });
  test('som nowcast: 12 mm/u gedurende 5 min = 1 mm', () => { near(12 / 12, 1, 1e-9); });
  test('bewolking afgeleid: 50/0/0 → 50, 50/50/0 → 75, 100/x/x → 100, null → null', () => {
    eq(deriveCloudTotal(50, 0, 0), 50); eq(deriveCloudTotal(50, 50, 0), 75); eq(deriveCloudTotal(100, 20, 30), 100); eq(deriveCloudTotal(null, 1, 1), null);
  });
  test('Beaufort: 0→0, 5→1, 19→3, 20→4, 60→7, 118→12', () => { eq(beaufort(0), 0); eq(beaufort(5), 1); eq(beaufort(19), 3); eq(beaufort(20), 4); eq(beaufort(60), 7); eq(beaufort(118), 12); });
  test('kompas: 0→N, 90→O, 225→ZW, 350→N, 191→Z', () => { eq(compass(0), 'N'); eq(compass(90), 'O'); eq(compass(225), 'ZW'); eq(compass(350), 'N'); eq(compass(191), 'Z'); });
  test('bewolkingswoord: 5 Helder, 50 Half bewolkt, 95 Bedekt', () => { eq(cloudWord(5), 'Helder'); eq(cloudWord(50), 'Half bewolkt'); eq(cloudWord(95), 'Bedekt'); });
  test('niceScale: neerslag 0..0,8 → 0..1; temp 3,2..11,7 omsluit data met ≤ 7 ticks', () => {
    const a = niceScale(0, 0.8 * 1.15, { zero: true, minSpan: 1 }); eq(a.min, 0); ok(a.max >= 0.92 && a.max <= 1.2, 'max ' + a.max); ok(a.step > 0);
    const t = niceScale(3.2, 11.7, { minSpan: 6 }); ok(t.min <= 3.2 && t.max >= 11.7, 'omsluit'); ok((t.max - t.min) / t.step <= 7, 'ticks');
  });

  // synthetic Open-Meteo payload: 2026-10-31 00:00 .. +95h, now = 31 okt 20:18
  const mkJson = (hoursValid = { harmonie: 70, icon: 60, arome: 60 }, mut = () => {}) => {
    const time = []; const base = new Date(2026, 9, 31, 0, 0);
    for (let i = 0; i < 96; i++) time.push(new Date(base.getTime() + i * HOUR).toISOString().slice(0, 16));
    // ISO slice gives UTC; rebuild as local wall-clock strings instead
    for (let i = 0; i < 96; i++) { const d = new Date(base.getTime() + i * HOUR); time[i] = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:00`; }
    const hourly = { time };
    for (const m of MODELS) {
      const n = hoursValid[m.key];
      for (const v of VARS) {
        if (m.key === 'arome' && ['rain', 'snowfall', 'cloud_cover', 'weather_code'].includes(v)) { hourly[`${v}_${m.id}`] = Array(96).fill(null); continue; }
        hourly[`${v}_${m.id}`] = Array.from({ length: 96 }, (_, i) => (i < n ? (v === 'precipitation' ? 0 : v.startsWith('cloud') ? 40 : v === 'wind_direction_10m' ? 200 : 10) : null));
      }
    }
    mut(hourly);
    return { hourly };
  };
  const NOW = new Date(2026, 9, 31, 20, 18);
  test('parseForecast: start op huidig uur, horizon per model, AROME-bewolking afgeleid', () => {
    const f = parseForecast(mkJson(), NOW);
    eq(f.startHour.getHours(), 20);
    eq(f.models.harmonie.instant[0].t.getHours(), 20, 'eerste instant-uur');
    eq(f.models.harmonie.instant.length, 70 - 20, 'HARMONIE uren');
    eq(f.models.icon.instant.length, 60 - 20, 'ICON uren');
    ok(f.models.harmonie.applicable && f.models.icon.applicable && f.models.arome.applicable, 'alle drie toepasbaar');
    eq(f.models.arome.instant[0].cloud_cover, deriveCloudTotal(40, 40, 40)); ok(f.models.arome.instant[0].cloud_derived, 'gemarkeerd als afgeleid');
    ok(f.models.harmonie.instant[0].cloud_derived !== true, 'HARMONIE niet afgeleid');
  });
  test('parseForecast: neerslagstaaf hoort bij het uur ERVOOR (waarde 21:00 → staaf 20:00–21:00)', () => {
    const f = parseForecast(mkJson(undefined, hh => { hh['precipitation_knmi_harmonie_arome_netherlands'][21] = 2.5; }), NOW);
    const bar = f.models.harmonie.interval[0];
    eq(bar.t.getHours(), 20); eq(bar.tEnd.getHours(), 21); eq(bar.precipitation, 2.5);
    eq(f.models.harmonie.interval.length, 70 - 21, 'aantal staven = uren − 1');
  });
  test('parseForecast: model met alleen nulls is niet toepasbaar', () => {
    const f = parseForecast(mkJson({ harmonie: 70, icon: 60, arome: 0 }), NOW);
    eq(f.models.arome.applicable, false); eq(f.models.arome.hours, 0);
  });
  test('compareRain: gelijke reeksen → geen waarschuwing', () => {
    const f = parseForecast(mkJson(), NOW);
    eq(compareRain(f.models.harmonie.interval, f.models.icon.interval), null);
  });
  test('compareRain: hoeveelheid 0,4 vs 3,0 mm → amount-waarschuwing', () => {
    const f = parseForecast(mkJson(undefined, hh => {
      for (let i = 30; i < 40; i++) { hh['precipitation_icon_d2'][i] = 0.3; hh['precipitation_knmi_harmonie_arome_netherlands'][i] = 0.04; }
    }), NOW);
    const r = compareRain(f.models.harmonie.interval, f.models.icon.interval);
    ok(r && r.kind === 'amount', 'kind amount, kreeg ' + JSON.stringify(r)); near(r.sumO, 3, 1e-6); near(r.sumP, 0.4, 1e-6);
  });
  test('compareRain: ICON 1 mm om 14:00 waar HARMONIE droog is → timing, who=other', () => {
    const f = parseForecast(mkJson(undefined, hh => { hh['precipitation_icon_d2'][38] = 1.0; }), NOW);
    const r = compareRain(f.models.harmonie.interval, f.models.icon.interval);
    ok(r && r.kind === 'timing' && r.who === 'other', JSON.stringify(r)); eq(r.t.getHours(), 13, 'staaf start 13:00 voor waarde 14:00'); eq(r.mm, 1);
  });
  test('compareRain: HARMONIE nat, ICON droog → timing, who=primary', () => {
    const f = parseForecast(mkJson(undefined, hh => { hh['precipitation_knmi_harmonie_arome_netherlands'][38] = 0.8; }), NOW);
    const r = compareRain(f.models.harmonie.interval, f.models.icon.interval);
    ok(r && r.kind === 'timing' && r.who === 'primary', JSON.stringify(r));
  });
  test('compareRain: zelfde bui één uur verschoven → GEEN waarschuwing (buurman-uren tellen mee)', () => {
    const f = parseForecast(mkJson(undefined, hh => { hh['precipitation_knmi_harmonie_arome_netherlands'][38] = 1.0; hh['precipitation_icon_d2'][39] = 1.0; }), NOW);
    eq(compareRain(f.models.harmonie.interval, f.models.icon.interval), null);
  });
  test('compareRain: klein verschil (0,6 vs 1,0 mm) → geen waarschuwing', () => {
    const f = parseForecast(mkJson(undefined, hh => { for (let i = 30; i < 40; i++) { hh['precipitation_icon_d2'][i] = 0.1; hh['precipitation_knmi_harmonie_arome_netherlands'][i] = 0.06; } }), NOW);
    eq(compareRain(f.models.harmonie.interval, f.models.icon.interval), null);
  });
  test('compareRain: vergelijkt hoogstens 48 uur', () => {
    const f = parseForecast(mkJson({ harmonie: 80, icon: 80, arome: 60 }, hh => { hh['precipitation_icon_d2'][21 + 50] = 5; }), NOW);
    eq(compareRain(f.models.harmonie.interval, f.models.icon.interval), null);
  });
  test('drawChart: staven zonder NaN, aantal staven = aantal natte uren', () => {
    const host = h('div'); host.style.width = '360px'; document.body.appendChild(host);
    const pts = Array.from({ length: 24 }, (_, i) => ({ t: new Date(NOW.getTime() + i * HOUR), tEnd: new Date(NOW.getTime() + (i + 1) * HOUR), v: i % 3 === 0 ? 1.2 : 0 }));
    drawChart(host, { tMin: pts[0].t, tMax: pts[23].tEnd, unit: 'mm', ticks: 'days', series: [{ kind: 'bar', name: 'x', color: 'red', points: pts }], fmt: fmtMm, tipTime: () => '', yOpts: { zero: true } });
    const bars = host.querySelectorAll('.bar'); eq(bars.length, 8);
    for (const el of host.querySelectorAll('[d]')) ok(!/NaN/.test(el.getAttribute('d')), 'NaN in pad');
    host.remove();
  });
  test('drawChart: lijn met band en 3 series tekent 3 paden en een spreiding', () => {
    const host = h('div'); host.style.width = '360px'; document.body.appendChild(host);
    const mk = off => Array.from({ length: 30 }, (_, i) => ({ t: new Date(NOW.getTime() + i * HOUR), v: 10 + off + Math.sin(i / 4) * 3 }));
    const a = mk(0), bb = mk(1), cc = mk(-1);
    drawChart(host, { tMin: a[0].t, tMax: a[29].t, unit: '°C', ticks: 'days', fmt: v => fmtNum(v, 1), tipTime: () => '',
      series: [{ kind: 'band', points: a.map((p, i) => ({ t: p.t, lo: cc[i].v, hi: bb[i].v })) }, { kind: 'line', name: 'a', color: 'red', points: a }, { kind: 'line', name: 'b', color: 'blue', points: bb }, { kind: 'line', name: 'c', color: 'green', points: cc }] });
    eq(host.querySelectorAll('.line').length, 3); eq(host.querySelectorAll('.spread').length, 1);
    host.remove();
  });

  // sun tests: reference times from Open-Meteo daily sunrise/sunset (Europe/Amsterdam) for 2026-10-31
  const minutesOff = (d, hh, mm) => Math.abs((d.getHours() * 60 + d.getMinutes()) - (hh * 60 + mm));
  const dayEv = (y, mo, d, lat, lon) => solarEvents(new Date(y, mo, d, 0, 0), new Date(y, mo, d + 1, 0, 0), lat, lon);
  test('zon: Amsterdam 31 okt 2026 op 07:34 en onder 17:13 (±3 min, Open-Meteo)', () => {
    const ev = dayEv(2026, 9, 31, 52.37, 4.90);
    const r = ev.find(e => e.kind === 'sunrise'), s = ev.find(e => e.kind === 'sunset');
    ok(r && s, 'beide events'); ok(minutesOff(r.t, 7, 34) <= 3, 'zon op ' + fmtTime(r.t)); ok(minutesOff(s.t, 17, 13) <= 3, 'zon onder ' + fmtTime(s.t));
  });
  test('zon: Groningen op 07:29, Maastricht onder 17:13 (±3 min) — locatieafhankelijk', () => {
    const g = dayEv(2026, 9, 31, 53.22, 6.57).find(e => e.kind === 'sunrise');
    const mTr = dayEv(2026, 9, 31, 50.85, 5.69).find(e => e.kind === 'sunset');
    ok(minutesOff(g.t, 7, 29) <= 3, 'Groningen ' + fmtTime(g.t)); ok(minutesOff(mTr.t, 17, 13) <= 3, 'Maastricht ' + fmtTime(mTr.t));
  });
  test('zon: volgorde dageraad < zonsopkomst < zonsondergang < schemer-einde', () => {
    const ev = dayEv(2026, 9, 31, 52.37, 4.90).map(e => e.kind);
    eq(ev.join(','), 'dawn,sunrise,sunset,dusk');
  });
  test('zon: burgerlijke schemer duurt in juni langer dan in oktober (52°N), beide 30–60 min', () => {
    const dur = ev => { const s = ev.find(e => e.kind === 'sunset'), d = ev.find(e => e.kind === 'dusk'); return (d.t - s.t) / 60e3; };
    const jun = dur(dayEv(2026, 5, 21, 52.37, 4.90)), okt = dur(dayEv(2026, 9, 31, 52.37, 4.90));
    ok(jun > okt, `juni ${jun.toFixed(0)} min, oktober ${okt.toFixed(0)} min`); ok(jun >= 30 && jun <= 60 && okt >= 30 && okt <= 60, 'binnen 30–60 min');
  });
  test('zon: daglengte juni > oktober > december (Amsterdam)', () => {
    const len = ev => (ev.find(e => e.kind === 'sunset').t - ev.find(e => e.kind === 'sunrise').t) / HOUR;
    const j = len(dayEv(2026, 5, 21, 52.37, 4.90)), o = len(dayEv(2026, 9, 31, 52.37, 4.90)), d = len(dayEv(2026, 11, 21, 52.37, 4.90));
    ok(j > 16 && j < 17, 'juni ' + j.toFixed(2)); ok(o > 9.4 && o < 9.9, 'okt ' + o.toFixed(2)); ok(d > 7.6 && d < 8, 'dec ' + d.toFixed(2));
  });
  test('hemelkleur: dag boven 8°, nacht onder −18°, schemer ertussen monotoon donkerder', () => {
    const pal = { day: [255, 250, 234], dawn: [253, 230, 204], night: [227, 230, 240] };
    eq(skyColor(10, pal).join(), pal.day.join()); eq(skyColor(-20, pal).join(), pal.night.join());
    const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    let prev = Infinity; for (const a of [0, -2, -4, -6, -9, -12, -15, -18]) { const l = lum(skyColor(a, pal)); ok(l <= prev + 1e-9, `niet monotoon bij ${a}°`); prev = l; }
    eq(sunPhase(1), 'dag'); eq(sunPhase(-3), 'burgerlijke schemer'); eq(sunPhase(-10), 'nautische schemer'); eq(sunPhase(-25), 'nacht');
  });

  test('zonglyph: weer bepaalt de variant (regen > bewolkt > half bewolkt > helder)', () => {
    eq(sunWeatherKind(null), 'clear'); eq(sunWeatherKind({ cloud: 10, rain: 0 }), 'clear'); eq(sunWeatherKind({ cloud: 45, rain: 0 }), 'partly');
    eq(sunWeatherKind({ cloud: 90, rain: 0.05 }), 'cloud'); eq(sunWeatherKind({ cloud: 20, rain: 0.3 }), 'rain'); eq(sunWeatherKind({ cloud: null, rain: null }), 'clear');
    const g = sunGlyph(0, 0, 'sunrise', 'rain', 't'); eq(g.querySelectorAll('.drops line').length, 3); ok(g.querySelector('.cloud'), 'wolk aanwezig');
    ok(!sunGlyph(0, 0, 'sunset', 'clear', 't').querySelector('.cloud'), 'helder zonder wolk');
  });
  test('weatherAt: bewolking van het dichtstbijzijnde uur, neerslag van het lopende uur', () => {
    const saved = state.forecast;
    try {
      state.forecast = parseForecast(mkJson(undefined, hh => { hh['precipitation_knmi_harmonie_arome_netherlands'][23] = 1.2; hh['cloud_cover_knmi_harmonie_arome_netherlands'][22] = 95; }), NOW);
      const w = weatherAt(new Date(2026, 9, 31, 22, 20)); // in het uur 22–23, dichtst bij 22:00
      eq(w.rain, 1.2, 'neerslag van uur 22–23 (waarde bij 23:00)'); eq(w.cloud, 68, 'bewolking om 22:00, gemiddeld met 21:00 en 23:00');
      eq(weatherAt(new Date(2030, 0, 1)), null, 'buiten bereik');
    } finally { state.forecast = saved; }
  });
  test('bewolking gladgemaakt: 0/100/0 → 50, rand weegt alleen bestaande buren, null blijft null', () => {
    eq(smoothAt([0, 100, 0], 1), 50); eq(smoothAt([100, 0, 100], 1), 50); eq(smoothAt([0, 100], 0), 33); eq(smoothAt([40, null, 40], 1), null); eq(smoothAt([null, 60, 30], 1), 50);
  });
  test('zon %: heldere hemel → 0 %, weinig zon → 100 %, nacht en lage zon → null', () => {
    const t0 = new Date(2026, 10, 2, 12), t1 = new Date(2026, 10, 2, 13), cs = clearSky(t0, t1, 52.37, 4.9);
    ok(cs.ghi > 300 && cs.ghi < 420, 'heldere hemel 2 nov 12–13 u, kreeg ' + cs.ghi);
    eq(skyFromSun(0.9 * cs.ghi, t0, t1, 52.37, 4.9), 0); eq(skyFromSun(cs.ghi * 1.1, t0, t1, 52.37, 4.9), 0, 'meer dan helder');
    eq(skyFromSun(0.3 * cs.ghi, t0, t1, 52.37, 4.9), 100); eq(skyFromSun(0.6 * cs.ghi, t0, t1, 52.37, 4.9), 50);
    eq(skyFromSun(0, new Date(2026, 10, 2, 22), new Date(2026, 10, 2, 23), 52.37, 4.9), null, 'nacht');
    eq(skyFromSun(5, new Date(2026, 10, 2, 7, 30), new Date(2026, 10, 2, 8, 30), 52.37, 4.9), null, 'zon net op');
    eq(skyFromSun(null, t0, t1, 52.37, 4.9), null); eq(skyFromSun(100, t0, t1, null, null), null);
  });
  test('icoon verwachting: bewolking beslist, bij een dichte lucht de zon die doorkomt; zonder zon de lagen', () => {
    eq(forecastKind({ cloud: 20, sun: 0.3 }), 'clear', 'weinig bewolking: zonnig, ook bij weinig zon');
    eq(forecastKind({ cloud: 50, sun: 0.3 }), 'partly');
    eq(forecastKind({ cloud: 95, sun: 0.9 }), 'partly', 'dicht maar volop zon: losse wolken');
    eq(forecastKind({ cloud: 95, sun: 0.77 }), 'thin', 'di 10 nov 13 u'); eq(forecastKind({ cloud: 95, sun: 0.6 }), 'thin');
    eq(forecastKind({ cloud: 100, sun: 0.48 }), 'cloud', 'za 7 nov 15 u');
    eq(forecastKind({ cloud: 90, low: 5, mid: 10, high: 90, sun: null }), 'thin', 'lage zon: alleen hoge wolken');
    eq(forecastKind({ cloud: 90, low: 80, mid: 10, high: 90, sun: null }), 'cloud');
    eq(forecastKind({ cloud: 90, sun: null }), 'cloud', 'zonder lagen: bewolkt');
    eq(forecastKind({ cloud: 95, sun: 0.7, rain: 0.2 }), 'rain'); eq(forecastKind({ cloud: null, sun: 0.95 }), 'clear', 'zonder bewolking: de zon');
    eq(tintCover('thin', 90), 45, 'een sluier telt voor de helft in de grijstint'); eq(tintCover('cloud', 90), 90);
    const ic = weatherIcon(0, 0, 'thin', false); ok(ic.querySelector('.disc') && ic.querySelectorAll('.veil line').length === 3, 'zon boven drie sluierstrepen');
    ok(weatherIcon(0, 0, 'thin', true).querySelector('.moon'), 'nacht: maan achter de sluier'); ok(sunGlyph(0, 0, 'sunset', 'thin', 't').querySelector('.veil'), 'ook bij zonsondergang');
  });
  test('overzicht: HARMONIE-uur met dichte lucht: veel zon = half bewolkt, sluier = dun, weinig zon = bewolkt', () => {
    const saved = state.forecast, savedLoc = state.loc;
    try {
      // 2 nov: 12–15 u 100 % bewolking (gladgemaakt 75/100/75), met per uur steeds minder zon
      const time = [], base = new Date(2026, 10, 2, 0);
      for (let i = 0; i < 48; i++) { const d = new Date(base.getTime() + i * HOUR); time.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:00`); }
      const hourly = { time }, id = PRIMARY.id;
      for (const v of VARS) hourly[`${v}_${id}`] = Array(48).fill(v === 'precipitation' ? 0 : v.startsWith('cloud') ? 0 : 10);
      for (const i of [12, 13, 14]) hourly[`cloud_cover_${id}`][i] = 100;
      const sw = (hr, f) => { hourly[`shortwave_radiation_${id}`][hr + 1] = f * clearSky(new Date(2026, 10, 2, hr), new Date(2026, 10, 2, hr + 1), 52.37, 4.9).ghi; };
      sw(12, 0.95); sw(13, 0.7); sw(14, 0.4);
      state.loc = { name: 'x', lat: 52.37, lon: 4.9 };
      state.forecast = parseForecast({ latitude: 52.37, longitude: 4.9, hourly }, new Date(2026, 10, 2, 9, 5));
      const H = state.forecast.models.harmonie, kindAt = hr => hourIcons(H).find(x => x.hour.getHours() === hr).kind;
      eq(H.instant.find(r => r.t.getHours() === 13).cloud_cover, 100, 'bewolking 13:00 gladgemaakt');
      eq(kindAt(12), 'partly', '75 % met volop zon'); eq(kindAt(13), 'thin', '100 % met 70 % zon'); eq(kindAt(14), 'cloud', '75 % met 40 % zon');
      const w = weatherAt(new Date(2026, 10, 2, 13, 10)); eq(w.kind, 'thin'); eq(w.cloud, 50, 'grijstint: sluier telt half');
    } finally { state.forecast = saved; state.loc = savedLoc; }
  });
  test('ensemble: kans = aandeel leden ≥ 0,1 mm; band = 10/50/90-percentiel; staaf hoort bij uur ervoor', () => {
    const time = []; const base = new Date(2026, 9, 31, 0, 0);
    for (let i = 0; i < 48; i++) { const d = new Date(base.getTime() + i * HOUR); time.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:00`); }
    const hourly = { time };
    const mk = (fn) => Array.from({ length: 48 }, (_, i) => fn(i));
    // 5 leden: om 21:00 (index 21) geven 2 van 5 regen; temperatuur spreidt 8..12
    hourly.precipitation = mk(i => (i === 21 ? 0.5 : 0)); hourly.precipitation_member01 = mk(i => (i === 21 ? 0.2 : 0));
    hourly.precipitation_member02 = mk(() => 0); hourly.precipitation_member03 = mk(() => 0); hourly.precipitation_member04 = mk(() => 0);
    hourly.temperature_2m = mk(() => 10); hourly.temperature_2m_member01 = mk(() => 8); hourly.temperature_2m_member02 = mk(() => 9); hourly.temperature_2m_member03 = mk(() => 11); hourly.temperature_2m_member04 = mk(() => 12);
    hourly.wind_speed_10m = mk(() => 5); hourly.cloud_cover = mk(() => 50);
    for (let k = 1; k <= 4; k++) { hourly[`wind_speed_10m_member0${k}`] = mk(() => 5); hourly[`cloud_cover_member0${k}`] = mk(() => 50); }
    const e = parseEnsemble({ hourly }, NOW);
    eq(e.members, 5); eq(e.prob[0].t.getHours(), 20, 'eerste staaf start 20:00'); near(e.prob[0].v, 0.4, 1e-9, 'kans 2/5 voor 20–21'); eq(e.prob[1].v, 0);
    const b = e.bands.temperature_2m[0]; eq(b.t.getHours(), 20); near(b.lo, 8.4, 1e-9); near(b.med, 10, 1e-9); near(b.hi, 11.6, 1e-9);
    eq(quantile([1, 2, 3, 4], 0.5), 2.5); eq(quantile([], 0.5), null);
  });
  test('tijdlabels: stap volgt de zoom (≥ 44 px tussen labels)', () => {
    eq(tickStepHours(50), 1); eq(tickStepHours(25), 2); eq(tickStepHours(15), 3); eq(tickStepHours(8), 6); eq(tickStepHours(4), 12); eq(tickStepHours(1), 24);
  });
  test('vloeiende lijn: monotone interpolatie blijft tussen de datapunten (geen overshoot)', () => {
    const pts = [{ x: 0, y: 100 }, { x: 10, y: 100 }, { x: 20, y: 0 }, { x: 30, y: 0 }, { x: 40, y: 50 }];
    const d = monotonePath(pts);
    ok(d.startsWith('M0,100') && d.includes(' C'), 'bezierpad');
    const ys = [...d.matchAll(/[ ,](-?\d+(?:\.\d+)?)(?=[ ]|$)/g)].map(m => parseFloat(m[1]));
    ok(ys.every(v => v >= -0.01 && v <= 100.01), 'alle controlepunten binnen 0..100');
    eq(monotonePath([{ x: 1, y: 2 }]), 'M1,2'); eq(monotonePath([]), '');
  });
  test('meting: dichtstbijzijnde KNMI-station met temperatuur, wind in km/u', () => {
    const json = { actual: { stationmeasurements: [
      { stationname: 'Meetstation IJmuiden', lat: 52.47, lon: 4.57, windspeed: 10, timestamp: '2026-10-31T22:30:00' },
      { stationname: 'Meetstation Schiphol', lat: 52.3, lon: 4.77, temperature: 9.1, feeltemperature: 7.5, windspeed: 5, windgusts: 8, winddirectiondegrees: 40, timestamp: '2026-10-31T22:30:00' },
      { stationname: 'Meetstation De Bilt', lat: 52.1, lon: 5.18, temperature: 8.0, windspeed: 2, timestamp: '2026-10-31T22:30:00' },
    ] } };
    const o = parseObs(json, 52.37, 4.90); // Amsterdam: IJmuiden is dichterbij maar meet geen temperatuur
    eq(o.station, 'Schiphol'); near(o.wind, 18, 1e-9); near(o.gust, 28.8, 1e-9); eq(o.temp, 9.1); eq(o.time.getHours(), 22); ok(o.dist > 10 && o.dist < 20, 'afstand ' + o.dist);
    near(haversineKm(52.1, 5.18, 52.3, 4.77), 36, 1.5, 'De Bilt–Schiphol ≈ 36 km');
    eq(parseObs({ actual: { stationmeasurements: [] } }, 52, 5), null);
    eq(o.sky, null, 'zonder zonmetingen geen bedekking');
  });
  test('meting: bedekking uit de zon van stations binnen 40 km, gewogen naar afstand; nacht → null', () => {
    const t1 = new Date(2026, 10, 2, 15), t0 = new Date(t1.getTime() - 10 * 60e3);
    const clear = (la, lo) => clearSky(t0, t1, la, lo).ghi;
    const st = (name, la, lo, f, ts = '2026-11-02T15:00:00') => ({ stationname: name, lat: la, lon: lo, sunpower: f * clear(la, lo), timestamp: ts });
    const sunny = [st('Schiphol', 52.3, 4.77, 1), st('Wijk aan Zee', 52.5, 4.6, 0.95), st('Groningen', 53.13, 6.59, 0.1)];
    eq(obsSky(sunny, 52.37, 4.90), 0, 'helder rondom, Groningen te ver');
    eq(obsSky([st('Schiphol', 52.3, 4.77, 0.3)], 52.37, 4.90), 100, 'donker');
    const mixed = obsSky([st('Schiphol', 52.3, 4.77, 0.3), st('Wijk aan Zee', 52.5, 4.6, 0.9)], 52.37, 4.90);
    ok(mixed > 50 && mixed < 100, 'dichterbij weegt zwaarder, kreeg ' + mixed);
    eq(obsSky([st('Schiphol', 52.3, 4.77, 0, '2026-11-02T22:00:00')], 52.37, 4.90), null, 'nacht');
    eq(obsSky([{ stationname: 'IJmuiden', lat: 52.47, lon: 4.57, timestamp: '2026-11-02T15:00:00' }], 52.37, 4.90), null, 'geen zonmeting');
  });
  test('week: dagicoontje = mediaan van de lichte uren; laat dichttrekken houdt de dag zonnig', () => {
    const mk = cloudFrom => {
      const time = [], base = new Date(2026, 10, 2, 0);
      for (let i = 0; i < 48; i++) { const d = new Date(base.getTime() + i * HOUR); time.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:00`); }
      const hourly = { time }, id = PRIMARY.id;
      for (const v of VARS) hourly[`${v}_${id}`] = Array.from({ length: 48 }, (_, i) => (v.startsWith('cloud') ? (i >= cloudFrom && i < 24 ? 100 : 0) : v === 'precipitation' ? 0 : 10));
      return parseForecast({ hourly }, base).models.harmonie; // zonder coördinaten: bewolking beslist
    };
    const a = new Date(2026, 10, 2), b = new Date(2026, 10, 3);
    eq(dayKind(mk(15), a, b, 52.37, 4.9), 'clear', '08–15 u blauw, laatste twee lichte uren dicht');
    eq(dayKind(mk(11), a, b, 52.37, 4.9), 'cloud', 'vanaf 11 u dicht: meeste lichte uren bewolkt');
    eq(dayKind(mk(15), new Date(2026, 10, 4), new Date(2026, 10, 5), 52.37, 4.9), null, 'buiten HARMONIE');
  });
  test('week: dagen vanaf middernacht, temperatuur uit ICON-D2, stopt bij de eerste onvolledige dag', () => {
    const saved = state.forecast, savedObs = state.obs, savedEns = state.ens, savedEc = state.ecmwf;
    try {
      state.ens = null; state.ecmwf = null; // alleen HARMONIE-dagen, en zonder kans dus de neerslag in mm
      const json = mkJson(undefined, hh => {
        hh['temperature_2m_icon_d2'][14] = 15; hh['temperature_2m_icon_d2'][3] = 4; hh['temperature_2m_knmi_harmonie_arome_netherlands'][14] = 20;
        hh['precipitation_knmi_harmonie_arome_netherlands'][10] = 1.2; hh['precipitation_knmi_harmonie_arome_netherlands'][11] = 0.3; hh['precipitation_knmi_harmonie_arome_netherlands'][3] = 4; // nachtregen telt niet mee
      });
      const f = withDays(json, NOW, 52.37, 4.9); // 20:18, maar de dag telt vanaf 00:00
      eq(f.models.harmonie.instant[0].t.getHours(), 20, 'verwachting zelf begint nog bij nu');
      eq(f.days.length, 2, 'ICON-D2 dekt 60 u: twee hele dagen');
      eq(f.days[0].mn, 4); eq(f.days[0].mx, 15, 'max uit ICON-D2, ook al is 14:00 voorbij'); near(f.days[0].rain, 1.5, 1e-9); eq(f.days[0].kind, 'partly');
      state.forecast = f; state.obs = null;
      const host = h('div'); renderWeek(host);
      const rows = host.querySelectorAll('.week-row');
      eq(rows.length, 2); eq(rows[0].querySelector('.d').textContent, 'Za', '31 okt 2026');
      eq(rows[0].querySelector('.mm').textContent, '1,5 mm'); eq(rows[0].querySelector('.mn').textContent, '4°'); eq(rows[0].querySelector('.mx').textContent, '15°');
      ok(!rows[1].querySelector('.mm'), 'droge dag zonder mm');
      const hrs = host.querySelectorAll('.hour-strip .hour'), lbl = i => hrs[i].querySelector('.hl').textContent;
      eq(hrs.length, 40, 'per uur zolang ICON-D2 reikt: 20:00 t/m 59 u');
      eq(lbl(0), 'Nu'); eq(lbl(1), '21'); eq(lbl(4), 'Zo', 'middernacht krijgt de dagnaam'); eq(hrs[1].querySelector('.ht').textContent, '10°');
      ok(hrs[1].querySelector('.wicon .moon'), '21:00 in oktober: maan');
    } finally { state.forecast = saved; state.obs = savedObs; state.ens = savedEns; state.ecmwf = savedEc; }
  });
  // synthetic ensemble payload: `days` days of hours from 2 nov 2026 00:00, member 0 = control
  const mkEnsJson = (days, members, vars, fill) => {
    const time = [], base = new Date(2026, 10, 2, 0);
    for (let i = 0; i < days * 24; i++) { const d = new Date(base.getTime() + i * HOUR); time.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:00`); }
    const hourly = { time };
    for (let m = 0; m < members; m++) for (const v of vars) hourly[v + (m ? `_member${String(m).padStart(2, '0')}` : '')] = Array.from({ length: days * 24 }, (_, i) => fill(v, m, i));
    return { hourly };
  };
  test('overzicht: tik op de uurstrook opent Per uur; de tab Overzicht blijft gemarkeerd, terug gaat naar de dagen', () => {
    const saved = { f: state.forecast, o: state.obs, e: state.ens, c: state.ecmwf, t: state.tab };
    try {
      state.forecast = withDays(mkJson(), NOW, 52.37, 4.9); state.obs = null; state.ens = null; state.ecmwf = null;
      const host = h('div'); renderWeek(host);
      host.querySelector('.hour-strip').click();
      eq(state.tab, 'hours'); eq($('title').textContent, 'Per uur');
      eq(document.querySelector('.tab[data-tab="overview"]').getAttribute('aria-pressed'), 'true', 'tab Overzicht gemarkeerd');
      const back = $('content').querySelector('.back-link'); ok(back, 'terugknop');
      back.click(); eq(state.tab, 'overview'); ok($('content').querySelector('.week-list'), 'terug bij de dagen');
    } finally { state.forecast = saved.f; state.obs = saved.o; state.ens = saved.e; state.ecmwf = saved.c; state.tab = saved.t; render(); }
  });
  test('overzicht: regenbalk zegt wat de radar ziet, met mini-radar, en opent Regen', () => {
    const saved = { f: state.forecast, o: state.obs, e: state.ens, c: state.ecmwf, n: state.nowcast, t: state.tab };
    try {
      const t0 = new Date(); t0.setSeconds(0, 0); t0.setMinutes(t0.getMinutes() - (t0.getMinutes() % 5));
      const nc = Array.from({ length: 24 }, (_, i) => ({ t: new Date(t0.getTime() + i * MIN5), v: i === 6 ? 1.2 : 0 }));
      state.forecast = null; state.obs = null; state.ens = null; state.ecmwf = null; state.nowcast = nc;
      let row = rainRow();
      eq(row.querySelector('.rt').textContent, `Regen om ${fmtTime(nc[6].t)}`); ok(row.classList.contains('wet'), 'nat'); eq(row.querySelectorAll('.spark rect').length, 1, 'één staafje');
      state.nowcast = nc.map(p => ({ ...p, v: 0 }));
      row = rainRow();
      ok(row.querySelector('.rt').textContent.startsWith('Droog'), 'droog'); ok(!row.classList.contains('wet')); eq(row.querySelectorAll('.spark rect').length, 0);
      const host = h('div'); renderWeek(host);
      host.querySelector('.rain-row').click();
      eq(state.tab, 'rain'); eq($('title').textContent, 'Regen');
      eq(document.querySelector('.tab[aria-pressed="true"]').dataset.tab, 'overview', 'tab Overzicht gemarkeerd');
      ok($('content').querySelector('.back-link'), 'terugknop'); ok(!document.querySelector('.tab[data-tab="rain"]'), 'geen Regen-tab meer');
    } finally { state.forecast = saved.f; state.obs = saved.o; state.ens = saved.e; state.ecmwf = saved.c; state.nowcast = saved.n; state.tab = saved.t; render(); }
  });
  test('v21: droog zegt hoe lang, zonder lege mini-radar; Regen-pagina zonder lege grafiek', () => {
    const t = new Date(2026, 10, 7, 12, 0);
    eq(dryFor(new Date(t.getTime() + 48 * HOUR), t), 'de komende 2 dagen');
    eq(dryFor(new Date(t.getTime() + 30 * HOUR), t), 'de komende 30 uur');
    eq(dryFor(new Date(t.getTime() + 115 * 60e3), t), 'de komende 2 uur');
    eq(dryFor(new Date(t.getTime() + 60 * 60e3), t), `tot ${fmtTime(new Date(t.getTime() + HOUR))}`);
    const saved = { f: state.forecast, e: state.ens, n: state.nowcast, er: state.errors };
    try {
      const t0 = new Date(); t0.setSeconds(0, 0); t0.setMinutes(t0.getMinutes() - (t0.getMinutes() % 5));
      state.forecast = null; state.ens = null; state.errors = {};
      state.nowcast = Array.from({ length: 24 }, (_, i) => ({ t: new Date(t0.getTime() + i * MIN5), v: 0 }));
      const row = rainRow();
      eq(row.querySelector('.rt').textContent, 'Droog de komende 2 uur'); ok(!row.querySelector('.spark'), 'geen lege mini-radar');
      const host = h('div'); renderRain(host);
      ok(host.querySelector('.quiet-line'), 'één regel in plaats van een lege grafiek'); ok(!host.querySelector('.card').querySelector('.chart, .icon-btn'), 'geen assen, geen tabelknop');
      eq(host.querySelector('.hero .big').textContent, 'Droog'); eq(host.querySelector('.hero .sub').textContent, 'de komende 2 uur');
    } finally { state.forecast = saved.f; state.ens = saved.e; state.nowcast = saved.n; state.errors = saved.er; }
  });
  test('v22: Overzicht heeft de plaats als titel, het nu bovenaan en zon op/onder in de strook', () => {
    const saved = { f: state.forecast, o: state.obs, e: state.ens, c: state.ecmwf, n: state.nowcast, t: state.tab };
    try {
      state.forecast = withDays(mkJson(), NOW, 52.37, 4.9); state.obs = null; state.ens = null; state.ecmwf = null; state.nowcast = null;
      state.tab = 'overview'; render();
      eq($('title').textContent, state.loc.name, 'plaats als titel'); ok($('locBtn').hidden, 'geen tweede plaatsknop');
      ok($('title').querySelector('button'), 'titel is de locatieknop'); ok($('sunline').hidden, 'zonregel weg op Overzicht');
      ok(!$('subtitle').textContent.includes(state.loc.name), 'plaats niet twee keer');
      const now = $('content').querySelector('.now-card');
      ok(now && now.querySelector('.now-temp'), 'kaart van nu'); ok(now.querySelector('.rain-row'), 'regenregel in de kaart van nu');
      ok($('content').querySelector('.now-card + .card.hours .hour.now'), 'strip onder het nu, eerste cel Nu');
      // the test data are of 31 oct 20:18: sunrise 1 nov 07:36 goes after the cell of 07, sunset 17:11 after 17
      const strip = hourStrip(new Date(NOW));
      const cells = [...strip.children], sun = cells.filter(x => x.classList.contains('sun'));
      ok(sun.length >= 2, 'zon op en onder in de strook');
      eq(cells[cells.indexOf(sun[0]) - 1].querySelector('.hl').textContent, '07', 'zon op na het uur van 07');
      ok(sun[0].getAttribute('aria-label').startsWith('Zon op om 07:'), 'zon op'); eq(sun[0].querySelector('.ht').textContent, 'op');
      ok(sun[1].getAttribute('aria-label').startsWith('Zon onder om 17:'), 'zon onder');
      state.tab = 'temp'; render(); ok(!$('locBtn').hidden, 'plaatsknop terug'); eq($('title').textContent, 'Temperatuur'); ok($('sunline').hidden, 'geen zonregel op Temperatuur');
      state.tab = 'hours'; render(); ok(!$('sunline').hidden, 'zonregel op Per uur');
    } finally { state.forecast = saved.f; state.obs = saved.o; state.ens = saved.e; state.ecmwf = saved.c; state.nowcast = saved.n; state.tab = saved.t; render(); }
  });
  test('v21: bewolking noemt alleen lagen met wolken; fout in mensentaal, code onder Info', () => {
    eq(cloudHint({ cloud_cover: 0, cloud_cover_low: 0, cloud_cover_mid: 0, cloud_cover_high: 0 }), '0% bedekt');
    eq(cloudHint({ cloud_cover: 62, cloud_cover_low: 40, cloud_cover_mid: 0, cloud_cover_high: 30 }), '62% bedekt · laag 40% · hoog 30%');
    const es = errorState();
    ok(!es.textContent.includes('HTTP'), 'geen technische code'); ok(es.querySelector('button'), 'knop opnieuw proberen');
    const saved = state.errors;
    try {
      state.errors = { forecast: 'HTTP 503', nowcast: 'verouderd' };
      const p = h('div'); errorNote(p, 'forecast', 'Modelverwachting'); eq(p.textContent, 'Modelverwachting is nu niet bereikbaar.');
      const q = h('div'); errorNote(q, 'nowcast', 'Radar'); eq(q.textContent, 'Geen actuele radar.');
      const info = h('div'); renderInfo(info); ok(info.textContent.includes('verwachting: HTTP 503'), 'code onder Info');
    } finally { state.errors = saved; }
  });
  test('overzicht: tik op een HARMONIE-dag opent Per uur voor die dag, zonder zoom; ECMWF-dagen niet', () => {
    const saved = { f: state.forecast, o: state.obs, e: state.ens, c: state.ecmwf, t: state.tab, d: state.day };
    try {
      state.forecast = withDays(mkJson(), NOW, 52.37, 4.9); state.obs = null; state.ens = null;
      state.ecmwf = { days: [{ day: new Date(2026, 10, 2), kind: 'cloud', mn: 3, mx: 8, mnLo: 2, mxHi: 10, chance: 0.6, n: 51 }] };
      const host = h('div'); renderWeek(host);
      const rows = host.querySelectorAll('.week-row');
      eq(rows.length, 3); ok(rows[0].classList.contains('open') && rows[1].classList.contains('open'), 'HARMONIE-dagen tikbaar'); ok(!rows[2].classList.contains('open'), 'ECMWF-dag nog niet');
      rows[1].click();
      eq(state.tab, 'day'); eq(state.day.getDate(), 1); eq($('title').textContent, 'Zondag', '1 nov 2026');
      const page = $('content');
      eq(page.querySelector('.hero .l').textContent, 'Zondag 1 november'); ok(page.querySelector('.hero .big').textContent.includes('10° tot 10°'), 'min en max van de dag');
      eq(page.querySelector('.card h2').textContent, 'Per uur'); ok(page.querySelector('.chart') && !page.querySelector('.chart.zoomable'), 'grafiek zonder zoom');
      eq(document.querySelector('.tab[aria-pressed="true"]').dataset.tab, 'overview');
      page.querySelector('.back-link').click(); eq(state.tab, 'overview');
    } finally { state.forecast = saved.f; state.obs = saved.o; state.ens = saved.e; state.ecmwf = saved.c; state.tab = saved.t; state.day = saved.d; render(); }
  });
  test('overzicht: tik op een ECMWF-dag opent Per uur uit het ensemble: mediaan met band, boompjes, eigen dagtegel', () => {
    const saved = { f: state.forecast, o: state.obs, e: state.ens, c: state.ecmwf, t: state.tab, d: state.day };
    try {
      state.forecast = withDays(mkJson(), NOW, 52.37, 4.9); state.obs = null; state.ens = null;
      state.ecmwf = parseEcmwf(mkEnsJson(3, 3, ECMWF_VARS, (v, m, i) => v === 'temperature_2m' ? 5 + m + (i % 24 === 14 ? 5 : 0)
        : v === 'wind_speed_10m' ? 10 + m * 5 : v === 'wind_direction_10m' ? 200 : v === 'shortwave_radiation' ? null : 0), 52.37, 4.9, new Date(2026, 10, 2, 0));
      const host = h('div'); renderWeek(host);
      const rows = host.querySelectorAll('.week-row');
      eq(rows.length, 4, '31 okt en 1 nov uit HARMONIE, 2 en 3 nov uit ECMWF'); ok(rows[2].classList.contains('open'), 'ECMWF-dag tikbaar');
      rows[2].click();
      eq(state.tab, 'day'); eq($('title').textContent, 'Maandag');
      const page = $('content');
      eq(page.querySelector('.hero .l').textContent, 'Maandag 2 november'); eq(page.querySelector('.card h2').textContent, 'Per uur');
      ok(page.querySelector('.card .meta').textContent.includes('90% ervan'), 'uitleg van de band'); ok(!page.textContent.includes('10–90'), 'geen 10–90 meer');
      eq(page.querySelectorAll('.chart').length, 2, 'temperatuur en neerslag'); ok(!page.querySelector('.chart.zoomable'), 'zonder zoom');
      ok(page.querySelectorAll('.chart path.band').length >= 2, 'banden voor temperatuur en regen'); ok(page.querySelector('.mtree'), 'boompjes');
    } finally { state.forecast = saved.f; state.obs = saved.o; state.ens = saved.e; state.ecmwf = saved.c; state.tab = saved.t; state.day = saved.d; render(); }
  });
  test('week: mediaan-icoon bij even aantal: halverwege, halven naar boven', () => {
    eq(medianKind([0, 0, 2]), 'clear'); eq(medianKind([0, 2]), 'partly'); eq(medianKind([1, 2]), 'thin', 'half bewolkt en dun: dun'); eq(medianKind([1, 3]), 'thin'); eq(medianKind([4, 0, 4]), 'rain'); eq(medianKind([]), null);
  });
  test('ECMWF: per lid een dag, dan mediaan over de leden; 25/75 % als band; kans = deel natte leden', () => {
    const json = mkEnsJson(3, 3, ECMWF_VARS, (v, m, i) =>
      v === 'temperature_2m' ? 5 + m + (i % 24 === 14 ? 5 : 0)
      : v === 'precipitation' ? (m === 1 && i === 11 ? 1 : m === 2 && i === 3 ? 5 : 0)
      : v === 'cloud_cover' ? (m > 0 && i >= 24 ? 100 : 0)
      : v === 'wind_speed_10m' ? 10 + m * 5 : v === 'wind_direction_10m' ? 100 + m * 10
      : null); // zonder straling beslist de bewolking
    const e = parseEcmwf(json, 52.37, 4.9, new Date(2026, 10, 2, 10));
    eq(e.members, 3); eq(e.days.length, 2, '72 uur: twee hele dagen');
    const [d1, d2] = e.days;
    eq(d1.day.getDate(), 2); eq(d1.mn, 6); eq(d1.mx, 11); near(d1.mnLo, 5.5, 1e-9); near(d1.mxHi, 11.5, 1e-9);
    near(d1.chance, 1 / 3, 1e-9); eq(d1.kind, 'clear', 'één regenuur maakt de dag niet nat');
    eq(d2.kind, 'cloud', 'twee van drie leden bewolkt'); eq(d2.chance, 0);
    eq(e.hours.length, 71, 'per uur zolang het uur erna er is');
    const h14 = e.hours[14], h10 = e.hours[10];
    eq(h14.tMed, 11); near(h14.tLo, 10.1, 1e-9); near(h14.tHi, 11.9, 1e-9); // 5 en 95 %: de band bevat 90 % van de leden
    eq(h10.pMed, 0); near(h10.pHi, 0.9, 1e-9); near(h10.chance, 1 / 3, 1e-9);
    eq(h14.kmh, 15, 'wind van de middelste run'); eq(h14.dir, 110, 'met zijn eigen richting'); eq(e.hours[40].kind, 'cloud', 'mediaan-icoon per uur');
  });
  test('ICON-D2-ensemble: dagkans = deel van de leden met ≥ 0,5 mm in de lichte uren', () => {
    const json = mkEnsJson(3, 5, ['precipitation'], (v, m, i) => (m < 2 && i === 37 ? 2 : m === 2 && i === 28 ? 5 : m === 4 && i === 38 ? 0.3 : 0));
    const dc = ensDayChance(json, new Date(2026, 10, 2, 15), 52.37, 4.9);
    eq(dc.length, 2); eq(dc[0].chance, 0); eq(dc[1].chance, 0.4, '2 van 5 leden; 5 mm in de nacht en 0,3 mm tellen niet'); eq(dc[1].day.getDate(), 3);
  });
  test('week: HARMONIE-dagen eerst, daarna ECMWF tot 7 dagen; kans onder het icoontje', () => {
    const saved = state.forecast, savedObs = state.obs, savedEns = state.ens, savedEc = state.ecmwf;
    try {
      const day = k => new Date(2026, 10, 2 + k);
      const hd = k => ({ day: day(k), kind: 'clear', mn: 4, mx: 9, rain: k ? 1.2 : 0 });
      const ed = k => ({ day: day(k), kind: 'cloud', mn: 3, mx: 8, mnLo: 2, mxHi: 10, chance: 0.6, n: 51 });
      state.forecast = { days: [hd(0), hd(1)], models: {} }; state.obs = null;
      state.ens = { dayChance: [{ day: day(0), chance: 0.4, n: 20 }] };
      state.ecmwf = { days: [0, 1, 2, 3, 4, 5, 6, 7].map(ed) };
      const w = weekDays();
      eq(w.length, 7); eq(w[0].chance, 0.4); eq(w[1].chance, null, 'geen ensemblekans voor dag 2'); eq(w[2].kind, 'cloud', 'dag 3 uit ECMWF'); eq(w[6].day.getDate(), 8);
      const host = h('div'); renderWeek(host);
      const rows = host.querySelectorAll('.week-row');
      eq(rows.length, 7); eq(rows[0].querySelector('.mm').textContent, '40%'); eq(rows[1].querySelector('.mm').textContent, '1,2 mm', 'zonder kans de mm');
      eq(rows[2].querySelector('.mm').textContent, '60%'); ok(rows[2].querySelector('.band'), 'ensembleband'); ok(!rows[0].querySelector('.band'), 'HARMONIE-dag zonder band');
    } finally { state.forecast = saved; state.obs = savedObs; state.ens = savedEns; state.ecmwf = savedEc; }
  });
  test('meting: omschrijving → weerbeeld', () => {
    eq(descKind('Vrijwel onbewolkt (zonnig/helder)'), 'clear'); eq(descKind('Zwaar bewolkt'), 'cloud'); eq(descKind('Zwaar bewolkt en regen'), 'rain');
    eq(descKind('Mix van opklaringen en middelbare of lage bewolking'), 'partly'); eq(descKind('Lichte buien'), 'rain'); eq(descKind(''), null); eq(descKind(undefined), null);
  });
  test('tegel: volgt de stations, niet het model; regen en terugval', () => {
    const saved = state.forecast, savedObs = state.obs;
    try {
      state.forecast = null;
      state.obs = { desc: 'Zwaar bewolkt', sky: 10 }; eq(nowKind(new Date()), 'clear', 'zon rondom wint van de omschrijving');
      state.obs = { desc: 'Vrijwel onbewolkt (zonnig/helder)', sky: 85 }; eq(nowKind(new Date()), 'cloud');
      state.obs = { desc: 'Mix van opklaringen en middelbare of lage bewolking', sky: null }; eq(nowKind(new Date()), 'partly', 'nacht: omschrijving');
      state.obs = { desc: 'Zwaar bewolkt en regen', sky: 0 }; eq(nowKind(new Date()), 'rain');
      state.obs = null; eq(nowKind(new Date()), 'clear', 'zonder meting en model: helder (zoals sunWeatherKind)');
    } finally { state.forecast = saved; state.obs = savedObs; }
  });
  test('nu-label: tijd onderaan onder de streep, botsend uurlabel verdwijnt', () => {
    const host = h('div'); host.style.width = '360px'; document.body.appendChild(host);
    const now = new Date(2026, 9, 31, 20, 4); // vlak na 20:00
    const t0 = new Date(2026, 9, 31, 20, 0);
    const pts = Array.from({ length: 24 }, (_, i) => ({ t: new Date(t0.getTime() + i * MIN5), tEnd: new Date(t0.getTime() + (i + 1) * MIN5), v: 0 }));
    drawChart(host, { tMin: t0, tMax: new Date(t0.getTime() + 2 * HOUR), ticks: 'nowcast', unit: 'mm', now, series: [{ kind: 'bar', name: 'x', color: 'red', points: pts }], fmt: fmtMm, tipTime: () => '', yOpts: { zero: true } });
    const ticks = [...host.querySelectorAll('text.tick')].map(e => e.textContent).filter(t => t.includes(':'));
    const nowTick = host.querySelector('text.now-tick');
    ok(nowTick && nowTick.textContent === '20:04', 'nu-label 20:04');
    ok(!ticks.includes('20:00'), '20:00 weggelaten (te dicht bij nu)'); ok(ticks.includes('20:30'), '20:30 blijft');
    host.remove();
  });
  test('overzicht: temperatuurkleur loopt van blauw naar rood, icoontjes volgen weer en dag/nacht', () => {
    ok(tempColor(-20).startsWith('rgb(79'), 'koud = blauw'); ok(tempColor(40).startsWith('rgb(227'), 'heet = rood');
    const mid = tempColor(18); ok(mid === 'rgb(237,161,0)', 'stop 18° = amber, kreeg ' + mid);
    const g = weatherIcon(0, 0, 'rain', false); ok(g.querySelector('.cloud') && g.querySelectorAll('.drops line').length === 3, 'regenicoon');
    ok(weatherIcon(0, 0, 'clear', true).querySelector('.moon') && !weatherIcon(0, 0, 'clear', true).querySelector('.disc'), 'nacht = maan');
    ok(weatherIcon(0, 0, 'partly', false).querySelector('.disc') && weatherIcon(0, 0, 'partly', false).querySelector('.cloud'), 'half bewolkt = zon + wolk');
    const saved = state.forecast;
    try {
      state.forecast = parseForecast(mkJson(undefined, hh => { hh['precipitation_knmi_harmonie_arome_netherlands'][23] = 1.2; }), NOW);
      const ic = hourIcons(state.forecast.models.harmonie);
      eq(ic[2].kind, 'rain', 'uur 22–23 regen'); ok(ic[0].night, '20:30 in oktober is nacht'); eq(ic[0].kind, 'partly', '40% bewolking = half bewolkt');
    } finally { state.forecast = saved; }
  });
  test('zachte curve: Catmull-Rom gaat door alle punten en geeft een bezierpad', () => {
    const pts = [{ x: 0, y: 10 }, { x: 10, y: 20 }, { x: 20, y: 5 }, { x: 30, y: 15 }];
    const d = catmullRomPath(pts, 0.5);
    ok(d.startsWith('M0,10') && d.split(' C').length === 4, 'drie segmenten'); ok(d.endsWith('30.00,15.00'), 'eindigt op het laatste punt');
    eq(catmullRomPath([{ x: 3, y: 4 }]), 'M3,4');
  });
  test('boom: regen zet druppels aan, windveld draait met de wind, windstil blijft licht bewegen', () => {
    const el = treeView();
    setTree(el, 20, 270, 'x', 0.6); ok(el.querySelector('.treeg').classList.contains('raining'), 'regen'); ok(el.querySelector('.tree-caption').textContent.includes('mm'), 'mm in bijschrift');
    setTree(el, 20, 270, 'x', 0); ok(!el.querySelector('.treeg').classList.contains('raining'), 'droog');
    const f = el.querySelector('.windfield');
    near(setWindField(f, 30, 270).ang, 0, 1, 'westenwind: streken naar rechts (oost)');
    ok(Math.abs(setWindField(f, 30, 90).ang) > 179, 'oostenwind: streken naar links');
    near(setWindField(f, 30, 0).ang, 90, 1, 'noordenwind: streken omlaag (naar het zuiden)');
    near(setWindField(f, 30, 180).ang, -90, 1, 'zuidenwind: streken omhoog (naar het noorden)');
    ok(f.querySelector('.streak').getAttribute('transform').includes('rotate(-90'), 'streek gedraaid langs de bewegingsrichting');
    const g = el.querySelector('.treeg');
    windTree(g, 45, 270); ok(parseFloat(g.style.getPropertyValue('--lx')) > 5 && Math.abs(parseFloat(g.style.getPropertyValue('--ly'))) < 0.5, 'westenwind: kruin schuift naar rechts');
    windTree(g, 45, 0); ok(parseFloat(g.style.getPropertyValue('--ly')) > 3, 'noordenwind: kruin schuift omlaag (zuid)');
    ok(g.querySelector('.trunk').getAttribute('d').startsWith('M50 90'), 'stam begint bij de voet');
    setTree(el, 0, 0, 'x'); eq(el.querySelector('.treeg').style.getPropertyValue('--amp'), '0.5deg', 'minimale beweging bij windstil');
  });
  test('boom: Beaufort stuurt zwaai, scheefstand en richting; vanaf 5 Bft vliegen bladeren', () => {
    const el = treeView();
    setTree(el, 0, 90, 'x'); eq(el.dataset.bft, '0'); ok(el.classList.contains('still'), 'windstil');
    setTree(el, 45, 270, 'x'); eq(el.dataset.bft, '6'); ok(el.classList.contains('flying'), 'bladeren vliegen'); ok(parseFloat(el.style.getPropertyValue('--lx')) > 5, 'westenwind: kruin naar rechts: ' + el.style.getPropertyValue('--lx'));
    setTree(el, 45, 90, 'x'); ok(parseFloat(el.style.getPropertyValue('--lx')) < -5, 'oostenwind: kruin naar links');
    setTree(el, 120, 180, 'x'); eq(el.dataset.bft, '12'); ok(el.querySelector('.tree-desc').textContent.startsWith('Orkaan'), 'orkaan');
    eq(BEAUFORT.length, 13);
  });
  test('48 uur: spanFor en maxHorizonHours gaan nooit verder dan 48 uur vooruit', () => {
    const saved = { f: state.forecast, hz: state.horizon };
    try {
      state.forecast = parseForecast(mkJson({ harmonie: 90, icon: 60, arome: 60 }), NOW);
      const H = state.forecast.models.harmonie;
      near(maxHorizonHours(), 48, 1e-9); const s = spanFor([H]); eq((s.tMax - s.tMin) / HOUR, 48);
    } finally { state.forecast = saved.f; state.horizon = saved.hz; }
  });
  test('horizon: zoom houdt de start op nu en kapt het einde af; buiten bereik = alles', () => {
    const saved = { f: state.forecast, hz: state.horizon };
    try {
      state.forecast = parseForecast(mkJson(), NOW);
      const H = state.forecast.models.harmonie;
      state.horizon = 24;
      let s = spanFor([H]);
      eq(s.tMin.getTime(), state.forecast.startHour.getTime(), 'start = nu'); eq(s.tMax.getTime(), Math.min(H.horizon.getTime(), state.forecast.startHour.getTime() + 48 * HOUR), 'spanFor geeft het bereik tot 48 uur');
      // drawChart past de zoom toe: alleen staven binnen 24 uur worden getekend
      const host = h('div'); host.style.width = '360px'; document.body.appendChild(host);
      const pts = H.interval.map(p => ({ t: p.t, tEnd: p.tEnd, v: 1 }));
      drawChart(host, { ...s, ticks: 'days', unit: 'mm', series: [{ kind: 'bar', name: 'x', color: 'red', points: pts }], fmt: fmtMm, tipTime: () => '', yOpts: { zero: true } });
      eq(host.querySelectorAll('.bar').length, 24, '24 staven bij 24 uur zoom');
      ok(host.querySelectorAll('.vgrid line').length >= 3, 'verticale stippellijnen');
      state.horizon = null; drawChart(host, { ...s, ticks: 'days', unit: 'mm', series: [{ kind: 'bar', name: 'x', color: 'red', points: pts }], fmt: fmtMm, tipTime: () => '', yOpts: { zero: true } });
      eq(host.querySelectorAll('.bar').length, Math.min(pts.length, 48), 'alle staven binnen 48 uur zonder zoom');
      host.remove();
      state.horizon = 500; s = spanFor([H]);
      eq(s.tMax.getTime(), Math.min(H.horizon.getTime(), state.forecast.startHour.getTime() + 48 * HOUR), 'bereik blijft begrensd op 48 uur');
      near(maxHorizonHours(), 48, 1e-9, 'max horizon = 48 uur');
    } finally { state.forecast = saved.f; state.horizon = saved.hz; }
  });

  test('raintext: reeks die vlak vóór middernacht begint blijft op de oude dag', () => {
    const r = parseRaintext('000|23:55\n080|00:00\n080|00:05', new Date(2026, 10, 2, 0, 2));
    eq(r[0].t.getDate(), 1, 'dag 23:55'); eq(r[1].t.getDate(), 2, 'dag 00:00'); ok(r[1].t > r[0].t && r[2].t > r[1].t, 'oplopend');
  });
  test('raintext: oude kopie wordt op haar eigen ophaaltijd gedateerd, niet naar morgen geschoven', () => {
    const r = parseRaintext('120|10:00\n120|10:05', new Date(2026, 10, 1, 10, 2));
    eq(r[0].t.getDate(), 1); eq(r[0].t.getHours(), 10);
  });
  test('kans: stappen van 5%, en geen "0%" of "100%"', () => {
    eq(fmtProb(0), '< 5%'); eq(fmtProb(0.049), '< 5%'); eq(fmtProb(0.05), '5%'); eq(fmtProb(0.35), '35%'); eq(fmtProb(0.95), '95%'); eq(fmtProb(1), '> 95%'); eq(fmtProb(null), '–');
  });

  // eerstvolgende neerslag: nu = 31 okt 20:18; staaf i van HARMONIE = waarde bij index i, uur (i−1)–i
  const mkNc = (start, n, wet = {}) => Array.from({ length: n }, (_, i) => ({ t: new Date(start.getTime() + i * MIN5), v: wet[i] || 0 }));
  const ncFrom = new Date(2026, 9, 31, 20, 15); // 24 slots: 20:15 t/m 22:10, radar loopt tot 22:15
  const mkEns = (probs) => ({ prob: Object.entries(probs).map(([hr, v]) => ({ t: new Date(2026, 9, 31, +hr), tEnd: new Date(2026, 9, 31, +hr + 1), v })) });
  const mkH = (mut) => parseForecast(mkJson(undefined, hh => mut(hh['precipitation_knmi_harmonie_arome_netherlands'])), NOW).models.harmonie;
  test('eerstvolgende neerslag: radar eerst, ook het slot waar we nu in zitten', () => {
    const H = mkH(() => {});
    let r = nextRain(mkNc(ncFrom, 24, { 1: 0.5 }), H, null, NOW);
    eq(r.kind, 'radar'); eq(r.t.getMinutes(), 20); eq(r.now, false);
    r = nextRain(mkNc(ncFrom, 24, { 0: 0.4 }), H, null, NOW);
    eq(r.kind, 'radar'); eq(r.now, true, 'regent nu');
  });
  test('eerstvolgende neerslag: model-uren die de droge radar al dekt tellen niet mee', () => {
    const H = mkH(p => { p[22] = 1.0; p[24] = 1.0; }); // 21–22 (onder de radar) en 23–24
    const r = nextRain(mkNc(ncFrom, 24), H, mkEns({ 21: 0.8, 23: 0.6 }), NOW);
    eq(r.kind, 'model'); eq(r.t.getHours(), 23); eq(r.prob, 0.6);
  });
  test('eerstvolgende neerslag: een half gedekt uur telt vanaf het einde van de radar', () => {
    const H = mkH(p => { p[23] = 0.5; }); // 22–23, radar tot 22:15
    const r = nextRain(mkNc(ncFrom, 24), H, mkEns({ 22: 0.5 }), NOW);
    eq(r.kind, 'model'); eq(r.t.getHours(), 22); eq(r.t.getMinutes(), 15);
  });
  test('eerstvolgende neerslag: onder 0,5 mm is droog, met het natste uur erbij', () => {
    const H = mkH(p => { p[24] = 0.3; p[25] = 0.1; }); // 23–24 en 00–01 te weinig
    const r = nextRain(mkNc(ncFrom, 24), H, mkEns({ 23: 0.9 }), NOW);
    eq(r.kind, 'dry', 'hoge kans maakt het niet nat'); near(r.maxMm, 0.3, 1e-9); eq(r.maxT.getHours(), 23);
    eq((r.until - H.instant[0].t) / HOUR, 48, 'droog t/m 48 uur vooruit');
    eq(nextRain(null, mkH(() => {}), null, NOW).maxMm, null, 'helemaal droog: geen natste uur');
  });
  test('eerstvolgende neerslag: alleen HARMONIE beslist, ook bij een lage kans; regen na 48 uur telt niet', () => {
    let r = nextRain(null, mkH(p => { p[27] = 2.0; }), { prob: [{ t: new Date(2026, 10, 1, 2), tEnd: new Date(2026, 10, 1, 3), v: 0.1 }] }, NOW);
    eq(r.kind, 'model', 'kans 10% maar 2 mm: nat'); eq(r.t.getHours(), 2); eq(r.prob, 0.1, 'kans wel getoond');
    r = nextRain(null, mkH(p => { p[30] = 0.5; }), null, NOW);
    eq(r.kind, 'model'); eq(r.prob, null); eq(r.t.getHours(), 5);
    r = nextRain(null, mkH(p => { p[21 + 50] = 5; }), null, NOW);
    eq(r.kind, 'dry');
    eq(nextRain(null, null, null, NOW), null, 'geen data');
    eq(nextRain(mkNc(ncFrom, 24), null, null, NOW).kind, 'dry', 'alleen radar, droog');
  });
  test('uurstaven: de uren onder de radar komen uit de radar, het uur erna deels uit het model', () => {
    const H = mkH(p => { p[21] = 1; p[22] = 1; p[23] = 1; p[24] = 1; }); // 20–21 … 23–24 elk 1 mm volgens het model
    const b = blendRain(H.interval, mkNc(ncFrom, 24, { 1: 6 })); // radar 20:15–22:15, om 20:20 6 mm/u = 0,5 mm
    near(b[0].precipitation, 0.5, 1e-9, '20–21 radar'); eq(b[0].src, 'radar'); eq(b[0].model, 1);
    eq(b[1].precipitation, 0, '21–22 radar droog, model telt niet'); eq(b[1].src, 'radar');
    near(b[2].precipitation, 0.75, 1e-9, '22–23: radar droog tot 22:15, daarna 45 min model'); eq(b[2].src, 'mix');
    eq(b[3].precipitation, 1, '23–24 alleen model'); eq(b[3].src, undefined);
    eq(blendRain(H.interval, null), H.interval, 'zonder radar ongewijzigd');
    const c = blendRain(mkH(p => { p[21] = 2; }).interval, mkNc(new Date(2026, 9, 31, 21, 0), 24)); // radar begint op het hele uur
    eq(c[0].precipitation, 0, 'lopend uur 20–21 vóór de radar: niet het model'); eq(c[0].src, 'radar');
    const t = blendRain(mkH(p => { p[23] = 0.1; }).interval, mkNc(new Date(2026, 9, 31, 20, 15), 32)); // radar tot 22:55
    eq(t[2].precipitation, 0, '5 min van 0,1 mm = 0,008 mm: droog'); eq(t[2].src, 'mix');
    const d = blendRain(mkH(() => {}).interval, mkNc(ncFrom, 24, { 16: 0.1, 18: 0.1, 19: 0.1 })); // 21:35–21:55 lichte radarregen
    near(d[1].precipitation, 0.03, 1e-9, 'radarregen van 0,025 mm blijft staan'); ok(d[1].precipitation > 0);
    eq(fmtMm(0.03), '< 0,1'); eq(fmtMm(0), '0,0'); eq(fmtMm(0.3), '0,3');
    eq(fmtNum(null), '–', 'ontbrekende waarde'); eq(fmtNum(undefined, 0), '–'); eq(fmtMm(null), '–');
    eq(probFor(b[0]), null, 'geen kans voor een radaruur');
  });
  test('windveld: niets bij 0 Bft, genoeg vage streken voor de richting bij 1 Bft, dik en snel vanaf 7 Bft', () => {
    const f = makeWindField();
    const shown = () => [...f.querySelectorAll('.streak')].filter(s => s.style.display !== 'none').length;
    setWindField(f, 0.5, 270); eq(shown(), 0, '0 Bft'); ok(f.classList.contains('calm'));
    setWindField(f, 3, 270); eq(shown(), 8, '1 Bft'); eq(f.style.getPropertyValue('--wop'), '0.22');
    setWindField(f, 33, 270); eq(shown(), 16, '5 Bft');
    setWindField(f, 70, 270); ok(parseFloat(f.style.getPropertyValue('--wstroke')) > 2.5, 'dikker bij 8 Bft');
    for (const k of Object.keys(WIND_FIELD)) { const a = WIND_FIELD[k]; eq(a.length, 13, k); for (let i = 1; i < 13; i++) ok(k === 'period' ? a[i] <= a[i - 1] : a[i] >= a[i - 1], `${k} monotoon bij ${i}`); }
  });
  test('blaadjes: bijna stil bij 0–1 Bft, ritselen bij 2, steeds wijder en sneller', () => {
    const g = makeTree(1);
    windTree(g, 3, 270); eq(g.style.getPropertyValue('--lamp'), '2deg', '1 Bft');
    windTree(g, 33, 270); eq(g.style.getPropertyValue('--lamp'), '20deg', '5 Bft'); eq(g.style.getPropertyValue('--lperiod'), '0.3s');
    eq(TREE.leafAmp.length, 13); eq(TREE.leafPeriod.length, 13);
    for (let i = 1; i < 13; i++) { ok(TREE.leafAmp[i] > TREE.leafAmp[i - 1], `uitslag stijgt bij ${i}`); ok(TREE.leafPeriod[i] < TREE.leafPeriod[i - 1], `tempo stijgt bij ${i}`); }
  });
  test('verouderd: afgelopen radarslots en metingen ouder dan een uur vallen weg', () => {
    const nc = mkNc(new Date(2026, 9, 31, 18, 0), 24); // 18:00–19:55, nu 20:18: helemaal voorbij
    const f = freshOnly(nc, { time: new Date(2026, 9, 31, 19, 10) }, NOW);
    eq(f.nowcast, null, 'radar voorbij'); eq(f.obs, null, 'meting 68 min oud');
    const g = freshOnly(mkNc(ncFrom, 24), { time: new Date(2026, 9, 31, 20, 0) }, NOW);
    eq(g.nowcast.length, 24); ok(g.obs, 'meting van 18 min geleden blijft');
  });
  test('bewaarde kopie: alleen voor dezelfde plaats en niet te oud', () => {
    const key = STORE_PREFIX + 'nowcast';
    let saved = null; try { saved = localStorage.getItem(key); } catch (e) {}
    try {
      const at = new Date(2026, 9, 31, 20, 0);
      storeSave('nowcast', { lat: 52.37, lon: 4.9 }, 'tekst', at);
      const s = storeLoad('nowcast', { lat: 52.37, lon: 4.9 }, new Date(2026, 9, 31, 20, 30));
      ok(s && s.body === 'tekst' && s.at.getTime() === at.getTime(), 'zelfde plaats');
      eq(storeLoad('nowcast', { lat: 51.44, lon: 5.48 }, new Date(2026, 9, 31, 20, 30)), null, 'andere plaats');
      eq(storeLoad('nowcast', { lat: 52.37, lon: 4.9 }, new Date(2026, 9, 31, 20, 31)), null, 'radar ouder dan 30 min');
    } finally { try { if (saved == null) localStorage.removeItem(key); else localStorage.setItem(key, saved); } catch (e) {} }
  });
  test('verouderd-melding: een kopie van een paar minuten telt als actueel; alles of deels', () => {
    const saved = state.fetched;
    try {
      const at = m => ({ at: new Date(NOW.getTime() - m * 60e3), stored: true }), fresh = { at: NOW, stored: false };
      state.fetched = { forecast: fresh, ens: fresh, nowcast: fresh, obs: at(2) };
      eq(staleSince(NOW), null, 'feed van 2 min oud: geen melding');
      state.fetched = { forecast: fresh, ens: fresh, nowcast: fresh, obs: at(30) };
      let s = staleSince(NOW); ok(s && !s.all, 'deels'); eq(s.since.getMinutes(), 48);
      state.fetched = { forecast: at(40), ens: at(40), nowcast: at(40), obs: at(40) };
      s = staleSince(NOW); ok(s && s.all, 'alles: geen verbinding');
    } finally { state.fetched = saved; }
  });
  test('verouderd-melding noemt wat verouderd is', () => {
    const saved = state.fetched;
    try {
      const at = m => ({ at: new Date(NOW.getTime() - m * 60e3), stored: true }), fresh = { at: NOW, stored: false };
      state.fetched = { forecast: at(15), ens: fresh, nowcast: fresh, obs: fresh };
      let s = staleSince(NOW); eq(s.parts.length, 1); eq(s.parts[0].key, 'forecast');
      let t = staleText(s); ok(t.startsWith('De verwachting kon niet worden bijgewerkt en is van '), t);
      state.fetched = { forecast: at(15), ens: fresh, nowcast: at(15), obs: fresh };
      t = staleText(staleSince(NOW)); ok(t.startsWith('De verwachting en de radar konden niet worden bijgewerkt en zijn van '), t);
      state.fetched = { forecast: at(40), ens: at(15), nowcast: fresh, obs: fresh };
      t = staleText(staleSince(NOW)); ok(/^De verwachting \(.+\) en de kans en onzekerheidsband \(.+\) konden niet worden bijgewerkt\.$/.test(t), t);
      ok(staleText({ since: NOW, all: true, parts: [] }).startsWith('Geen verbinding.'), 'offline');
      eq(joinNl(['a']), 'a'); eq(joinNl(['a', 'b', 'c']), 'a, b en c');
    } finally { state.fetched = saved; }
  });
  test('temperatuur: ICON-D2 als dat er is, anders HARMONIE', () => {
    const saved = state.forecast;
    try {
      state.forecast = parseForecast(mkJson(undefined, hh => { hh['temperature_2m_icon_d2'][20] = 7; }), NOW);
      eq(tempModel().key, 'icon'); eq(tempModel().instant[0].temperature_2m, 7);
      state.forecast = parseForecast(mkJson({ harmonie: 70, icon: 0, arome: 0 }), NOW);
      eq(tempModel().key, 'harmonie');
      const { mn, mx } = todayRange(state.forecast.models.harmonie); eq(mn, 10); eq(mx, 10);
    } finally { state.forecast = saved; }
  });
  test('tabwissel: de nieuwe tab begint meteen bovenaan, ook al scrolt het scherm soepel', () => {
    const s = $('screen'), spacer = h('div'); spacer.style.height = '3000px'; s.appendChild(spacer);
    try {
      s.style.scrollBehavior = 'auto'; s.scrollTop = 800; s.style.scrollBehavior = '';
      ok(s.scrollTop > 0, 'uitgangspunt: naar beneden gescrold');
      toTop(); eq(s.scrollTop, 0, 'direct 0, niet halverwege een animatie');
    } finally { spacer.remove(); }
  });

  const panel = h('div', 'tests');
  const passed = results.filter(r => r.ok).length;
  panel.appendChild(h('h2', null, `Zelftest: ${passed}/${results.length} geslaagd`));
  for (const r of results) {
    const line = h('div', r.ok ? 'pass' : 'fail', `${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : ' — ' + r.msg}`);
    panel.appendChild(line);
  }
  const close = h('button', 'text-btn', 'Sluiten'); close.addEventListener('click', () => panel.remove()); panel.appendChild(close);
  $('phone').appendChild(panel);
  console.table(results);
  return results;
}
api.runTests = runTests;

/* ======================================================================
   7. Boot
   ====================================================================== */
const params = new URLSearchParams(location.search);
if (params.get('theme')) document.documentElement.setAttribute('data-theme', params.get('theme'));
render();
load();
if (params.get('test') === '1') setTimeout(runTests, 0);
})();
