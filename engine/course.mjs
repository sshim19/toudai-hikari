/** Ships, reefs, port, bearing, and guideFrac / trackFrac / keepFrac / care. */

import {
  CARE_BLAST,
  CARE_MISS,
  CARE_OIL,
  CARE_WRECK,
  CURR_AMP,
  CURR_BIAS,
  CURR_PERIOD,
  DRIFT_GAIN,
  HORN_HOLD,
  HORN_IMPULSE,
  HORN_WINDOW,
  HULL_R,
  LAT_SCALE,
  LH_X,
  LH_Y,
  MISS_CREDIT,
  PORT_HOLD,
  SCORE_CARE,
  SCORE_GUIDE,
  SCORE_KEEP,
  SCORE_TRACK,
  STEER_GAIN,
  TRACK_PORT,
  WAND_AMP,
  WAND_PERIOD,
  beamFactor,
  clamp,
  gradeForScore,
  keepInst,
  meetsLightNeed,
  rangeAt,
} from "./constants.mjs";

export { beamFactor, keepInst, meetsLightNeed, rangeAt };

export function bearingOf(along, lat) {
  const y = rangeAt(along) - LH_Y;
  const x = (Number(lat) || 0) * LAT_SCALE - LH_X;
  const raw = Math.atan2(x, Math.max(1e-6, y));
  const zero = Math.atan2(-LH_X, Math.max(1e-6, rangeAt(0) - LH_Y));
  return raw - zero;
}

export function flowAt(playT, phase) {
  const t = Number(playT) || 0;
  const p = Number(phase) || 0;
  const current =
    CURR_BIAS * Math.sin(p) + CURR_AMP * Math.sin((2 * Math.PI * t) / Math.max(1e-6, CURR_PERIOD) + p);
  const wander = WAND_AMP * Math.sin((2 * Math.PI * t) / Math.max(1e-6, WAND_PERIOD) + p * 1.732);
  return { current, wander };
}

export function isTrackable(ship, playT) {
  if (!ship || ship.inPort || ship.wrecked || ship.missed) return false;
  if ((Number(playT) || 0) + 1e-12 < (Number(ship.appearT) || 0)) return false;
  if ((Number(ship.along) || 0) > 1 + 1e-12) return false;
  return true;
}

export function inHornWindow(ship, reef) {
  if (!ship || !reef || ship.inPort || ship.wrecked || ship.missed) return false;
  return Math.abs((Number(ship.along) || 0) - (Number(reef.along) || 0)) <= HORN_WINDOW + 1e-12;
}

export function anyHornWindow(ships, reefs, playT) {
  for (const ship of ships || []) {
    if (!isTrackable(ship, playT)) continue;
    for (const reef of reefs || []) {
      if (inHornWindow(ship, reef)) return true;
    }
  }
  return false;
}

export function hitsReef(ship, reef) {
  if (!ship || !reef) return false;
  const d = Math.hypot((Number(ship.along) || 0) - reef.along, (Number(ship.lat) || 0) - reef.lat);
  return d <= (Number(reef.r) || 0) + HULL_R + 1e-12;
}

export function trackInstOf(s) {
  const need = Number(s?.params?.lightNeed) || 0;
  const intensity = Number(s?.right?.intensity) || 0;
  const heading = Number(s?.left?.heading) || 0;
  const playT = Number(s?.playT) || 0;
  const ships = s?.ships || [];
  let has = false;
  let best = 0;
  for (const ship of ships) {
    if (!isTrackable(ship, playT)) continue;
    has = true;
    if (meetsLightNeed(intensity, need)) best = Math.max(best, beamFactor(heading, ship.bearing));
  }
  return { trackInst: has ? best : 0, hasTarget: has };
}

export function keepInstOf(s) {
  const info = trackInstOf(s);
  return keepInst(s?.right?.intensity, s?.params?.lightNeed, info.hasTarget);
}

export function makeShips(params) {
  return (params?.ships || []).map((p) => ({
    along: 0,
    lat: 0,
    bearing: bearingOf(0, 0),
    appearT: Number(p.appearT) || 0,
    shipDur: Number(p.shipDur) || 18,
    phase: Number(p.phase) || 0,
    trackT: 0,
    goodT: 0,
    inPort: false,
    wrecked: false,
    missed: false,
  }));
}

export function shipsComplete(s) {
  const ships = s?.ships || [];
  if (!ships.length) return false;
  return ships.every((sh) => sh.inPort);
}

