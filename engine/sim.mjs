/** tick(state, input, dt) → state. Place, play, reveal, finish. No DOM. */

import {
  DAILY_HINT_TIME,
  FINISH_MIN,
  FIXED_DT,
  LESSON_HINT_TIME,
  MAX_DT,
  PLACE_TIME,
  PLAY_TIME,
  REVEAL_TIME,
  TAP_HOLD,
  TAP_PATH,
  START_AIR,
  START_HEAD,
  START_INT,
  START_OIL,
} from "./constants.mjs";
import { scoreParts, shipsComplete, stepCourse, makeShips, recountShips, trackInstOf, keepInstOf } from "./course.mjs";
import { dailyParams } from "./daily.mjs";
import { capIntensityForOil, integrateOil, updateLamp } from "./lamp.mjs";
import { emptyLeft, updateLens } from "./lens.mjs";
import { integrateAir, isHornHit, updateHorn } from "./horn.mjs";
import { hashSeed } from "./rng.mjs";

export { scoreParts, shipsComplete, trackInstOf, keepInstOf };

export function previewScore(s) {
  if (!s) return 0;
  return scoreParts(s).score;
}

function emptyRight() {
  return {
    intensity: START_INT,
    intensityDes: START_INT,
    blasting: false,
    blastT: 0,
  };
}

function cloneState(s) {
  return {
    ...s,
    params: s.params
      ? {
          ...s.params,
          ships: (s.params.ships || []).map((t) => ({ ...t })),
          reefs: (s.params.reefs || []).map((c) => ({ ...c })),
          port: s.params.port ? { ...s.params.port } : s.params.port,
        }
      : s.params,
    left: { ...(s.left || emptyLeft()) },
    right: { ...(s.right || emptyRight()) },
    ships: (s.ships || []).map((sh) => ({ ...sh })),
    _hornUsed: s._hornUsed ? { ...s._hornUsed } : s._hornUsed,
    _windowT: s._windowT ? { ...s._windowT } : s._windowT,
  };
}

function hands(input) {
  const leftOn = !!input?.left?.active;
  const rightOn = !!input?.right?.active;
  return {
    leftOn,
    rightOn,
    leftPos: leftOn ? { x: Number(input.left.x), y: Number(input.left.y) } : null,
    rightPos: rightOn ? { x: Number(input.right.x), y: Number(input.right.y) } : null,
  };
}

export function updateBests(s) {
  if (s.score <= 0) return s;
  if (s.score > s.bestScore) s.bestScore = s.score;
  if (s.score > s.todayBestScore) s.todayBestScore = s.score;
  return s;
}

function refreshLive(s) {
  const parts = scoreParts(s);
  if (s.finishedAt == null) {
    s.guideFrac = parts.guideFrac;
    s.trackFrac = parts.trackFrac;
    s.keepFrac = parts.keepFrac;
    s.care = parts.care;
  }
}

function lockScore(s) {
  if (s.finishedAt != null) return;
  const parts = scoreParts(s);
  s.guideFrac = parts.guideFrac;
  s.trackFrac = parts.trackFrac;
  s.keepFrac = parts.keepFrac;
  s.care = parts.care;
  s.score = parts.score;
  s.grade = parts.grade;
  s.finishedAt = s.playT;
  s.showDaily = false;
  s.showLesson = false;
  updateBests(s);
}

function goReveal(s) {
  s.phase = "reveal";
  s.phaseT = 0;
  s.showDaily = false;
  s.showLesson = false;
  s.right = { ...s.right, blasting: false, blastT: 0 };
}

export function canFinish(s) {
  if (!s || s.status !== "playing" || s.phase !== "play") return false;
  if (s.finishedAt != null) return false;
  if (shipsComplete(s)) return true;
  return s.playT + 1e-9 >= FINISH_MIN;
}

function finalizeFinish(s) {
  lockScore(s);
  goReveal(s);
}

