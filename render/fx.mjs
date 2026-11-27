/**
 * 重ねの開示、吹き出し、座礁、入港、状態の一文。
 * 終了画面には吹き出しも破片も残さない。
 */

import * as constants from "../engine/constants.mjs";
import { dailyCondition, formatScore, gradeCallout } from "./share.mjs";

const RANGE0 = constants.RANGE0 ?? 1.15;
const RANGE1 = constants.RANGE1 ?? 0.28;
const LAT_SCALE = constants.LAT_SCALE ?? 1;

export const JUDGE_BALLOON_OFFSET = constants.JUDGE_BALLOON_OFFSET ?? 70;
export const TRAIL_CAP = 280;
export const SHIP_TRAIL_CAP = 160;
export const BITS_CAP = 16;
export const BEAM_INNER = constants.BEAM_INNER ?? 0.22;
export const BEAM_OUTER = constants.BEAM_OUTER ?? 0.48;
export const OIL_LOW = constants.OIL_LOW ?? 0.22;
export const NEAR_TIME = constants.NEAR_TIME ?? 0.8;
export const KEEP_BAND = constants.KEEP_BAND ?? 0.2;
export const TRACK_PORT = constants.TRACK_PORT ?? 0.55;
export const WRECK_FLASH = 1.4;

export const LESSON_TEXT = "船に光を当てて、港へ導く";
export const LESSON_SUB = "霧が濃いときは霧笛も鳴らして";

const FONT = `"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif`;

/** 灯台を原点に、沖が rangeAt(0)、港が rangeAt(1)。画面角が bearing と一致する。 */
export const LANTERN = { x: 400, y: 256 };
export const SEA_SCALE = 148;
export const SEA = {
  midX: LANTERN.x,
  yFar: LANTERN.y - RANGE0 * SEA_SCALE,
  yNear: LANTERN.y - RANGE1 * SEA_SCALE,
  latScale: SEA_SCALE * LAT_SCALE,
  bend: 0,
};

function rangeAlong(along) {
  const t = Number(along);
  if (typeof constants.rangeAt === "function") {
    if (!Number.isFinite(t)) return constants.rangeAt(0);
    if (t > 1) return constants.rangeAt(1) - (t - 1) * 0.16;
    if (t < 0) return constants.rangeAt(0) - t * 0.12;
    return constants.rangeAt(t);
  }
  const u = clamp(t, 0, 1);
  return RANGE0 * (1 - u) + RANGE1 * u;
}


function clamp(n, a, b) {
  return Math.max(a, Math.min(b, Number(n) || 0));
}

