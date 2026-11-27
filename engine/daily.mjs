/** dailyParams(rngState) → { params, rngState }. Idempotent daily sea. */

import {
  APPEAR_JITTER,
  DRIFT_MUL_JITTER,
  FOG_TABLE,
  PLAY_TIME,
  PORT_HALF_W_MAX,
  PORT_HALF_W_MIN,
  PORT_HOLD,
  PORT_M0_MAX,
  PORT_M0_MIN,
  PORT_W_MAX,
  PORT_W_MIN,
  REEF_LAT_MAX,
  REEF_LAT_MIN,
  REEF_R_MAX,
  REEF_R_MIN,
  SHIP_DUR_MAX,
  SHIP_DUR_MIN,
  SHIP_GAP_MAX,
  SHIP_GAP_MIN,
  HULL_R,
  clamp,
} from "./constants.mjs";
import { rngRange, rngStep } from "./rng.mjs";

function pickFog(u) {
  if (u < 0.3) return "thin";
  if (u < 0.7) return "normal";
  return "thick";
}

function pickInt(a, lo, hi) {
  if (lo === hi) return { value: lo, a };
  const step = rngStep(a);
  const n = lo + Math.min(hi - lo, Math.floor(step.value * (hi - lo + 1)));
  return { value: n, a: step.a };
}

/**
 * If the last ship cannot reach the mouth and hold PORT_HOLD within PLAY_TIME,
 * shrink gaps, then mouth width, then the first appearance, in that order.
 */
function fitTimeline(first, gaps, durs, m0, widthT, hold) {
  let tFirst = first;
  let g = gaps.slice();
  let wT = widthT;
  const lastDur = () => (durs.length ? durs[durs.length - 1] : SHIP_DUR_MAX);
  const lastAppear = () => tFirst + g.reduce((s, x) => s + x, 0);
  const arrival = () => lastAppear() + lastDur() * m0 + hold;
  if (arrival() <= PLAY_TIME + 1e-9) return { first: tFirst, gaps: g, widthT: wT };

  let extra = arrival() - PLAY_TIME;
  for (let i = 0; i < g.length && extra > 1e-9; i++) {
    const cut = Math.min(extra, Math.max(0, g[i] - SHIP_GAP_MIN));
    g[i] -= cut;
    extra -= cut;
  }
  if (extra > 1e-9) {
    const cut = Math.min(extra, Math.max(0, wT - PORT_W_MIN));
    wT -= cut;
    // shrinking width does not change arrival at m0; keep going.
  }
  if (extra > 1e-9) {
    const lo = 3.2;
    const cut = Math.min(extra, Math.max(0, tFirst - lo));
    tFirst -= cut;
    extra -= cut;
  }
  if (extra > 1e-9) {
    const gapSum = g.reduce((s, x) => s + x, 0);
    if (gapSum > 1e-9) {
      const scale = Math.max(0, (gapSum - extra) / gapSum);
      for (let i = 0; i < g.length; i++) g[i] *= scale;
      extra = Math.max(0, arrival() - PLAY_TIME);
    }
    if (extra > 1e-9) tFirst = Math.max(0.8, tFirst - extra);
  }
  return { first: tFirst, gaps: g, widthT: wT };
}

function overlapsReef(list, along, lat, r) {
  for (const other of list) {
    const d = Math.hypot(other.along - along, other.lat - lat);
    if (d < other.r + r + 0.012) return true;
  }
  return false;
}

/**
 * Stream order: fog → drift jitter → appear jitter → ship count and gaps → port width → reefs.
 */