export function recountShips(s) {
  const ships = s.ships || [];
  s.shipsTotal = ships.length;
  s.shipsIn = ships.reduce((n, sh) => n + (sh.inPort ? 1 : 0), 0);
  s.wrecks = ships.reduce((n, sh) => n + (sh.wrecked ? 1 : 0), 0);
  s.missed = ships.reduce((n, sh) => n + (sh.missed ? 1 : 0), 0);
}

export function scoreParts(s) {
  const ships = s?.ships || [];
  const n = ships.length;
  let guideFrac = 0;
  if (n > 0) {
    let sum = 0;
    for (const sh of ships) {
      if (sh.inPort) sum += 1;
      else if (sh.wrecked) sum += 0;
      else if (sh.missed) sum += clamp((Number(sh.goodT) || 0) / PORT_HOLD, 0, MISS_CREDIT);
      else sum += clamp((Number(sh.goodT) || 0) / PORT_HOLD, 0, 1);
    }
    guideFrac = sum / n;
  }
  const nTrack = Number(s?.nTrack) || 0;
  const sumTrack = Number(s?.sumTrack) || 0;
  const trackFrac = nTrack > 1e-6 ? clamp(sumTrack / nTrack, 0, 1) : 0;
  const nKeep = Number(s?.nKeep) || 0;
  const sumKeep = Number(s?.sumKeep) || 0;
  const keepFrac = nKeep > 1e-6 ? clamp(sumKeep / nKeep, 0, 1) : 0;
  const nShips = Math.max(1, n || Number(s?.shipsTotal) || 0);
  const wrecks = ships.length
    ? ships.reduce((c, sh) => c + (sh.wrecked ? 1 : 0), 0)
    : Number(s?.wrecks) || 0;
  const missedN = ships.length
    ? ships.reduce((c, sh) => c + (sh.missed ? 1 : 0), 0)
    : Number(s?.missed) || 0;
  const careTerm =
    CARE_WRECK * clamp(wrecks / nShips, 0, 1) +
    CARE_MISS * clamp(missedN / nShips, 0, 1) +
    CARE_OIL * (s?.oilOut ? 1 : 0) +
    CARE_BLAST * clamp((Number(s?.wastedBlasts) || 0) / 3, 0, 1);
  const care = 1 - clamp(careTerm, 0, 1);
  const raw = 100 * (SCORE_GUIDE * guideFrac + SCORE_TRACK * trackFrac + SCORE_KEEP * keepFrac + SCORE_CARE * care);
  const score = Math.round(clamp(raw, 0, 100));
  const grade = gradeForScore(score);
  return { guideFrac, trackFrac, keepFrac, care, score, grade };
}

function applyHorn(s, ship, reefs, used, step) {
  if (!s.right?.blasting || (Number(s.air) || 0) <= 0) return;
  for (let i = 0; i < reefs.length; i++) {
    const key = `${ship._idx}:${i}`;
    if (used[key]) continue;
    if (!inHornWindow(ship, reefs[i])) continue;
    const acc = (Number(s._windowT?.[key]) || 0) + step;
    s._windowT = { ...(s._windowT || {}), [key]: acc };
    if (acc + 1e-12 >= HORN_HOLD) {
      const sign = Math.sign(ship.lat) || 0;
      if (sign !== 0) ship.lat = sign * Math.max(0, Math.abs(ship.lat) - HORN_IMPULSE);
      else ship.lat = 0;
      ship.bearing = bearingOf(ship.along, ship.lat);
      used[key] = true;
      s._hornOk = true;
    }
  }
}

/**
 * Advance ships, collisions, port holds, and score averages for one physics step.
 * Mutates s. Does not lock the score.
 */
