/** Dimensions, zones, time constants, beam / oil / horn, grades, and storage keys. Y is down in wu. */

export const VIEW_W = 844;
export const VIEW_H = 390;

export const LEFT_X0 = 0;
export const LEFT_X1 = 400;
export const LEFT_Y0 = 44;
export const LEFT_Y1 = 390;

export const RIGHT_X0 = 444;
export const RIGHT_X1 = 844;
export const RIGHT_Y0 = 44;
export const RIGHT_Y1 = 390;
/** After assignment only: play.mjs may keep the right pointer this far past the edge. */
export const RIGHT_EDGE_SLACK = 24;

export const ARC_CX = 188;
export const ARC_CY = 312;
export const ARC_R = 102;
export const ARC_WIDTH = 52;
export const ARC_HALF = ARC_WIDTH / 2;
export const ARC_SLACK = 24;
export const LENS_CX = ARC_CX;
export const LENS_CY = ARC_CY;
export const LENS_R = ARC_R;
export const LENS_WIDTH = ARC_WIDTH;

export const LAMP_CX = 600;
export const LAMP_CY = 268;
export const GROOVE_W = 56;
export const GROOVE_H = 200;
export const GROOVE_Y1 = 368;
export const GROOVE_Y0 = GROOVE_Y1 - GROOVE_H;
export const LEVER_CX = LAMP_CX;
export const LEVER_CY = LAMP_CY;
export const LAMP_Y1 = GROOVE_Y1;

export const HORN_CX = 748;
export const HORN_CY = 268;
export const HORN_SIZE = 56;
export const HORN_W = HORN_SIZE;
export const HORN_HALF = HORN_SIZE / 2;

export const TAP_PATH = 10;
export const TAP_HOLD = 0.12;

export const PLACE_TIME = 1.2;
export const PLAY_TIME = 75;
export const FINISH_MIN = 22;
export const FINISH_MIN_TIME = FINISH_MIN;
export const REVEAL_TIME = 1.6;
export const DAILY_HINT_TIME = 2.5;
export const LESSON_HINT_TIME = 3.2;
export const FIXED_DT = 1 / 60;
export const MAX_DT = 0.05;

export const OIL_LOW = 0.22;
export const NEAR_TIME = 0.8;
export const TRACK_PORT = 0.55;
export const KEEP_BAND = 0.2;
export const KEEP_IDLE_LO = 0.28;
export const KEEP_IDLE_HI = 0.7;
export const HORN_WINDOW = 0.1;
export const HORN_HOLD = 0.35;
export const HULL_R = 0.035;
export const MISS_CREDIT = 0.35;

/** Course geometry for bearing: range shrinks toward the port, lat is perpendicular. */
export const RANGE0 = 1.15;
export const RANGE1 = 0.28;
export const LAT_SCALE = 1;
/** Lighthouse sits beside the course so a centre-line ship’s bearing changes as it nears the port. */
export const LH_X = 0.48;
export const LH_Y = 0;

export const SHIP_DUR_MIN = 16;
export const SHIP_DUR_MAX = 20;
export const SHIP_GAP_MIN = 10;
export const SHIP_GAP_MAX = 16;
export const PORT_M0_MIN = 0.86;
export const PORT_M0_MAX = 0.96;
export const PORT_W_MIN = 1.6;
export const PORT_W_MAX = 2.2;
export const PORT_HALF_W_MIN = 0.1;
export const PORT_HALF_W_MAX = 0.13;
export const DRIFT_MUL_JITTER = 0.04;
export const APPEAR_JITTER = 0.2;
export const REEF_R_MIN = 0.04;
export const REEF_R_MAX = 0.055;
export const REEF_LAT_MIN = 0.16;
export const REEF_LAT_MAX = 0.22;