export function dailyParams(rngState) {
  let a = rngState >>> 0;
  let r = rngStep(a);
  a = r.a;
  const fog = pickFog(r.value);
  const row = FOG_TABLE[fog];

  r = rngRange(a, -DRIFT_MUL_JITTER, DRIFT_MUL_JITTER);
  a = r.a;
  const driftMul = clamp(row.driftMul + r.value, row.driftMul - DRIFT_MUL_JITTER, row.driftMul + DRIFT_MUL_JITTER);

  r = rngRange(a, -APPEAR_JITTER, APPEAR_JITTER);
  a = r.a;
  const appearJitter = r.value;

  const nPick = pickInt(a, row.ships[0], row.ships[1]);
  a = nPick.a;
  const n = nPick.value;

  r = rngRange(a, row.firstShip[0], row.firstShip[1]);
  a = r.a;
  let first = clamp(r.value + appearJitter, row.firstShip[0], row.firstShip[1]);

  const durs = [];
  const phases = [];
  for (let i = 0; i < n; i++) {
    r = rngRange(a, SHIP_DUR_MIN, SHIP_DUR_MAX);
    a = r.a;
    durs.push(r.value);
    r = rngRange(a, 0, Math.PI * 2);
    a = r.a;
    phases.push(r.value);
  }

  const gaps = [];
  for (let i = 0; i < n - 1; i++) {
    r = rngRange(a, SHIP_GAP_MIN, SHIP_GAP_MAX);
    a = r.a;
    gaps.push(r.value);
  }

  r = rngRange(a, PORT_M0_MIN, PORT_M0_MAX);
  a = r.a;
  let m0 = r.value;

  r = rngRange(a, PORT_W_MIN, PORT_W_MAX);
  a = r.a;
  let widthT = r.value;

  r = rngRange(a, PORT_HALF_W_MIN, PORT_HALF_W_MAX);
  a = r.a;
  const halfW = r.value;

  const fitted = fitTimeline(first, gaps, durs, m0, widthT, PORT_HOLD);
  first = fitted.first;
  const gOut = fitted.gaps;
  widthT = fitted.widthT;

  // Size the mouth from the fastest ship so every hull can hold PORT_HOLD.
  const minDur = Math.min(...durs);
  let widthAlong = widthT / Math.max(1e-6, minDur);
  // Keep a full mouth: if it would run past the end, shift it earlier
  // instead of shrinking it against along = 1 (a ship parked at 1 could
  // never "pass" the mouth).
  if (m0 + widthAlong > 0.995) {
    m0 = Math.max(PORT_M0_MIN, 0.995 - widthAlong);
    widthAlong = Math.min(widthAlong, 0.995 - m0);
  }
  const m1 = Math.min(0.995, m0 + widthAlong);

  const appears = [];
  let t = first;
  for (let i = 0; i < n; i++) {
    appears.push(t);
    if (i < n - 1) t += gOut[i];
  }

  const ships = appears.map((appearT, i) => ({
    appearT,
    shipDur: durs[i],
    phase: phases[i],
  }));

  const reefs = placeReefs(a, row, ships, m0);
  a = reefs.a;

  return {
    params: {
      fog,
      fogMul: row.fogMul,
      driftMul,
      lightNeed: row.lightNeed,
      ships,
      reefs: reefs.list,
      port: { m0, m1, halfW },
    },
    rngState: a,
  };
}

function placeReefs(a, row, ships, m0) {
  const countPick = pickInt(a, row.reefs[0], row.reefs[1]);
  a = countPick.a;
  const want = countPick.value;
  const firstShip = ships[0];
  const firstDur = Number(firstShip?.shipDur) || SHIP_DUR_MAX;
  const firstAppear = Number(firstShip?.appearT) || row.firstShip[0];
  // First reef is not encountered before firstReef seconds of play.
  const alongMin = Math.max(0.08, (row.firstReef - firstAppear) / firstDur);
  const alongMax = m0 - 0.03;
  const list = [];
  if (!(alongMax > alongMin + 0.02)) return { list, a };

  const slots = [];
  for (let k = 0; k < want; k++) {
    const lo = alongMin + ((alongMax - alongMin) * k) / Math.max(1, want);
    const hi = alongMin + ((alongMax - alongMin) * (k + 1)) / Math.max(1, want);
    slots.push({ lo: lo + 0.006, hi: hi - 0.006 });
  }

  for (let k = 0; k < want; k++) {
    let placed = false;
    const slot = slots[k] || { lo: alongMin, hi: alongMax };
    const usable = slot.hi - slot.lo > 0.01 ? slot : { lo: alongMin, hi: alongMax };
    for (let attempt = 0; attempt < 8 && !placed; attempt++) {
      let pick = rngRange(a, usable.lo, usable.hi);
      a = pick.a;
      const along = pick.value;
      pick = rngRange(a, REEF_R_MIN, REEF_R_MAX);
      a = pick.a;
      const r = pick.value;
      pick = rngRange(a, REEF_LAT_MIN, REEF_LAT_MAX);
      a = pick.a;
      const side = k % 2 === 0 ? 1 : -1;
      const lat = side * pick.value;
      if (
        along >= alongMin - 1e-9 &&
        along < m0 - r - 1e-9 &&
        Math.abs(lat) >= r + HULL_R + 0.045 &&
        !overlapsReef(list, along, lat, r)
      ) {
        list.push({ along, lat, r });
        placed = true;
      }
    }
    if (!placed) {
      const along = (usable.lo + usable.hi) / 2;
      const r = (REEF_R_MIN + REEF_R_MAX) / 2;
      const side = k % 2 === 0 ? 1 : -1;
      const lat = side * ((REEF_LAT_MIN + REEF_LAT_MAX) / 2);
      if (
        along >= alongMin - 1e-9 &&
        along < m0 - r - 1e-9 &&
        Math.abs(lat) >= r + HULL_R + 0.045 &&
        !overlapsReef(list, along, lat, r)
      ) {
        list.push({ along, lat, r });
      }
    }
  }

  list.sort((x, y) => x.along - y.along);
  return { list, a };
}

export function timeToAlong(ship, along) {
  const dur = Number(ship?.shipDur) || 0;
  if (!(dur > 0)) return 0;
  return (Number(ship?.appearT) || 0) + (Number(along) || 0) * dur;
}

export function alongAtTime(ship, playT) {
  const dur = Number(ship?.shipDur) || 0;
  if (!(dur > 0)) return 0;
  return clamp(((Number(playT) || 0) - (Number(ship?.appearT) || 0)) / dur, 0, 1);
}