function rgba(hex, a) {
  const n = parseInt(String(hex || "#eef2f4").replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** 航路に沿った論理座標。along 0 が沖、1 が港の奥。画面上の向きは bearing に一致する。 */
export function seaPoint(along, lat) {
  const wy = rangeAlong(along);
  const wx = (Number(lat) || 0) * LAT_SCALE;
  return {
    x: LANTERN.x + wx * SEA_SCALE,
    y: LANTERN.y - wy * SEA_SCALE,
  };
}

export function lanternPos() {
  return { x: LANTERN.x, y: LANTERN.y };
}

function lightNeedOf(state) {
  const v = Number(state?.params?.lightNeed);
  return Number.isFinite(v) ? v : 0.5;
}

function headingOf(state) {
  return Number(state?.left?.heading) || 0;
}

function intensityOf(state) {
  const v = Number(state?.right?.intensity);
  return Number.isFinite(v) ? v : 0;
}

function playTOf(state) {
  return Number(state?.playT) || 0;
}

export function isTrackable(state, ship) {
  if (!ship || ship.inPort || ship.wrecked || ship.missed) return false;
  if (playTOf(state) + 1e-12 < (Number(ship.appearT) || 0)) return false;
  if ((Number(ship.along) || 0) > 1 + 1e-12) return false;
  return true;
}

export function shipTrackInst(state, ship) {
  if (!isTrackable(state, ship)) return 0;
  if (intensityOf(state) + 1e-12 < lightNeedOf(state)) return 0;
  if (typeof constants.beamFactor === "function") {
    return constants.beamFactor(headingOf(state), ship.bearing);
  }
  const bearing = Number(ship.bearing);
  if (!Number.isFinite(bearing)) return 0;
  const d = Math.abs(headingOf(state) - bearing);
  if (d <= BEAM_INNER) return 1;
  if (d >= BEAM_OUTER) return 0;
  return 1 - (d - BEAM_INNER) / (BEAM_OUTER - BEAM_INNER);
}

function shipDurOf(ship) {
  const d = Number(ship?.shipDur);
  return Number.isFinite(d) && d > 0 ? d : 18;
}

function timeToAlong(ship, target) {
  const along = Number(ship?.along);
  if (!Number.isFinite(along)) return Infinity;
  return (target - along) * shipDurOf(ship);
}

function portMouth(state) {
  const port = state?.params?.port;
  const m0 = Number(port?.m0);
  const m1 = Number(port?.m1);
  return {
    m0: Number.isFinite(m0) ? m0 : 0.86,
    m1: Number.isFinite(m1) ? m1 : 0.96,
    halfW: Number(port?.halfW) || 0.08,
  };
}

function inMouth(ship, port) {
  const along = Number(ship?.along);
  if (!Number.isFinite(along)) return false;
  return along >= port.m0 && along <= port.m1;
}

/**
 * 再生中の状態文。優先は座礁した、油が尽きた、油が少ない、港が近い、礁が近い、
 * 港へ入れている、光を当てる、暗すぎ、明るすぎ、導いている。
 * @param {object} [state]
 * @param {{ wreckFlash?: number }} [opts]
 * @returns {string}
 */
export function statusFrom(state, opts = {}) {
  if (state?.status !== "playing" || state?.phase !== "play") return "";
  if ((Number(opts.wreckFlash) || 0) > 0.05) return "座礁した";
  if (state?.oilOut) return "油が尽きた";
  const oil = Number(state?.oil);
  if (Number.isFinite(oil) && oil <= OIL_LOW) return "油が少ない";

  const ships = Array.isArray(state?.ships) ? state.ships : [];
  const live = ships.filter((sh) => isTrackable(state, sh));
  const port = portMouth(state);
  const reefs = Array.isArray(state?.params?.reefs) ? state.params.reefs : [];
  const need = lightNeedOf(state);
  const intensity = intensityOf(state);
  const heading = headingOf(state);

  let approachingPort = false;
  let reefNear = false;
  let guidingIn = false;
  let needLightInMouth = false;
  let headingOff = false;
  let headingNear = false;
  let lit = false;
  let bestTrack = 0;

  for (const sh of live) {
    const track = shipTrackInst(state, sh);
    bestTrack = Math.max(bestTrack, track);
    const tPort = timeToAlong(sh, port.m0);
    if (tPort > 0 && tPort <= NEAR_TIME) approachingPort = true;
    if (inMouth(sh, port)) {
      if (track >= TRACK_PORT) guidingIn = true;
      else needLightInMouth = true;
    }
    const bearing = Number(sh.bearing);
    if (Number.isFinite(bearing)) {
      const d = Math.abs(heading - bearing);
      if (d > BEAM_INNER) headingOff = true;
      if (d <= BEAM_OUTER) headingNear = true;
    }
    if (track >= 0.45) lit = true;
    for (const reef of reefs) {
      const tReef = timeToAlong(sh, Number(reef.along) || 0);
      if (tReef > -0.12 && tReef <= NEAR_TIME) reefNear = true;
    }
  }

  if (approachingPort) return "港が近い";
  if (reefNear) return "礁が近い";
  if (guidingIn) return "港へ入れている";
  if (needLightInMouth || (live.length > 0 && headingOff && !lit)) return "光を当てる";
  if (live.length > 0 && headingNear && intensity < need) return "暗すぎ";
  if (live.length > 0 && lit && intensity > need + KEEP_BAND) return "明るすぎ";
  if (lit) return "導いている";
  return "";
}

export function createFx() {
  return {
    clock: 0,
    trail: [],
    shipTrails: [],
    bits: [],
    floats: [],
    wavePhase: 0,
    fogPhase: 0,
    placeGlow: 0,
    revealZoom: 1,
    dailyAlpha: 0,
    lessonAlpha: 0,
    statusAlpha: 0,
    statusText: "",
    overlayX: 400,
    overlayY: 150,
    wreckFlash: 0,
    trackGlow: 0,
    prev: null,
  };
}

export function resetFx(fx) {
  if (!fx) return;
  fx.clock = 0;
  fx.trail.length = 0;
  fx.shipTrails.length = 0;
  fx.bits.length = 0;
  fx.floats.length = 0;
  fx.wavePhase = 0;
  fx.fogPhase = 0;
  fx.placeGlow = 0;
  fx.revealZoom = 1;
  fx.dailyAlpha = 0;
  fx.lessonAlpha = 0;
  fx.statusAlpha = 0;
  fx.statusText = "";
  fx.overlayX = 400;
  fx.overlayY = 150;
  fx.wreckFlash = 0;
  fx.trackGlow = 0;
  fx.prev = null;
}

function spawnBalloons(fx, state) {
  const grade = state?.grade || "early";
  const score = Math.max(0, Math.floor(Number(state?.score) || 0));
  fx.floats.length = 0;
  fx.floats.push({
    kind: "grade",
    text: gradeCallout(grade),
    age: 0,
    color: "#1c2430",
  });
  fx.floats.push({
    kind: "score",
    text: `${formatScore(score)}点`,
    age: 0,
    color: "#1c2430",
  });
}

function addBits(fx, kind, along, lat, reduced) {
  if (reduced) return;
  const p = seaPoint(along, lat);
  const n = kind === "wreck" ? 8 : 6;
  const color = kind === "wreck" ? "#d8c89a" : "#e8a858";
  for (let i = 0; i < n && fx.bits.length < BITS_CAP; i++) {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
    const spd = (kind === "wreck" ? 40 : 24) + Math.random() * 32;
    fx.bits.push({
      kind,
      x: p.x + (Math.random() - 0.5) * 8,
      y: p.y + (Math.random() - 0.5) * 6,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      r: 1.3 + Math.random() * 1.6,
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 6,
      life: 0.4 + Math.random() * 0.3,
      max: 0.75,
      color,
    });
  }
}

function pushBeamTrail(fx, state) {
  const heading = headingOf(state);
  const intensity = intensityOf(state);
  const last = fx.trail[fx.trail.length - 1];
  if (last && Math.abs(heading - last.heading) < 0.012 && Math.abs(intensity - last.intensity) < 0.02 && fx.clock - last.at < 0.08) {
    return;
  }
  fx.trail.push({ heading, intensity, at: fx.clock });
  if (fx.trail.length > TRAIL_CAP) fx.trail.splice(0, fx.trail.length - TRAIL_CAP);
}

function pushShipTrails(fx, state) {
  const ships = Array.isArray(state?.ships) ? state.ships : [];
  for (let i = 0; i < ships.length; i++) {
    const sh = ships[i];
    if (!sh) continue;
    const along = Number(sh.along);
    const lat = Number(sh.lat);
    if (!Number.isFinite(along) || !Number.isFinite(lat)) continue;
    if (!isTrackable(state, sh) && !sh.inPort && !sh.wrecked && !sh.missed) continue;
    if (!fx.shipTrails[i]) fx.shipTrails[i] = [];
    const list = fx.shipTrails[i];
    const last = list[list.length - 1];
    if (last && Math.abs(along - last.along) < 0.003 && Math.abs(lat - last.lat) < 0.003 && fx.clock - last.at < 0.08) {
      continue;
    }
    list.push({
      along,
      lat,
      track: shipTrackInst(state, sh),
      wrecked: !!sh.wrecked,
      inPort: !!sh.inPort,
      at: fx.clock,
    });
    if (list.length > SHIP_TRAIL_CAP) list.splice(0, list.length - SHIP_TRAIL_CAP);
  }
}

function wreckedShipPoint(state, prevWrecks) {
  const ships = Array.isArray(state?.ships) ? state.ships : [];
  const wrecked = ships.filter((sh) => sh?.wrecked);
  if (wrecked.length <= (Number(prevWrecks) || 0) && wrecked.length === 0) return null;
  const last = wrecked[wrecked.length - 1];
  if (!last) return null;
  return { along: Number(last.along) || 0.5, lat: Number(last.lat) || 0 };
}

function portedShipPoint(state, prevIn) {
  const ships = Array.isArray(state?.ships) ? state.ships : [];
  const arrived = ships.filter((sh) => sh?.inPort);
  if (arrived.length <= (Number(prevIn) || 0)) return null;
  const last = arrived[arrived.length - 1];
  if (!last) return null;
  return { along: Number(last.along) || 0.9, lat: Number(last.lat) || 0 };
}

/**
 * @param {object} fx
 * @param {object} state
 * @param {number} dt
 * @param {{ reducedMotion?: boolean, right?: object, left?: object }} [opts]
 */
export function syncFx(fx, state, dt, opts = {}) {
  if (!fx) return;
  const reduced = !!opts.reducedMotion;
  const t = Math.max(0, Number(dt) || 0);
  fx.clock += t;

  const playing = state?.status === "playing";
  const phase = state?.phase;
  const over = state?.status === "over" || state?.status === "title";

  if (over) {
    fx.floats.length = 0;
    fx.bits.length = 0;
    fx.statusAlpha = 0;
    fx.statusText = "";
    fx.dailyAlpha = 0;
    fx.lessonAlpha = 0;
    fx.wreckFlash = 0;
    fx.trackGlow = 0;
    fx.placeGlow = 0;
    fx.prev = {
      status: state?.status,
      phase: state?.phase,
      grade: state?.grade,
      score: state?.score,
      wrecks: Number(state?.wrecks) || 0,
      shipsIn: Number(state?.shipsIn) || 0,
    };
    return;
  }

  if (!reduced) {
    if (playing && (phase === "play" || phase === "place")) {
      fx.wavePhase += t * (phase === "play" ? 1.1 : 0.5);
      fx.fogPhase += t * 0.22;
    }
  } else {
    fx.wavePhase = 0;
    fx.fogPhase = 0;
  }

  const placeT = Number(state?.phaseT) || 0;
  const placeTarget = playing && phase === "place" ? Math.min(1, placeT / 1.2) : phase === "play" || phase === "reveal" ? 1 : 0;
  fx.placeGlow += (placeTarget - fx.placeGlow) * (1 - Math.exp(-t / 0.16));

  const wantDaily = !!(playing && phase === "play" && state?.showDaily);
  fx.dailyAlpha += ((wantDaily ? 1 : 0) - fx.dailyAlpha) * (1 - Math.exp(-t / 0.2));

  const wantLesson = !!(playing && phase === "play" && state?.showLesson);
  fx.lessonAlpha += ((wantLesson ? 1 : 0) - fx.lessonAlpha) * (1 - Math.exp(-t / 0.2));

  const wrecks = Number(state?.wrecks) || 0;
  const shipsIn = Number(state?.shipsIn) || 0;
  if (wrecks > (Number(fx.prev?.wrecks) || 0)) {
    fx.wreckFlash = WRECK_FLASH;
    const p = wreckedShipPoint(state, fx.prev?.wrecks);
    if (p) addBits(fx, "wreck", p.along, p.lat, reduced);
  } else {
    fx.wreckFlash = Math.max(0, (Number(fx.wreckFlash) || 0) - t);
  }
  if (shipsIn > (Number(fx.prev?.shipsIn) || 0)) {
    const p = portedShipPoint(state, fx.prev?.shipsIn);
    if (p) addBits(fx, "port", p.along, p.lat, reduced);
  }

  const nextStatus = statusFrom(state, { wreckFlash: fx.wreckFlash });
  if (nextStatus) fx.statusText = nextStatus;
  const wantStatus = nextStatus ? 1 : 0;
  if (!playing || phase !== "play") {
    fx.statusAlpha = 0;
    if (!nextStatus) fx.statusText = "";
  } else {
    fx.statusAlpha += (wantStatus - fx.statusAlpha) * (1 - Math.exp(-t / 0.16));
    if (fx.statusAlpha < 0.02 && !nextStatus) fx.statusText = "";
  }

  const ships = Array.isArray(state?.ships) ? state.ships : [];
  let best = 0;
  let focus = null;
  for (const sh of ships) {
    const tr = shipTrackInst(state, sh);
    if (tr > best) {
      best = tr;
      focus = sh;
    }
  }
  fx.trackGlow += ((best >= 0.45 ? 1 : 0) - fx.trackGlow) * (1 - Math.exp(-t / 0.18));

  if (focus && Number.isFinite(Number(focus.along))) {
    const p = seaPoint(focus.along, focus.lat);
    fx.overlayX = p.x;
    fx.overlayY = p.y;
  } else {
    const port = portMouth(state);
    const p = seaPoint((port.m0 + port.m1) * 0.5, 0);
    fx.overlayX = p.x;
    fx.overlayY = p.y;
  }

  const prevPhase = fx.prev?.phase;
  if (prevPhase !== "reveal" && phase === "reveal") {
    spawnBalloons(fx, state);
  }

  if (playing && (phase === "play" || phase === "reveal")) {
    pushBeamTrail(fx, state);
    pushShipTrails(fx, state);
  }

  const zoomWant = playing && phase === "reveal" && !reduced ? 1.06 : 1;
  fx.revealZoom += (zoomWant - (Number(fx.revealZoom) || 1)) * (1 - Math.exp(-t / 0.28));

  for (let i = fx.bits.length - 1; i >= 0; i--) {
    const p = fx.bits[i];
    p.life -= t;
    p.x += p.vx * t;
    p.y += p.vy * t;
    p.vy += 70 * t;
    p.vx *= Math.exp(-t / 0.45);
    p.rot += p.spin * t;
    if (p.life <= 0) fx.bits.splice(i, 1);
  }
  if (reduced) fx.bits.length = 0;
  if (fx.bits.length > BITS_CAP) fx.bits.splice(0, fx.bits.length - BITS_CAP);

  for (const f of fx.floats) {
    f.age = (Number(f.age) || 0) + t;
  }

  fx.prev = {
    status: state?.status,
    phase: state?.phase,
    grade: state?.grade,
    score: state?.score,
    wrecks,
    shipsIn,
  };
}

export function revealZoom(fx, reduced) {
  if (!fx) return 1;
  const z = Number(fx.revealZoom) || 1;
  if (reduced) return Math.min(z, 1.02);
  return z;
}

export function overlayCenter(fx) {
  return {
    x: Number(fx?.overlayX) || 400,
    y: Number(fx?.overlayY) || 150,
  };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} fx
 * @param {{ sx: Function, sy: Function, px: Function, reducedMotion?: boolean }} view
 * @param {object} [state]
 */
export function drawFx(ctx, fx, view, state) {
  if (!fx) return;
  const reduced = !!view.reducedMotion;
  const sx = (x) => view.sx(x);
  const sy = (y) => view.sy(y);
  const px = (w) => view.px(w);

  for (const p of fx.bits) {
    const u = Math.max(0, Math.min(1, p.life / (p.max || 1)));
    ctx.save();
    ctx.translate(sx(p.x), sy(p.y));
    ctx.rotate(p.rot || 0);
    ctx.globalAlpha = 0.3 + 0.55 * u;
    ctx.fillStyle = p.color || "#d8c89a";
    ctx.beginPath();
    ctx.ellipse(0, 0, px(p.r * 1.1), px(p.r * 1.5), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function pill(text, x, y, alpha, size = 13) {
    if (alpha <= 0.04 || !text) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.font = `700 ${Math.max(11, px(size))}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const tw = ctx.measureText(text).width;
    const padX = 8;
    const padY = 4;
    const h = Math.max(16, px(size + 2));
    ctx.fillStyle = rgba("#eef2f4", 0.94);
    ctx.strokeStyle = rgba("#1c2430", 0.58);
    ctx.lineWidth = Math.max(1.2, px(1.25));
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x - tw / 2 - padX, y - h / 2 - padY, tw + padX * 2, h + padY * 2, 6);
    } else {
      ctx.rect(x - tw / 2 - padX, y - h / 2 - padY, tw + padX * 2, h + padY * 2);
    }
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1c2430";
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  const playing = state?.status === "playing";
  const phase = state?.phase;
  if (playing && phase === "play") {
    const cx = sx(400);
    if (fx.dailyAlpha > 0.04) {
      pill(dailyCondition(state?.params), cx, sy(56), fx.dailyAlpha, 12);
    }
    if (fx.lessonAlpha > 0.04) {
      const ly = fx.dailyAlpha > 0.12 ? 84 : 64;
      pill(LESSON_TEXT, cx, sy(ly), fx.lessonAlpha, 16);
      pill(LESSON_SUB, cx, sy(ly + 24), fx.lessonAlpha * 0.95, 13);
    }
    if (fx.statusAlpha > 0.05 && fx.statusText) {
      const pulse =
        reduced || fx.statusText !== "導いている"
          ? 1
          : 1 + 0.03 * Math.sin((Number(fx.clock) || 0) * Math.PI * 2 * 2.0);
      ctx.save();
      ctx.translate(cx, sy(118));
      ctx.scale(pulse, pulse);
      pill(fx.statusText, 0, 0, fx.statusAlpha, 15);
      ctx.restore();
    }
  }

  const over = overlayCenter(fx);
  const bx = clamp(over.x, 220, 640);
  const by = clamp(over.y - JUDGE_BALLOON_OFFSET, 48, 210);
  const showBalloons = playing && phase === "reveal";
  for (let i = 0; showBalloons && i < fx.floats.length; i++) {
    const f = fx.floats[i];
    const age = Number(f.age) || 0;
    let pop = 1;
    if (!reduced) {
      if (age < 0.12) pop = 0.7 + 0.55 * (age / 0.12);
      else if (age < 0.22) pop = 1.25 - 0.25 * ((age - 0.12) / 0.1);
      else pop = 1;
    }
    const fade = Math.min(1, age / 0.08);
    const lift = reduced ? 0 : Math.min(8, age * 10);
    const row = f.kind === "grade" ? 0 : 22;
    const x = sx(bx);
    const y = sy(by + row) - px(lift);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    ctx.globalAlpha = fade;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const size = f.kind === "grade" ? Math.max(16, px(20)) : Math.max(13, px(15));
    ctx.font = `700 ${size}px ${FONT}`;
    const tw = ctx.measureText(f.text).width;
    ctx.fillStyle = rgba("#eef2f4", 0.92);
    const padX = 8;
    const padY = 4;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(-tw / 2 - padX, -size / 2 - padY, tw + padX * 2, size + padY * 2, 6);
    } else {
      ctx.rect(-tw / 2 - padX, -size / 2 - padY, tw + padX * 2, size + padY * 2);
    }
    ctx.fill();
    ctx.fillStyle = f.color || "#1c2430";
    ctx.fillText(f.text, 0, 0);
    ctx.restore();
  }
}