/** Design defaults (§3). Phase 2 may retune within ±35%. */
export const DESIGN_LENS_TAU = 0.18;
export const DESIGN_LAMP_TAU = 0.12;
export const DESIGN_HEADING_MAX = 1.4;
export const DESIGN_START_HEAD = 0;
export const DESIGN_START_INT = 0.36;
export const DESIGN_OIL_USE = 0.016;
export const DESIGN_AIR_USE = 0.28;
export const DESIGN_OIL_RESIDUE = 0.12;
export const DESIGN_BEAM_INNER = 0.22;
export const DESIGN_BEAM_OUTER = 0.48;
export const DESIGN_DRIFT_GAIN = 0.22;
export const DESIGN_STEER_GAIN = 0.55;
export const DESIGN_HORN_IMPULSE = 0.18;
export const DESIGN_PORT_HOLD = 1.4;
export const DESIGN_CURR_AMP = 0.1;
export const DESIGN_CURR_PERIOD = 12;
export const DESIGN_WAND_AMP = 0.04;
export const DESIGN_WAND_PERIOD = 5.2;
export const DESIGN_CURR_BIAS = 0.03;

export const LENS_TAU = 0.18;
export const LAMP_TAU = 0.12;
export const HEADING_MAX = 1.4;
export const START_HEAD = 0;
export const START_INT = 0.36;
export const START_OIL = 1;
export const START_AIR = 1;
export const OIL_USE = 0.016;
export const AIR_USE = 0.28;
export const OIL_RESIDUE = 0.12;
export const BEAM_INNER = 0.17;
export const BEAM_OUTER = 0.40;
export const DRIFT_GAIN = 0.24;
export const STEER_GAIN = 0.66;
export const HORN_IMPULSE = 0.243;
export const PORT_HOLD = 1.4;
export const CURR_AMP = 0.125;
export const CURR_PERIOD = 12;
export const WAND_AMP = 0.04;
export const WAND_PERIOD = 5.2;
export const CURR_BIAS = 0.03;

export const FOG_TABLE = {
  thin: {
    fog: "thin",
    ships: [2, 2],
    reefs: [1, 2],
    firstReef: 12,
    firstShip: [6.4, 7.8],
    lightNeed: 0.32,
    driftMul: 0.78,
    fogMul: 0.45,
  },
  normal: {
    fog: "normal",
    ships: [3, 3],
    reefs: [2, 3],
    firstReef: 8,
    firstShip: [5.0, 6.4],
    lightNeed: 0.5,
    driftMul: 1.0,
    fogMul: 1.0,
  },
  thick: {
    fog: "thick",
    ships: [3, 4],
    reefs: [3, 5],
    firstReef: 6,
    firstShip: [4.0, 5.4],
    lightNeed: 0.72,
    driftMul: 1.18,
    fogMul: 1.55,
  },
};

export const SCORE_LOFTY = 88;
export const SCORE_GOOD = 72;
export const SCORE_CLOSE = 55;
export const SCORE_OFF = 32;

export const DESIGN_SCORE_GUIDE = 0.4;
export const DESIGN_SCORE_TRACK = 0.32;
export const DESIGN_SCORE_KEEP = 0.14;
export const DESIGN_SCORE_CARE = 0.14;
export const DESIGN_KEEP_BAND = 0.2;
export const DESIGN_TRACK_NEED_MUL = 1;

export const SCORE_GUIDE = 0.4;
export const SCORE_TRACK = 0.32;
export const SCORE_KEEP = 0.1;
export const SCORE_CARE = 0.14;
/** Track / steer / port may light a little under the day's need (keep still uses the full need). */
export const TRACK_NEED_MUL = 0.78;
export const CARE_WRECK = 0.34;
export const CARE_MISS = 0.24;
export const CARE_OIL = 0.22;
export const CARE_BLAST = 0.2;

export const JUDGE_BALLOON_OFFSET = 70;

export const STORAGE_BEST = "toudai-hikari:bestScore";
export const STORAGE_DAILY_PREFIX = "toudai-hikari:daily:";
export const STORAGE_MUTED = "toudai-hikari:muted";
export const SEED_PREFIX = "toudai-hikari:";

export const FOG_LABELS = { thin: "薄い", normal: "ふつう", thick: "濃い" };

export const GRADE_LABELS = {
  lofty: "よく導いた",
  good: "よい灯",
  close: "おしい",
  off: "それた",
  early: "まだ早い",
};

export const GRADE_BALLOONS = {
  lofty: "よく導いた！",
  good: "よい灯",
  close: "おしい",
  off: "それた",
  early: "まだ早い",
};

export const GRADE_SHARE = {
  lofty: "よく導いた",
  good: "よい灯",
  close: "おしい",
  off: "それた",
  early: "まだ早い",
};