function closeBlast(s) {
  if (s._wasBlasting && !s._hornOk) s.wastedBlasts = (Number(s.wastedBlasts) || 0) + 1;
  s._wasBlasting = false;
  s._hornOk = false;
}

function applyGestures(s, input, dt, active) {
  const h = hands(input);
  const leftPos = active && h.leftOn ? h.leftPos : null;
  const rightPos = active && h.rightOn ? h.rightPos : null;
  const prevHead = s.left.heading;
  const prevInt = s.right.intensity;

  s.left = updateLens(s.left, leftPos, dt, !!(active && h.leftOn));

  const hornOn = !!(active && h.rightOn && rightPos && isHornHit(rightPos.x, rightPos.y));
  if (hornOn) {
    const horn = updateHorn(s.right, rightPos, dt, true);
    s.right = {
      ...s.right,
      intensity: s.right.intensity,
      intensityDes: s.right.intensity,
      blasting: horn.blasting,
      blastT: horn.blastT,
    };
    s._wasBlasting = true;
  } else {
    if (s.right.blasting || s._wasBlasting) closeBlast(s);
    s.right = updateLamp(s.right, rightPos, dt, !!(active && h.rightOn && rightPos));
    s.right.blasting = false;
    s.right.blastT = 0;
  }

  if (active && h.leftOn) {
    const moved =
      Math.abs(s.left.heading - prevHead) > 0.04 ||
      (Number(s.left.holdT) || 0) + 1e-12 >= TAP_HOLD ||
      (Number(s.left.path) || 0) + 1e-12 >= TAP_PATH;
    if (moved) s.hintLeft = false;
  }
  if (active && h.rightOn && !hornOn) {
    const moved = Math.abs(s.right.intensity - prevInt) > 0.04;
    s._hintRightHold = (Number(s._hintRightHold) || 0) + dt;
    if (moved || s._hintRightHold + 1e-12 >= TAP_HOLD) s.hintRight = false;
  } else if (!h.rightOn) {
    s._hintRightHold = 0;
  }
}

function stepPlay(s, input, dt) {
  if (s.finishedAt != null) {
    s.playT += dt;
    s.phaseT += dt;
    s.showDaily = false;
    s.showLesson = false;
    s.right = { ...s.right, blasting: false, blastT: 0 };
    return;
  }

  s.oil = integrateOil(s.oil, s.right.intensity, dt);
  if (s.oil <= 0) {
    if (!s.oilOut) s.oilOut = true;
    s.right = { ...s.right, intensity: capIntensityForOil(s.right.intensity, s.oil) };
  }
  s.air = integrateAir(s.air, s.right.blasting, dt);
  if (s.air <= 0 && s.right.blasting) {
    closeBlast(s);
    s.right = { ...s.right, blasting: false, blastT: 0 };
  }

  stepCourse(s, dt);
  refreshLive(s);

  s.playT += dt;
  s.phaseT += dt;
  s.showDaily = s.playT < DAILY_HINT_TIME;
  s.showLesson = s.playT < LESSON_HINT_TIME;

  if (shipsComplete(s)) {
    s.playT = Math.min(s.playT, PLAY_TIME);
    finalizeFinish(s);
  } else if (s.playT + 1e-9 >= PLAY_TIME) {
    s.playT = PLAY_TIME;
    finalizeFinish(s);
  } else if (input?.finish && canFinish(s)) {
    finalizeFinish(s);
  }
}

function holdStartPose(s) {
  s.left = { ...emptyLeft(), heading: START_HEAD, headingDes: START_HEAD };
  s.right = emptyRight();
  s.oil = START_OIL;
  s.air = START_AIR;
  s.oilOut = false;
  for (const ship of s.ships || []) {
    ship.along = 0;
    ship.lat = 0;
    ship.bearing = 0;
    ship.trackT = 0;
    ship.goodT = 0;
    ship.inPort = false;
    ship.wrecked = false;
    ship.missed = false;
  }
  recountShips(s);
}

