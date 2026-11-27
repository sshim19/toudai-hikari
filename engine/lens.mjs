/** Positions → heading. Checkable pure functions. */

import {
  ARC_CX,
  ARC_CY,
  ARC_HALF,
  ARC_R,
  ARC_SLACK,
  HEADING_MAX,
  LENS_TAU,
  START_HEAD,
  TAP_HOLD,
  TAP_PATH,
  clamp,
  headingDesired,
  pointOnArc,
} from "./constants.mjs";

export { headingDesired, pointOnArc };

export function emptyLeft() {
  return {
    heading: START_HEAD,
    headingDes: START_HEAD,
    path: 0,
    holdT: 0,
    px: ARC_CX,
    py: ARC_CY - ARC_R,
    hasPrev: false,
  };
}

export function radialOnArc(x, y, slack = 0) {
  const r = Math.hypot(Number(x) - ARC_CX, Number(y) - ARC_CY);
  const lo = ARC_R - ARC_HALF - slack;
  const hi = ARC_R + ARC_HALF + slack;
  return r >= lo - 1e-12 && r <= hi + 1e-12;
}

/**
 * Update heading from a left-hand sample.
 * The target is the contact angle (straight up is 0, clockwise is positive).
 * When inactive, heading stays (no snap back). A short tap (path < 10wu
 * and hold under TAP_HOLD) does not change heading.
 */
export function updateLens(left, pos, dt, active) {
  const next = {
    heading: clamp(Number(left?.heading) || 0, -HEADING_MAX, HEADING_MAX),
    headingDes: clamp(Number(left?.headingDes) || 0, -HEADING_MAX, HEADING_MAX),
    path: Number(left?.path) || 0,
    holdT: Number(left?.holdT) || 0,
    px: Number(left?.px) || ARC_CX,
    py: Number(left?.py) || ARC_CY - ARC_R,
    hasPrev: !!left?.hasPrev,
  };
  const step = Math.max(0, Number(dt) || 0);

  if (!active || !pos || !radialOnArc(pos.x, pos.y, ARC_SLACK)) {
    next.hasPrev = false;
    next.path = 0;
    next.holdT = 0;
    next.headingDes = next.heading;
    return next;
  }

  if (next.hasPrev) next.path += Math.hypot(Number(pos.x) - next.px, Number(pos.y) - next.py);
  next.holdT += step;
  next.px = Number(pos.x);
  next.py = Number(pos.y);
  next.hasPrev = true;

  const isTap = next.path < TAP_PATH && next.holdT < TAP_HOLD;
  if (!isTap) next.headingDes = headingDesired(pos.x, pos.y);
  if (step > 0) {
    next.heading += (next.headingDes - next.heading) * (1 - Math.exp(-step / LENS_TAU));
    next.heading = clamp(next.heading, -HEADING_MAX, HEADING_MAX);
  }
  return next;
}