export const GRADE_RESULT = {
  lofty: "よく導いた船",
  good: "よい灯",
  close: "おしい",
  off: "それた",
  early: "まだ早い",
};

export function seedString(dateJst) {
  return SEED_PREFIX + dateJst;
}

export function dailyKey(dateJst) {
  return STORAGE_DAILY_PREFIX + dateJst;
}

export function gradeForScore(score) {
  const s = Number(score) || 0;
  if (s >= SCORE_LOFTY) return "lofty";
  if (s >= SCORE_GOOD) return "good";
  if (s >= SCORE_CLOSE) return "close";
  if (s >= SCORE_OFF) return "off";
  return "early";
}

export function clamp(x, lo, hi) {
  const n = Number(x);
  if (!Number.isFinite(n)) return lo;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function wrapAngle(d) {
  let a = Number(d) || 0;
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

export function angleAbs(a, b) {
  return Math.abs(wrapAngle((Number(a) || 0) - (Number(b) || 0)));
}

/** Course range at a given along (far at 0, near the port at 1). */
export function rangeAt(along) {
  const u = clamp(along, 0, 1);
  return RANGE0 * (1 - u) + RANGE1 * u;
}

export function headingDesired(x, y) {
  const dx = Number(x) - ARC_CX;
  const dy = Number(y) - ARC_CY;
  return clamp(Math.atan2(dx, -dy), -HEADING_MAX, HEADING_MAX);
}

export function pointOnArc(heading, r = ARC_R) {
  const h = clamp(Number(heading) || 0, -HEADING_MAX, HEADING_MAX);
  const rad = Number(r) || ARC_R;
  return { x: ARC_CX + rad * Math.sin(h), y: ARC_CY - rad * Math.cos(h) };
}

export function intensityDesired(y) {
  return clamp((GROOVE_Y1 - Number(y)) / GROOVE_H, 0, 1);
}

export function yFromIntensity(intensity) {
  return GROOVE_Y1 - clamp(intensity, 0, 1) * GROOVE_H;
}

export function pointOnLamp(intensity, xOff = 0) {
  return { x: LAMP_CX + xOff, y: yFromIntensity(intensity) };
}

export function isHornHit(x, y) {
  return Math.hypot(Number(x) - HORN_CX, Number(y) - HORN_CY) <= HORN_HALF + 1e-12;
}

export function pointOnHorn() {
  return { x: HORN_CX, y: HORN_CY };
}

/** 1 when |heading-bearing| ≤ inner, 0 when ≥ outer, linear between. */
export function beamFactor(heading, bearing) {
  const d = angleAbs(heading, bearing);
  if (d <= BEAM_INNER + 1e-12) return 1;
  if (d >= BEAM_OUTER - 1e-12) return 0;
  return 1 - (d - BEAM_INNER) / (BEAM_OUTER - BEAM_INNER);
}

/** Effective intensity needed to count as lighting a ship (keep still uses the full need). */
export function trackNeed(lightNeed) {
  const need = Number(lightNeed) || 0;
  // Ease only heavy-fog days (need 0.72). Thin / normal keep the designed gate,
  // so a 0.55 lamp does not also get a free pass on ordinary days.
  if (need + 1e-12 >= 0.6) return need * TRACK_NEED_MUL;
  return need;
}

export function meetsLightNeed(intensity, lightNeed) {
  return (Number(intensity) || 0) + 1e-12 >= trackNeed(lightNeed);
}

/**
 * keepInst: in-band when a ship is trackable, otherwise prefer a dim lamp.
 */
export function keepInst(intensity, lightNeed, hasTarget) {
  const i = Number(intensity) || 0;
  if (hasTarget) {
    const need = Number(lightNeed) || 0;
    if (i + 1e-12 < need) return 0;
    const hi = need + KEEP_BAND;
    if (i <= hi + 1e-12) return 1;
    const span = Math.max(1e-9, 1 - hi);
    return clamp(1 - (i - hi) / span, 0, 1);
  }
  if (i <= KEEP_IDLE_LO + 1e-12) return 1;
  if (i >= KEEP_IDLE_HI - 1e-12) return 0;
  return 1 - (i - KEEP_IDLE_LO) / (KEEP_IDLE_HI - KEEP_IDLE_LO);
}