function stepPhase(s, input, dt) {
  if (s.status !== "playing") return;
  if (s.phase === "place") {
    s.phaseT += dt;
    holdStartPose(s);
    if (s.phaseT + 1e-9 >= PLACE_TIME) {
      const overflow = Math.max(0, s.phaseT - PLACE_TIME);
      s.phase = "play";
      s.phaseT = 0;
      s.playT = 0;
      s.showDaily = true;
      s.showLesson = true;
      if (overflow > 0) stepPlay(s, input, overflow);
    }
    return;
  }
  if (s.phase === "play") {
    stepPlay(s, input, dt);
    return;
  }
  if (s.phase === "reveal") {
    s.phaseT += dt;
    s.right = { ...s.right, blasting: false, blastT: 0 };
    if (s.phaseT + 1e-9 >= REVEAL_TIME) s.status = "over";
  }
}

/**
 * Near-pure: same state+input+dt → same result. Does not mutate state or input.
 * Clamps dt to 50ms and steps play / phases at 1/60 + remainder.
 * Gestures are applied once per call with the frame dt (positions are samples, not per-substep).
 * When landscape is false, heading and intensity stay, the horn stops, and time / ships / oil do not advance.
 */
export function tick(state, input, dt) {
  if (state.status !== "playing") return cloneState(state);
  const s = cloneState(state);
  const rawDt = Math.min(Math.max(Number(dt) || 0, 0), MAX_DT);
  if (!input?.landscape) {
    applyGestures(s, input, rawDt, false);
    s.right = { ...s.right, blasting: false, blastT: 0 };
    return s;
  }
  applyGestures(s, input, rawDt, s.phase === "play");
  let left = rawDt;
  while (left > 0 && s.status === "playing") {
    const stepDt = Math.min(FIXED_DT, left);
    stepPhase(s, input, stepDt);
    left -= stepDt;
  }
  return s;
}

/**
 * Shared by 「仕舞う」, the time limit, and a completed set of ships.
 * No-op before 22s unless every ship is in port, and during place / reveal / when not playing.
 * Landscape is enforced by tick; a direct call assumes the caller already checked orientation.
 * A wreck ends that ship only; it does not lock the score.
 */
export function finishNow(state) {
  const s = cloneState(state);
  if (canFinish(s)) finalizeFinish(s);
  return s;
}

/** Fresh playing state. bestScore / todayBestScore are in-memory; persist elsewhere. */
export function createInitialState({ seed, dateJst, bestScore = 0, todayBestScore = 0 } = {}) {
  const rng0 = hashSeed(seed);
  const built = dailyParams(rng0);
  const params = built.params;
  const ships = makeShips(params);
  return {
    status: "playing",
    phase: "place",
    seed,
    dateJst: dateJst ?? null,
    phaseT: 0,
    playT: 0,
    rngState: built.rngState,
    params,
    left: emptyLeft(),
    right: emptyRight(),
    oil: START_OIL,
    air: START_AIR,
    oilOut: false,
    wastedBlasts: 0,
    ships,
    shipsIn: 0,
    shipsTotal: ships.length,
    wrecks: 0,
    missed: 0,
    guideFrac: 0,
    trackFrac: 0,
    keepFrac: 0,
    care: 1,
    nTrack: 0,
    sumTrack: 0,
    nKeep: 0,
    sumKeep: 0,
    trackInst: 0,
    keepInst: 0,
    hornWindow: false,
    score: 0,
    grade: null,
    finishedAt: null,
    bestScore: bestScore || 0,
    todayBestScore: todayBestScore || 0,
    hintLeft: true,
    hintRight: true,
    showDaily: false,
    showLesson: false,
    _hornUsed: {},
    _windowT: {},
    _wasBlasting: false,
    _hornOk: false,
  };
}
