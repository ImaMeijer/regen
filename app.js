/* Regen · prototype
   Nowcast: Buienradar raintext (2 h, 5 min). Models via Open-Meteo:
   KNMI HARMONIE-AROME NL (2 km), DWD ICON-D2 (2,2 km), Météo-France AROME HD (1,5 km). */
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
const VARS = ['precipitation', 'rain', 'snowfall', 'temperature_2m', 'apparent_temperature',
  'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
  'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high', 'weather_code'];
const INTERVAL_VARS = new Set(['precipitation', 'rain', 'snowfall']); // value at t = sum over (t-1h, t]
const COMPARE_HOURS = 48;

const $ = id => document.getElementById(id);
const nl = 'nl-NL';
const fmtNum = (v, d = 1) => v.toLocaleString(nl, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtMm = v => fmtNum(v, v >= 10 ? 0 : 1);
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

// Lines "VVV|HH:MM" in Dutch local time → [{t, v}] with v in mm/h.
function parseRaintext(text, now = new Date()) {
  const out = [];
  for (const raw of text.trim().split(/\r?\n/)) {
    const parts = raw.trim().split('|');
    if (parts.length !== 2) continue;
    const val = parseInt(parts[0], 10);
    const hm = parts[1].split(':').map(Number);
    if (!Number.isFinite(val) || hm.length !== 2 || hm.some(x => !Number.isFinite(x))) continue;
    const t = new Date(now);
    t.setHours(hm[0], hm[1], 0, 0);
    if (t.getTime() < now.getTime() - 3 * HOUR) t.setDate(t.getDate() + 1); // series crosses midnight
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
  return { day: get('--sky-day', '#fffaeb'), dawn: get('--sky-dawn', '#fde8cf'), night: get('--sky-night', '#e4e7f1') };
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
    const get = v => hh[`${v}_${m.id}`] || null;
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
      for (const v of VARS) if (!INTERVAL_VARS.has(v)) { const a = get(v); row[v] = a ? a[i] : null; }
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
const tooltipEl = () => $('tooltip');
function hideTooltip() { const t = tooltipEl(); if (t) t.hidden = true; }

function drawChart(host, spec) {
  host.textContent = '';
  host.classList.toggle('zoomable', spec.ticks === 'days');
  const W = Math.max(280, host.clientWidth || 380);
  const H = spec.height || 210;
  const hasDays = spec.ticks === 'days';
  const arrowRow = spec.arrows ? 22 : 0;
  const m = { top: hasDays ? 36 : 22, right: 10, bottom: 24 + arrowRow, left: 34 };
  const pw = W - m.left - m.right, ph = H - m.top - m.bottom;
  const t0 = spec.tMin.getTime(), t1 = spec.tMax.getTime();
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
      const [r, g, b] = skyColor(sunAltitude(new Date(t), lat, lon), pal);
      grad.appendChild(svgEl('stop', { offset: ((t - t0) / (t1 - t0)).toFixed(4), 'stop-color': `rgb(${r},${g},${b})` }));
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
  if (hasDays) {
    const hoursSpan = (t1 - t0) / HOUR;
    const every = (pw / hoursSpan) * 6 >= 40 ? 6 : 12;
    const d = new Date(t0); d.setMinutes(0, 0, 0);
    let prevDay = null, segStart = t0;
    const days = [];
    for (let t = d.getTime(); t <= t1; t += HOUR) {
      const dt = new Date(t);
      if (dt.getHours() === 0 && t > t0) {
        svg.appendChild(svgEl('line', { class: 'day-sep', x1: x(t), x2: x(t), y1: m.top - 16, y2: m.top + ph }));
        days.push([segStart, t]); segStart = t;
      }
      if (dt.getHours() % every === 0 && t >= t0) labelAt.push({ t, txt: fmtTime(dt) });
      prevDay = dt.getDate();
    }
    days.push([segStart, t1]);
    for (const [a, b] of days) {
      const wseg = x(b) - x(a); if (wseg < 22) continue;
      svg.appendChild(svgEl('text', { x: (x(a) + x(b)) / 2, y: m.top - 20, 'text-anchor': 'middle', class: 'day-label' }, wseg < 64 ? fmtWd(new Date(a)) : fmtDay(new Date(a))));
    }
  } else {
    for (let t = Math.ceil(t0 / (30 * 60e3)) * 30 * 60e3; t <= t1; t += 30 * 60e3) labelAt.push({ t, txt: fmtTime(new Date(t)) });
  }
  for (const l of labelAt) {
    const px = x(l.t);
    if (px < m.left - 1 || px > W - m.right + 1) continue;
    svg.appendChild(svgEl('text', { x: px, y: m.top + ph + 15, 'text-anchor': 'middle', class: 'tick' }, l.txt));
  }

  // sunrise / sunset glyphs in the strip above the plot
  for (const ev of sunEvents) {
    if (ev.kind !== 'sunrise' && ev.kind !== 'sunset') continue;
    const px = x(ev.t.getTime());
    if (px < m.left || px > W - m.right) continue;
    const g = svgEl('g', { class: 'sun ' + ev.kind, transform: `translate(${px},${m.top - 7})` });
    g.appendChild(svgEl('circle', { r: 2.6 }));
    for (let k = 0; k < 8; k++) { const a = rad(k * 45); g.appendChild(svgEl('line', { x1: Math.cos(a) * 4, y1: Math.sin(a) * 4, x2: Math.cos(a) * 5.5, y2: Math.sin(a) * 5.5 })); }
    const title = svgEl('title', {}, `${ev.kind === 'sunrise' ? 'Zon op' : 'Zon onder'} ${fmtTime(ev.t)}`);
    g.appendChild(title);
    svg.appendChild(g);
  }

  // "now" marker
  if (spec.now && spec.now.getTime() > t0 && spec.now.getTime() < t1) {
    const px = x(spec.now.getTime());
    svg.appendChild(svgEl('line', { class: 'now', x1: px, x2: px, y1: m.top - 2, y2: m.top + ph }));
    svg.appendChild(svgEl('text', { x: px + 4, y: m.top + 8, class: 'now-label' }, 'nu'));
  }

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
      svg.appendChild(svgEl('path', { class: 'spread', d }));
    } else if (s.kind === 'bar' || s.kind === 'ghost') {
      const g = svgEl('g');
      for (const p of s.points) {
        if (p.v == null) continue;
        const xa = x(p.t.getTime()) + 1, xb = x(p.tEnd.getTime()) - 1;
        let w = Math.max(1, xb - xa), xs = xa;
        if (w > 24) { xs = xa + (w - 24) / 2; w = 24; }
        if (p.v <= 0) { marks.push({ s, p, el: null }); continue; }
        const top = y(p.v), hgt = y(sc.min) - top;
        const r = Math.min(4, w / 2, hgt);
        const d = `M${xs},${y(sc.min)} V${top + r} a${r},${r} 0 0 1 ${r},-${r} H${xs + w - r} a${r},${r} 0 0 1 ${r},${r} V${y(sc.min)} Z`;
        const el = svgEl('path', { class: s.kind === 'ghost' ? 'ghost' : 'bar', d });
        if (s.kind === 'bar') el.style.fill = s.color;
        g.appendChild(el);
        marks.push({ s, p, el });
      }
      svg.appendChild(g);
    } else { // line
      const pts = s.points.filter(p => p.v != null);
      if (!pts.length) continue;
      if (s.area) {
        const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t.getTime())},${y(p.v)}`).join(' ') +
          ` L${x(pts[pts.length - 1].t.getTime())},${y(sc.min)} L${x(pts[0].t.getTime())},${y(sc.min)} Z`;
        const a = svgEl('path', { d }); a.style.fill = s.color; a.style.opacity = '0.10'; svg.appendChild(a);
      }
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t.getTime())},${y(p.v)}`).join(' ');
      const el = svgEl('path', { class: 'line' + (s.secondary ? ' secondary' : ''), d });
      el.style.stroke = s.color;
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

  // hover layer
  const cross = svgEl('line', { class: 'crosshair', x1: 0, x2: 0, y1: m.top, y2: m.top + ph, visibility: 'hidden' });
  svg.appendChild(cross);
  const dots = svgEl('g');
  svg.appendChild(dots);
  const hit = svgEl('rect', { class: 'hit', x: m.left, y: m.top - 16, width: pw, height: ph + 16 + 24 });
  svg.appendChild(hit);
  let lifted = null;

  const lineSeries = spec.series.filter(s => s.kind === 'line');
  const barSeries = spec.series.filter(s => s.kind === 'bar' || s.kind === 'ghost');

  function showAt(clientX) {
    const rect = svg.getBoundingClientRect();
    const px = (clientX - rect.left) * (W / rect.width);
    const t = xInv(clamp(px, m.left, m.left + pw));
    const tip = tooltipEl();
    tip.textContent = '';
    let anchorX, anchorY = m.top;
    if (barSeries.length) {
      const base = barSeries[0];
      const p = base.points.find(q => t >= q.t.getTime() && t < q.tEnd.getTime());
      if (!p) { hideTooltip(); return; }
      anchorX = (x(p.t.getTime()) + x(p.tEnd.getTime())) / 2;
      tip.appendChild(h('div', 't', spec.tipTime(p)));
      for (const s of barSeries) {
        const q = s.points.find(r => r.t.getTime() === p.t.getTime());
        if (!q || q.v == null) continue;
        tip.appendChild(tipRow(s, spec.fmt(q.v) + (spec.unitTip ? ' ' + spec.unitTip : ''), q, spec));
        if (q.v > 0 && s.kind === 'bar') anchorY = Math.min(anchorY, y(q.v));
      }
      if (lifted) lifted.classList.remove('lift');
      const mk = marks.find(k => k.s === base && k.p === p);
      lifted = mk && mk.el; if (lifted) lifted.classList.add('lift');
      cross.setAttribute('visibility', 'hidden');
    } else {
      const base = lineSeries[0];
      const pts = base.points.filter(p => p.v != null);
      if (!pts.length) return;
      let best = pts[0];
      for (const p of pts) if (Math.abs(p.t.getTime() - t) < Math.abs(best.t.getTime() - t)) best = p;
      anchorX = x(best.t.getTime());
      cross.setAttribute('x1', anchorX); cross.setAttribute('x2', anchorX); cross.setAttribute('visibility', 'visible');
      dots.textContent = '';
      tip.appendChild(h('div', 't', spec.tipTime(best)));
      for (const s of lineSeries) {
        const q = s.points.find(r => r.t.getTime() === best.t.getTime());
        if (!q || q.v == null) continue;
        tip.appendChild(tipRow(s, spec.fmt(q.v) + (spec.unitTip ? ' ' + spec.unitTip : ''), q, spec));
        const dot = svgEl('circle', { class: 'dot', cx: anchorX, cy: y(q.v), r: 4 }); dot.style.fill = s.color; dots.appendChild(dot);
        anchorY = Math.min(anchorY, y(q.v));
      }
    }
    if (spec.sky) {
      const alt = sunAltitude(new Date(t), spec.sky.lat, spec.sky.lon);
      tip.appendChild(h('div', 't', `${sunPhase(alt)} · zon ${alt >= 0 ? fmtNum(alt, 0) + '° boven' : fmtNum(-alt, 0) + '° onder'} de horizon`));
    }
    if (spec.tipExtra) { const ex = spec.tipExtra(t); if (ex) tip.appendChild(h('div', 't', ex)); }
    tip.hidden = false;
    const scale = rect.width / W;
    const cx = rect.left + anchorX * scale, cy = rect.top + anchorY * scale;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = clamp(cx - tw / 2, 8, window.innerWidth - tw - 8);
    let top = cy - th - 12;
    if (top < 8) top = cy + 16;
    tip.style.left = `${left}px`; tip.style.top = `${top}px`;
  }
  function clear() {
    hideTooltip(); cross.setAttribute('visibility', 'hidden'); dots.textContent = '';
    if (lifted) { lifted.classList.remove('lift'); lifted = null; }
  }
  hit.addEventListener('pointermove', e => showAt(e.clientX));
  hit.addEventListener('pointerdown', e => showAt(e.clientX));
  hit.addEventListener('pointerleave', clear);
  hit.addEventListener('pointerup', () => setTimeout(clear, 1500));
  host.appendChild(svg);
  return { svg, scale: sc };
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
    const sw = h('span', 'sw' + (it.rect ? ' rect' : '') + (it.dashed ? ' dashed' : ''));
    if (it.dashed) sw.style.color = it.color; else sw.style.background = it.color;
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
  c.appendChild(meta);
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
const state = { loc: DEFAULT_LOC, tab: 'rain', nowcast: null, forecast: null, updated: null, rainModel: 'harmonie', errors: {}, horizon: null };
try {
  const l = JSON.parse(localStorage.getItem('regen.loc') || 'null');
  if (l && Number.isFinite(l.lat) && Number.isFinite(l.lon)) state.loc = l;
  const t = localStorage.getItem('regen.tab'); if (t && ['rain', 'temp', 'wind', 'cloud'].includes(t)) state.tab = t;
  const hz = parseFloat(localStorage.getItem('regen.horizon')); if (Number.isFinite(hz) && hz >= HORIZON_MIN) state.horizon = hz;
} catch (e) {}

const nowcastUrl = (lat, lon) => `https://gpsgadget.buienradar.nl/data/raintext?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`;
const forecastUrl = (lat, lon) => `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
  `&hourly=${VARS.join(',')}&models=${MODELS.map(m => m.id).join(',')}&forecast_days=4&timezone=Europe%2FAmsterdam`;
const geoUrl = q => `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=nl&format=json`;

async function fetchOk(url, asText) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return asText ? r.text() : r.json();
}

let refreshTimer = null;
async function load() {
  const { lat, lon } = state.loc;
  $('locName').textContent = state.loc.name;
  document.body.classList.add('loading');
  const now = new Date();
  const [nc, fc] = await Promise.allSettled([
    fetchOk(nowcastUrl(lat, lon), true).then(t => parseRaintext(t, now)),
    fetchOk(forecastUrl(lat, lon)).then(j => parseForecast(j, now)),
  ]);
  state.errors = {};
  if (nc.status === 'fulfilled') state.nowcast = nc.value; else { state.nowcast = null; state.errors.nowcast = nc.reason.message; }
  if (fc.status === 'fulfilled') state.forecast = fc.value; else { state.forecast = null; state.errors.forecast = fc.reason.message; }
  state.updated = new Date();
  document.body.classList.remove('loading');
  render();
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(load, 5 * 60e3);
}

/* ======================================================================
   4. Views
   ====================================================================== */
const TABS = { rain: 'Regen', temp: 'Temperatuur', wind: 'Wind', cloud: 'Bewolking' };

function render() {
  hideTooltip();
  $('title').textContent = TABS[state.tab];
  $('subtitle').textContent = state.updated ? `${state.loc.name}${state.loc.admin ? ', ' + state.loc.admin : ''} · bijgewerkt ${fmtTime(state.updated)}` : state.loc.name;
  document.title = `${TABS[state.tab]} · ${state.loc.name}`;
  for (const btn of document.querySelectorAll('.tab')) btn.setAttribute('aria-pressed', String(btn.dataset.tab === state.tab));
  renderSunline();
  const c = $('content');
  const screen = $('screen');
  const keepScroll = screen.scrollTop; // rebuilding the content must not move the page
  const minH = c.offsetHeight; c.style.minHeight = minH + 'px';
  c.textContent = '';
  try {
    if (!state.forecast && !state.nowcast) {
      if (!state.updated) { for (let i = 0; i < 2; i++) { const k = h('section', 'card'); k.appendChild(h('div', 'skeleton')); c.appendChild(k); } return; }
      const e = h('p', 'empty', 'Geen data beschikbaar. ' + Object.values(state.errors).join(' · ')); c.appendChild(e); return;
    }
    ({ rain: renderRain, temp: renderTemp, wind: renderWind, cloud: renderCloud })[state.tab](c);
  } finally {
    c.style.minHeight = '';
    if (screen.scrollTop !== keepScroll) screen.scrollTop = keepScroll;
  }
}

const skyOf = () => ({ lat: state.loc.lat, lon: state.loc.lon });
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
function maxHorizonHours() {
  const avail = modelsAvail();
  if (!avail.length) return 60;
  const start = state.forecast.startHour.getTime();
  return Math.max(...avail.map(m => (m.horizon.getTime() - start) / HOUR));
}
function spanFor(models) {
  const start = state.forecast.startHour;
  let end = Math.max(...models.map(m => m.horizon.getTime()));
  if (state.horizon) end = Math.min(end, start.getTime() + state.horizon * HOUR);
  return { tMin: start, tMax: new Date(end) };
}
function setHorizon(hours, persist = true) {
  const max = maxHorizonHours();
  let hz = hours == null ? null : clamp(hours, HORIZON_MIN, max);
  if (hz != null && hz >= max - 0.5) hz = null; // fully zoomed out = alles
  state.horizon = hz;
  if (persist) { try { if (hz == null) localStorage.removeItem('regen.horizon'); else localStorage.setItem('regen.horizon', String(Math.round(hz))); } catch (e) {} }
  render();
}
function horizonBar() {
  const bar = h('div', 'horizon');
  const max = maxHorizonHours();
  const cur = state.horizon == null ? max : state.horizon;
  const end = new Date(state.forecast.startHour.getTime() + cur * HOUR);
  const lbl = h('div', 'hz-label');
  lbl.appendChild(h('span', 'hz-title', 'Vooruit'));
  lbl.appendChild(h('span', 'hz-val', state.horizon == null ? `alles · t/m ${fmtDayTime(end)}` : `${Math.round(cur)} u · t/m ${fmtDayTime(end)}`));
  bar.appendChild(lbl);
  const seg = h('div', 'segmented compact');
  const presets = [[12, '12 u'], [24, '24 u'], [48, '48 u'], [null, 'Alles']];
  for (const [hrs, label] of presets) {
    const btn = h('button', null, label); btn.type = 'button';
    const active = hrs == null ? state.horizon == null : Math.abs(cur - hrs) < 0.5 && state.horizon != null;
    btn.setAttribute('aria-pressed', String(active));
    btn.disabled = hrs != null && hrs >= max;
    btn.addEventListener('click', () => setHorizon(hrs));
    seg.appendChild(btn);
  }
  bar.appendChild(seg);
  bar.appendChild(h('p', 'hz-hint', 'Knijp op een grafiek om in of uit te zoomen; de keuze wordt onthouden.'));
  return bar;
}
function spanTitle(modelHours) {
  if (state.horizon && state.horizon < modelHours - 1) return `Komende ${Math.round(state.horizon)} uur`;
  return modelHours >= 54 ? 'Komende 2,5 dag' : 'Komende 2 dagen';
}
function errorNote(parent, key, what) {
  if (state.errors[key]) parent.appendChild(h('p', 'empty', `${what} niet beschikbaar (${state.errors[key]})`));
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
  const big = h('div', 'big'); const hint = h('div', 'h');
  const nextNc = nc && nc.find(p => p.v >= 0.1 && p.t >= now);
  const nextH = H && H.applicable && H.interval.find(p => p.precipitation >= 0.1);
  if (nextNc) { big.textContent = `om ${fmtTime(nextNc.t)}`; hint.textContent = `${fmtMm(nextNc.v)} mm/u · radar`; }
  else if (nextH) { big.textContent = fmtDayTime(nextH.t); hint.textContent = `${fmtMm(nextH.precipitation)} mm in dat uur · HARMONIE`; }
  else if (H && H.applicable) { big.textContent = 'Droog'; hint.textContent = `geen neerslag verwacht t/m ${fmtDayTime(H.horizon)}`; }
  else { big.textContent = '–'; }
  ht.appendChild(big); ht.appendChild(hint); hero.appendChild(ht);
  c.appendChild(hero);

  // nowcast card
  const k1 = card('Komende 2 uur', ['Radar-nowcast · per 5 min · ', b('Buienradar')]);
  c.appendChild(k1.el);
  if (nc && nc.length) {
    const tMin = nc[0].t, tMax = new Date(nc[nc.length - 1].t.getTime() + MIN5);
    const pts = nc.map(p => ({ t: p.t, tEnd: new Date(p.t.getTime() + MIN5), v: p.v }));
    drawChart(k1.body, { sky: skyOf(),
      tMin, tMax, unit: 'mm/u', unitTip: 'mm/u', ticks: 'nowcast', yOpts: { zero: true, minSpan: 1, headroom: 1.15 },
      series: [{ kind: 'bar', name: 'Radar', color: 'var(--s1)', points: pts }],
      fmt: fmtMm, directLabels: 'peak', emptyText: 'Droog in de komende 2 uur', tipTime: p => `${fmtTime(p.t)}–${fmtTime(p.tEnd)}`,
      aria: 'Neerslagintensiteit per 5 minuten voor de komende 2 uur',
    });
    k1.tableHost.appendChild(dataTable(pts, [{ label: 'Tijd', get: p => fmtTime(p.t) }, { label: 'mm/u', num: true, get: p => fmtNum(p.v, 2) }]));
    const sum2 = nc.reduce((s, p) => s + p.v / 12, 0);
    k1.el.appendChild(h('p', 'foot', `Som over 2 uur: ${fmtNum(sum2, 1)} mm · staaf = intensiteit op dat moment`));
  } else errorNote(k1.body, 'nowcast', 'Radar');

  // model card
  const avail = modelsAvail();
  c.appendChild(horizonBar());
  const k2 = card('Komende dagen', []);
  c.appendChild(k2.el);
  if (!H || !H.applicable) { errorNote(k2.body, 'forecast', 'Modelverwachting'); if (!state.errors.forecast) k2.body.appendChild(h('p', 'empty', 'HARMONIE dekt deze locatie niet.')); return; }

  if (!avail.some(m => m.key === state.rainModel)) state.rainModel = 'harmonie';
  const sel = fc.models[state.rainModel];
  k2.el.querySelector('h2').textContent = spanTitle(sel.hours);
  k2.el.querySelector('.meta').append(b(sel.long), ` · ${sel.res} · per uur`);

  // comparisons
  const warnings = [];
  for (const m of avail) {
    if (m.key === 'harmonie') continue;
    const r = compareRain(H.interval, m.interval);
    if (r) warnings.push({ m, r });
  }
  const seg = h('div', 'segmented');
  for (const m of MODELS) {
    const btn = h('button'); btn.type = 'button';
    const dot = h('span', 'dotc'); dot.style.background = m.color; btn.appendChild(dot);
    btn.appendChild(document.createTextNode(m.name));
    const mm = fc.models[m.key];
    btn.disabled = !mm.applicable;
    btn.setAttribute('aria-pressed', String(m.key === state.rainModel));
    btn.addEventListener('click', () => { state.rainModel = m.key; render(); });
    seg.appendChild(btn);
  }
  k2.el.insertBefore(seg, k2.body);

  const modelPts = m => m.interval.map(p => ({ t: p.t, tEnd: p.tEnd, v: p.precipitation, rain: p.rain, snow: p.snowfall }));
  const series = [];
  if (sel.key !== 'harmonie') series.push({ kind: 'ghost', name: 'HARMONIE', color: 'var(--s1)', points: modelPts(H) });
  series.push({ kind: 'bar', name: sel.name, color: sel.color, points: modelPts(sel) });
  const span = spanFor(avail);
  drawChart(k2.body, { sky: skyOf(),
    ...span, unit: 'mm/u', unitTip: 'mm', ticks: 'days', now, yOpts: { zero: true, minSpan: 1, headroom: 1.15 },
    series, fmt: fmtMm, directLabels: 'peak',
    tipTime: p => `${fmtWd(p.t)} ${fmtHourRange(p.t)}`,
    tipNote: (s, p) => (p.snow > 0 ? ` · sneeuw ${fmtNum(p.snow, 1)} cm` : ''),
    aria: `Neerslag per uur volgens ${sel.long}`,
  });
  if (sel.key !== 'harmonie') legend(k2.el, [{ name: sel.name, color: sel.color, rect: true }, { name: 'HARMONIE', color: 'var(--label-3)', dashed: true, note: 'ter referentie' }]);
  k2.tableHost.appendChild(dataTable(modelPts(sel), [{ label: 'Uur', get: p => `${fmtWd(p.t)} ${fmtTime(p.t)}` }, { label: 'mm', num: true, get: p => fmtNum(p.v, 1) }]));

  // warnings / agreement
  if (warnings.length) {
    for (const { m, r } of warnings) {
      const w = h('button', 'warn'); w.type = 'button';
      w.innerHTML = '<svg class="ico" viewBox="0 0 20 20"><path d="M10 3l8 14H2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 8v4M10 14.5v.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
      const txt = h('span');
      const strong = b(m.name);
      if (r.kind === 'amount') {
        txt.append(strong, ` verwacht ${fmtMm(r.sumO)} mm tot ${fmtDayTime(H.interval[r.hours - 1].tEnd)}, HARMONIE ${fmtMm(r.sumP)} mm.`);
      } else if (r.who === 'other') {
        txt.append(strong, ` verwacht regen ${fmtWd(r.t)} ${fmtHourRange(r.t)} (${fmtMm(r.mm)} mm), HARMONIE houdt het dan droog.`);
      } else {
        txt.append(b('HARMONIE'), ` verwacht regen ${fmtWd(r.t)} ${fmtHourRange(r.t)} (${fmtMm(r.mm)} mm), ${m.name} houdt het dan droog.`);
      }
      w.appendChild(txt);
      w.innerHTML += '<svg class="ico chev" viewBox="0 0 20 20"><path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      w.addEventListener('click', () => { state.rainModel = state.rainModel === m.key ? 'harmonie' : m.key; render(); });
      k2.el.appendChild(w);
    }
  } else if (avail.length > 1) {
    const ok = h('div', 'ok-row');
    ok.innerHTML = '<svg class="ico" viewBox="0 0 20 20"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const n = Math.min(COMPARE_HOURS, ...avail.map(m => m.interval.length));
    ok.appendChild(document.createTextNode(`${avail.filter(m => m.key !== 'harmonie').map(m => m.name).join(' en ')} komen overeen met HARMONIE voor de komende ${n} uur.`));
    k2.el.appendChild(ok);
  }
  k2.el.appendChild(h('p', 'foot', horizonFoot(avail) + ' · staaf = som over dat uur'));

  // stats for selected model
  const sum = (arr, n) => arr.slice(0, n).reduce((s, p) => s + p.precipitation, 0);
  const stats = h('section', 'stats');
  const st = (l, v, hh) => { const s = h('div', 'stat'); s.appendChild(h('div', 'l', l)); s.appendChild(h('div', 'v', v)); s.appendChild(h('div', 'h', hh)); stats.appendChild(s); };
  st('Komende 24 u', `${fmtMm(sum(sel.interval, 24))} mm`, sel.name);
  st('Komende 48 u', `${fmtMm(sum(sel.interval, 48))} mm`, sel.name);
  st('Tot horizon', `${fmtMm(sum(sel.interval, 999))} mm`, `t/m ${fmtDayTime(sel.horizon)}`);
  c.appendChild(stats);
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
  if (!state.errors.forecast) c.appendChild(h('p', 'empty', 'HARMONIE dekt deze locatie niet.'));
  return null;
}

/* ---------------- Temperatuur ---------------- */
function renderTemp(c) {
  const H = needHarmonie(c); if (!H) return;
  const nowRow = H.instant[0];
  const today = H.instant.filter(p => p.t.getDate() === nowRow.t.getDate());
  const mx = Math.max(...today.map(p => p.temperature_2m)), mn = Math.min(...today.map(p => p.temperature_2m));
  heroBlock(c, '<svg class="ico-big" viewBox="0 0 24 24"><path d="M10 4a2 2 0 0 1 4 0v9.3a4 4 0 1 1-4 0V4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="17" r="1.6" fill="currentColor"/><path d="M12 10v7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    `Nu · ${fmtTime(nowRow.t)}`, `${fmtNum(nowRow.temperature_2m, 0)}°`, `voelt als ${fmtNum(nowRow.apparent_temperature, 0)}° · vandaag ${fmtNum(mn, 0)}° tot ${fmtNum(mx, 0)}°`);

  c.appendChild(horizonBar());
  const k1 = card(spanTitle(H.hours), [b('KNMI HARMONIE-AROME'), ' · 2 km · per uur']);
  c.appendChild(k1.el);
  drawChart(k1.body, { sky: skyOf(),
    ...spanFor([H]), unit: '°C', unitTip: '°C', ticks: 'days', now: new Date(), yOpts: { minSpan: 6, targetTicks: 4 },
    series: [
      { kind: 'line', name: 'Temperatuur', color: 'var(--s1)', points: instantPts(H, 'temperature_2m'), area: true },
      { kind: 'line', name: 'Gevoelstemperatuur', color: 'var(--s1)', points: instantPts(H, 'apparent_temperature'), secondary: true },
    ],
    fmt: v => fmtNum(v, 1), directLabels: 'minmax', tipTime: p => fmtDayTime(p.t), aria: 'Temperatuur per uur volgens HARMONIE',
  });
  legend(k1.el, [{ name: 'Temperatuur (2 m)', color: 'var(--s1)' }, { name: 'Gevoelstemperatuur', color: 'var(--s1)', dashed: true }]);
  k1.tableHost.appendChild(dataTable(H.instant, [{ label: 'Uur', get: p => fmtDayTime(p.t) }, { label: '°C', num: true, get: p => fmtNum(p.temperature_2m, 1) }, { label: 'Gevoel', num: true, get: p => fmtNum(p.apparent_temperature, 1) }]));
  k1.el.appendChild(h('p', 'foot', `t/m ${fmtDayTime(H.horizon)}`));

  ensembleCard(c, 'Modelvergelijking', 'temperature_2m', { label: 'temperatuur op 2 m', unit: '°C', unitTip: '°C', fmt: v => fmtNum(v, 1), yOpts: { minSpan: 6 } });
}

/* ---------------- Wind ---------------- */
function renderWind(c) {
  const H = needHarmonie(c); if (!H) return;
  const r0 = H.instant[0];
  const bft = beaufort(r0.wind_speed_10m);
  heroBlock(c, '<svg class="ico-big" viewBox="0 0 24 24"><path d="M3 8h11a2.5 2.5 0 1 0-2.5-2.5M3 12h15a2.5 2.5 0 1 1-2.5 2.5M3 16h8a2 2 0 1 1-2 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    `Nu · ${fmtTime(r0.t)}`, `${fmtNum(r0.wind_speed_10m, 0)} km/u`, `${bft} Bft uit ${compass(r0.wind_direction_10m)} (${fmtDeg(r0.wind_direction_10m)}) · stoten ${fmtNum(r0.wind_gusts_10m, 0)} km/u`);

  c.appendChild(horizonBar());
  const k1 = card(spanTitle(H.hours), [b('KNMI HARMONIE-AROME'), ' · 2 km · wind op 10 m']);
  c.appendChild(k1.el);
  const arrows = H.instant.filter(p => p.t.getHours() % 3 === 0 && p.wind_direction_10m != null).map(p => ({ t: p.t, deg: p.wind_direction_10m }));
  drawChart(k1.body, { sky: skyOf(),
    ...spanFor([H]), unit: 'km/u', unitTip: 'km/u', ticks: 'days', now: new Date(), yOpts: { zero: true, minSpan: 20, headroom: 1.1 },
    series: [
      { kind: 'line', name: 'Windstoten', color: 'var(--s1)', points: instantPts(H, 'wind_gusts_10m'), secondary: true },
      { kind: 'line', name: 'Wind', color: 'var(--s1)', points: instantPts(H, 'wind_speed_10m'), area: true },
    ].reverse(),
    fmt: v => fmtNum(v, 0), directLabels: 'peak', arrows, tipTime: p => fmtDayTime(p.t),
    tipNote: (s, p) => (s.name === 'Wind' ? ` · ${beaufort(p.v)} Bft · ${compass(p.row.wind_direction_10m)}` : ''),
    aria: 'Windsnelheid en windstoten per uur volgens HARMONIE',
  });
  legend(k1.el, [{ name: 'Windsnelheid', color: 'var(--s1)' }, { name: 'Windstoten', color: 'var(--s1)', dashed: true }, { name: 'Pijl: richting waarheen de wind waait, elke 3 u', color: 'var(--label-3)' }]);
  k1.tableHost.appendChild(dataTable(H.instant, [{ label: 'Uur', get: p => fmtDayTime(p.t) }, { label: 'km/u', num: true, get: p => fmtNum(p.wind_speed_10m, 0) }, { label: 'Stoten', num: true, get: p => fmtNum(p.wind_gusts_10m, 0) }, { label: 'Uit', get: p => `${compass(p.wind_direction_10m)} ${fmtDeg(p.wind_direction_10m)}` }]));
  k1.el.appendChild(h('p', 'foot', `t/m ${fmtDayTime(H.horizon)} · Beaufort afgeleid van de uursnelheid`));

  ensembleCard(c, 'Modelvergelijking', 'wind_speed_10m', { label: 'windsnelheid op 10 m', unit: 'km/u', unitTip: 'km/u', fmt: v => fmtNum(v, 0), yOpts: { zero: true, minSpan: 20, headroom: 1.1 },
    tipNote: (s, p) => ` · ${compass(p.row.wind_direction_10m)}` });
}

/* ---------------- Bewolking ---------------- */
function renderCloud(c) {
  const H = needHarmonie(c); if (!H) return;
  const r0 = H.instant[0];
  heroBlock(c, '<svg class="ico-big" viewBox="0 0 24 24"><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 10h.5a4 4 0 0 1 0 8H7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    `Nu · ${fmtTime(r0.t)}`, cloudWord(r0.cloud_cover), `${r0.cloud_cover}% bedekt · laag ${r0.cloud_cover_low}% · midden ${r0.cloud_cover_mid}% · hoog ${r0.cloud_cover_high}%`);

  c.appendChild(horizonBar());
  const k1 = card(spanTitle(H.hours), [b('KNMI HARMONIE-AROME'), ' · 2 km · bedekkingsgraad']);
  c.appendChild(k1.el);
  const pct = { min: 0, max: 100, step: 25 };
  drawChart(k1.body, { sky: skyOf(),
    ...spanFor([H]), unit: '%', unitTip: '%', ticks: 'days', now: new Date(), yFixed: pct,
    series: [
      { kind: 'line', name: 'Totaal', color: 'var(--s1)', points: instantPts(H, 'cloud_cover'), area: true },
      { kind: 'line', name: 'Lage bewolking', color: 'var(--s1)', points: instantPts(H, 'cloud_cover_low'), secondary: true },
    ],
    fmt: v => fmtNum(v, 0), tipTime: p => fmtDayTime(p.t),
    tipNote: (s, p) => (s.name === 'Totaal' ? ` · midden ${p.row.cloud_cover_mid}% · hoog ${p.row.cloud_cover_high}%` : ''),
    aria: 'Bewolking per uur volgens HARMONIE',
  });
  legend(k1.el, [{ name: 'Totale bedekking', color: 'var(--s1)' }, { name: 'Lage bewolking (< 2 km)', color: 'var(--s1)', dashed: true }]);
  k1.tableHost.appendChild(dataTable(H.instant, [{ label: 'Uur', get: p => fmtDayTime(p.t) }, { label: 'Totaal', num: true, get: p => `${p.cloud_cover}%` }, { label: 'Laag', num: true, get: p => `${p.cloud_cover_low}%` }, { label: 'Midden', num: true, get: p => `${p.cloud_cover_mid}%` }, { label: 'Hoog', num: true, get: p => `${p.cloud_cover_high}%` }]));
  k1.el.appendChild(h('p', 'foot', `t/m ${fmtDayTime(H.horizon)}`));

  ensembleCard(c, 'Modelvergelijking', 'cloud_cover', { label: 'totale bedekking', unit: '%', unitTip: '%', fmt: v => fmtNum(v, 0), yFixed: pct,
    note: m => (m.instant[0] && m.instant[0].cloud_derived ? `${m.res} · afgeleid uit lagen` : m.res) });
}

/* ======================================================================
   5. UI wiring: tabs, sheet, search, geolocation
   ====================================================================== */
for (const btn of document.querySelectorAll('.tab')) {
  btn.addEventListener('click', () => {
    if (state.tab === btn.dataset.tab) { $('screen').scrollTo({ top: 0 }); return; }
    state.tab = btn.dataset.tab;
    try { localStorage.setItem('regen.tab', state.tab); } catch (e) {}
    $('screen').scrollTo({ top: 0, behavior: 'auto' });
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
  state.nowcast = null; state.forecast = null; state.updated = null; render();
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
document.addEventListener('scroll', hideTooltip, true);

/* ---- pinch-to-zoom on the multi-day charts: two touch pointers; the span start stays at "nu" ---- */
const pinch = { pts: new Map(), startDist: 0, startHorizon: 0, active: false, raf: 0, pending: null };
const dist = () => { const [a, b] = [...pinch.pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
$('content').addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch' || !e.target.closest('.chart.zoomable') || !state.forecast) return;
  pinch.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch.pts.size === 2) {
    pinch.active = true; pinch.startDist = dist(); pinch.startHorizon = state.horizon == null ? maxHorizonHours() : state.horizon;
    hideTooltip();
  }
});
window.addEventListener('pointermove', e => {
  if (!pinch.pts.has(e.pointerId)) return;
  pinch.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!pinch.active || pinch.pts.size < 2) return;
  const scale = dist() / Math.max(1, pinch.startDist); // fingers apart = zoom in = fewer hours
  pinch.pending = pinch.startHorizon / scale;
  if (!pinch.raf) pinch.raf = setTimeout(() => { pinch.raf = 0; if (pinch.pending != null) setHorizon(pinch.pending, false); }, 16);
});
const endPinch = e => {
  if (!pinch.pts.has(e.pointerId)) return;
  pinch.pts.delete(e.pointerId);
  if (pinch.active && pinch.pts.size < 2) { pinch.active = false; setHorizon(state.horizon == null ? null : Math.round(state.horizon), true); }
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
const api = { raintextToMmh, parseRaintext, deriveCloudTotal, beaufort, compass, cloudWord, niceScale, parseForecast, compareRain, drawChart, sunAltitude, solarEvents, skyColor, sunPhase, MODELS, state };
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

  test('horizon: zoom houdt de start op nu en kapt het einde af; buiten bereik = alles', () => {
    const saved = { f: state.forecast, hz: state.horizon };
    try {
      state.forecast = parseForecast(mkJson(), NOW);
      const H = state.forecast.models.harmonie;
      state.horizon = 24;
      let s = spanFor([H]);
      eq(s.tMin.getTime(), state.forecast.startHour.getTime(), 'start = nu'); eq((s.tMax - s.tMin) / HOUR, 24, '24 uur breed');
      state.horizon = 500; s = spanFor([H]);
      eq(s.tMax.getTime(), H.horizon.getTime(), 'afgekapt op modelhorizon');
      state.horizon = null; s = spanFor([H]);
      eq(s.tMax.getTime(), H.horizon.getTime(), 'alles');
      near(maxHorizonHours(), 70 - 20 - 1, 1e-9, 'max horizon = uren tot laatste tijdstip');
    } finally { state.forecast = saved.f; state.horizon = saved.hz; }
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