export function stepCourse(s, dt) {
  const step = Math.max(0, Number(dt) || 0);
  const playT = Number(s.playT) || 0;
  const reefs = s.params?.reefs || [];
  const port = s.params?.port || { m0: 0.9, m1: 0.96, halfW: 0.11 };
  const driftGain = DRIFT_GAIN * (Number(s.params?.driftMul) || 1);
  const used = { ...(s._hornUsed || {}) };
  if (!s._windowT) s._windowT = {};

  const ships = (s.ships || []).map((sh, i) => ({ ...sh, _idx: i }));
  for (const ship of ships) {
    if (ship.inPort || ship.wrecked || ship.missed) {
      ship.bearing = bearingOf(ship.along, ship.lat);
      continue;
    }
    if (playT + step + 1e-12 < ship.appearT) {
      ship.along = 0;
      ship.lat = 0;
      ship.bearing = bearingOf(0, 0);
      continue;
    }
    const started = playT + 1e-12 >= ship.appearT;
    if (!started) {
      const into = Math.max(0, playT + step - ship.appearT);
      ship.along = 0;
      ship.lat = 0;
      if (into > 0) {
        const dur = Math.max(1e-6, Number(ship.shipDur) || 18);
        ship.along = (into / dur);
      }
    }
    const dur = Math.max(1e-6, Number(ship.shipDur) || 18);
    const tNow = Math.max(0, playT - ship.appearT);
    // Integrate over this step only for time after appearT.
    const activeDt = playT + step <= ship.appearT ? 0 : Math.min(step, playT + step - ship.appearT);
    if (activeDt > 0) {
      ship.along = Math.max(0, ship.along + (1 / dur) * activeDt);
      const live = { ...s, ships, playT: playT + activeDt * 0.5 };
      // Use mid-step heading/intensity (already current) for steering.
      const info = trackInstOf({ ...live, ships: ships.map((x) => ({ ...x })) });
      // Per-ship track factor (this ship's own beam), not the max of all.
      const need = Number(s.params?.lightNeed) || 0;
      const intensity = Number(s.right?.intensity) || 0;
      const heading = Number(s.left?.heading) || 0;
      const selfTrack =
        meetsLightNeed(intensity, need) ? beamFactor(heading, bearingOf(ship.along, ship.lat)) : 0;
      const { current, wander } = flowAt(playT + activeDt * 0.5, ship.phase);
      ship.lat += (current + wander - STEER_GAIN * selfTrack * ship.lat) * driftGain * activeDt;
      ship.bearing = bearingOf(ship.along, ship.lat);
      applyHorn(s, ship, reefs, used, activeDt);

      for (const reef of reefs) {
        if (hitsReef(ship, reef)) {
          ship.wrecked = true;
          break;
        }
      }
    } else {
      ship.bearing = bearingOf(ship.along, ship.lat);
    }
    void tNow;
  }

  // Recompute global track after positions update, then port / miss / averages.
  s.ships = ships.map(({ _idx, ...sh }) => sh);
  s._hornUsed = used;
  const info = trackInstOf({ ...s, playT: playT + step });
  s.trackInst = info.trackInst;
  s.keepInst = keepInst(s.right?.intensity, s.params?.lightNeed, info.hasTarget);
  s.hornWindow = anyHornWindow(s.ships, reefs, playT + step);

  if (s.finishedAt == null) {
    for (const ship of s.ships) {
      if (ship.inPort || ship.wrecked || ship.missed) continue;
      if (playT + step + 1e-12 < ship.appearT) continue;
      const inMouth = ship.along >= port.m0 - 1e-12 && ship.along <= port.m1 + 1e-12;
      const lined = Math.abs(ship.lat) <= (Number(port.halfW) || 0) + 1e-12;
      // Port hold is this ship's own beam, not the max over other visible ships.
      const need = Number(s.params?.lightNeed) || 0;
      const intensity = Number(s.right?.intensity) || 0;
      const heading = Number(s.left?.heading) || 0;
      const selfTrack =
        meetsLightNeed(intensity, need) ? beamFactor(heading, ship.bearing) : 0;
      if (inMouth && lined && selfTrack >= TRACK_PORT - 1e-12) {
        ship.goodT = (Number(ship.goodT) || 0) + step;
        if (ship.goodT + 1e-12 >= PORT_HOLD) ship.inPort = true;
      }
      if (!ship.inPort && ship.along > port.m1 + 1e-12) ship.missed = true;
    }

    if (info.hasTarget) {
      s.nTrack = (Number(s.nTrack) || 0) + step;
      s.sumTrack = (Number(s.sumTrack) || 0) + info.trackInst * step;
    }
    s.nKeep = (Number(s.nKeep) || 0) + step;
    s.sumKeep = (Number(s.sumKeep) || 0) + s.keepInst * step;

    for (const ship of s.ships) {
      if (isTrackable(ship, playT + step) && info.trackInst > 1e-6) {
        ship.trackT = (Number(ship.trackT) || 0) + step;
      }
    }
  }

  recountShips(s);
}
