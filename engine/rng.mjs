/** 32-bit seed hash and state-passing Mulberry32. No global or closed-over state. */

export function hashSeed(seed) {
  if (typeof seed === "number" && Number.isFinite(seed)) return seed >>> 0;
  const s = String(seed);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * One Mulberry32 step.
 * @param {number} a uint32 state
 * @returns {{ value: number, a: number }} value in [0, 1), a is next uint32 state
 */
export function rngStep(a) {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, a: a >>> 0 };
}

/** Draw a float in [min, max) and return the new state. */
export function rngRange(a, min, max) {
  const step = rngStep(a);
  return { value: min + (max - min) * step.value, a: step.a };
}

export function hash32(s) {
  return hashSeed(s);
}

/** Standard normal via Box–Muller. Deterministic in the rng state. */
export function rngGauss(a) {
  let s = rngStep(a);
  let u = s.value;
  a = s.a;
  while (u === 0) {
    s = rngStep(a);
    u = s.value;
    a = s.a;
  }
  s = rngStep(a);
  let v = s.value;
  a = s.a;
  while (v === 0) {
    s = rngStep(a);
    v = s.value;
    a = s.a;
  }
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return { value: z, a };
}
