/** Hit box → blasting, air. Checkable pure functions. */

import {
  AIR_USE,
  HORN_CX,
  HORN_CY,
  HORN_HOLD,
  START_AIR,
  clamp,
  isHornHit,
  pointOnHorn,
} from "./constants.mjs";

export { isHornHit, pointOnHorn, HORN_HOLD };

export function emptyHorn() {
  return {
    blasting: false,
    blastT: 0,
  };
}

/**
 * Update horn from a right-hand sample.
 * blasting is true only while the pointer is held inside the 56×56 hit.
 * When inactive, blasting stops and blastT resets. Air is integrated by the caller.
 */
export function updateHorn(right, pos, dt, active) {
  const next = {
    intensity: clamp(Number(right?.intensity) || 0, 0, 1),
    intensityDes: clamp(Number(right?.intensityDes) ?? Number(right?.intensity) ?? 0, 0, 1),
    blasting: false,
    blastT: Number(right?.blastT) || 0,
  };
  const step = Math.max(0, Number(dt) || 0);
  const on = !!(active && pos && isHornHit(pos.x, pos.y));
  if (on) {
    next.blasting = true;
    next.blastT = (Number(right?.blasting) ? next.blastT : 0) + step;
    next.intensityDes = next.intensity;
  } else {
    next.blasting = false;
    next.blastT = 0;
  }
  return next;
}

/** Integrate air use. Call only during play in landscape, and only while blasting. */
export function integrateAir(air, blasting, dt) {
  const step = Math.max(0, Number(dt) || 0);
  let a = clamp(Number(air) ?? START_AIR, 0, 1);
  if (blasting && step > 0) a -= AIR_USE * step;
  return clamp(a, 0, 1);
}

void HORN_CX;
void HORN_CY;
