/** Positions → intensity, oil. Checkable pure functions. */

import {
  LAMP_CX,
  LAMP_TAU,
  OIL_RESIDUE,
  OIL_USE,
  START_INT,
  START_OIL,
  clamp,
  intensityDesired,
  pointOnLamp,
  yFromIntensity,
} from "./constants.mjs";

export { intensityDesired, pointOnLamp, yFromIntensity };

export function emptyRightLamp() {
  return {
    intensity: START_INT,
    intensityDes: START_INT,
  };
}

/**
 * Update intensity from a right-hand sample on the groove.
 * When inactive (or while the horn is being used), intensity stays.
 */
export function updateLamp(right, pos, dt, active) {
  const next = {
    intensity: clamp(Number(right?.intensity) || 0, 0, 1),
    intensityDes: clamp(Number(right?.intensityDes) ?? Number(right?.intensity) ?? START_INT, 0, 1),
    blasting: !!right?.blasting,
    blastT: Number(right?.blastT) || 0,
  };
  const step = Math.max(0, Number(dt) || 0);
  if (!active || !pos) {
    next.intensityDes = next.intensity;
    return next;
  }
  const des = intensityDesired(pos.y);
  next.intensityDes = des;
  if (step > 0) {
    next.intensity += (des - next.intensity) * (1 - Math.exp(-step / LAMP_TAU));
    next.intensity = clamp(next.intensity, 0, 1);
  }
  return next;
}

/** Integrate oil use. Call only during play in landscape. */
export function integrateOil(oil, intensity, dt) {
  const step = Math.max(0, Number(dt) || 0);
  let o = clamp(Number(oil) ?? START_OIL, 0, 1);
  const i = clamp(Number(intensity) || 0, 0, 1);
  if (step > 0) o -= OIL_USE * (i ** 1.15) * step;
  return clamp(o, 0, 1);
}

export function capIntensityForOil(intensity, oil) {
  const i = clamp(Number(intensity) || 0, 0, 1);
  if ((Number(oil) || 0) > 0) return i;
  return Math.min(i, OIL_RESIDUE);
}

export function pointOnStartLamp() {
  return pointOnLamp(START_INT);
}

void LAMP_CX;
