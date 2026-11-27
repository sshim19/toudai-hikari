/**
 * Web Audio だけで鳴らす効果音。ファイルもライブラリも使わない。
 * エンジンは触らず、state の変化から鳴らす音を決める。海の夜の、落ち着いた灯台の音にする。
 */

import * as constants from "../engine/constants.mjs";

export const MUTE_KEY = constants.STORAGE_MUTED ?? "toudai-hikari:muted";
const MASTER_GAIN = 0.34;
const BEAM_INNER = constants.BEAM_INNER ?? 0.22;
const BEAM_OUTER = constants.BEAM_OUTER ?? 0.48;
const HORN_WINDOW = constants.HORN_WINDOW ?? 0.1;

function readMuted(storage) {
  if (!storage) return false;
  try {
    const v = storage.getItem(MUTE_KEY);
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}

function writeMuted(muted, storage) {
  if (!storage) return;
  try {
    storage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadMuted(storage = globalThis.localStorage) {
  return readMuted(storage);
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function liveShips(state) {
  return Array.isArray(state?.ships) ? state.ships : [];
}

function trackableShips(state) {
  const playT = Number(state?.playT) || 0;
  return liveShips(state).filter((sh) => {
    if (!sh || sh.inPort || sh.wrecked || sh.missed) return false;
    const appear = Number(sh.appearT);
    if (Number.isFinite(appear) && playT < appear) return false;
    return true;
  });
}

function headingOf(state) {
  return Number(state?.left?.heading) || 0;
}

function intensityOf(state) {
  const v = Number(state?.right?.intensity);
  return Number.isFinite(v) ? v : 0;
}

function lightNeedOf(state) {
  const v = Number(state?.params?.lightNeed);
  return Number.isFinite(v) ? v : 0.5;
}

export function shipTrackInst(state, ship) {
  if (!ship) return 0;
  const need = lightNeedOf(state);
  if (intensityOf(state) < need) return 0;
  const bearing = Number(ship.bearing);
  if (!Number.isFinite(bearing)) return 0;
  const d = Math.abs(headingOf(state) - bearing);
  if (d <= BEAM_INNER) return 1;
  if (d >= BEAM_OUTER) return 0;
  return 1 - (d - BEAM_INNER) / (BEAM_OUTER - BEAM_INNER);
}

export function maxTrackInst(state) {
  const list = trackableShips(state);
  if (!list.length) return 0;
  let best = 0;
  for (const sh of list) best = Math.max(best, shipTrackInst(state, sh));
  return best;
}

export function hornWindowOpen(state) {
  if (!state?.right?.blasting) return false;
  const reefs = Array.isArray(state?.params?.reefs) ? state.params.reefs : [];
  if (!reefs.length) return false;
  for (const sh of trackableShips(state)) {
    const along = Number(sh.along);
    if (!Number.isFinite(along)) continue;
    for (const reef of reefs) {
      if (Math.abs(along - (Number(reef.along) || 0)) <= HORN_WINDOW) return true;
    }
  }
  return false;
}

function snapshot(state) {
  const ships = liveShips(state);
  return {
    status: state?.status || "title",
    phase: state?.phase || "place",
    grade: state?.grade ?? null,
    score: Math.max(0, Math.floor(Number(state?.score) || 0)),
    seed: state?.seed || state?.dateJst || "",
    playT: Number(state?.playT) || 0,
    wrecks: Number(state?.wrecks) || ships.filter((s) => s?.wrecked).length,
    shipsIn: Number(state?.shipsIn) || ships.filter((s) => s?.inPort).length,
    oilOut: !!state?.oilOut,
    oil: Number.isFinite(Number(state?.oil)) ? Number(state.oil) : 1,
    blasting: !!state?.right?.blasting,
    heading: headingOf(state),
    intensity: intensityOf(state),
    trackInst: Number.isFinite(Number(state?.trackInst)) ? Number(state.trackInst) : maxTrackInst(state),
    hornWindow: state?.hornWindow != null ? !!state.hornWindow : hornWindowOpen(state),
  };
}

/**
 * 直前の snapshot と新しい state から、鳴らすべき単発の音を決める。純関数。
 * @returns {{
 *   type: "place"|"wreck"|"port"|"oilOut"|"track"|"lamp"|"reveal",
 *   grade?: string,
 *   score?: number
 * } | null}
 */
export function soundEvent(prev, state) {
  if (!state) return null;
  const now = snapshot(state);
  const before = prev || {
    status: "idle",
    phase: "none",
    wrecks: 0,
    shipsIn: 0,
    oilOut: false,
    intensity: now.intensity,
    trackInst: 0,
  };

  if (
    now.status === "playing" &&
    now.phase === "place" &&
    (before.status !== "playing" || before.phase !== "place")
  ) {
    return { type: "place" };
  }

  if (before.phase !== "reveal" && now.phase === "reveal") {
    return { type: "reveal", grade: now.grade || "early", score: now.score };
  }
  if (before.status !== "over" && now.status === "over" && before.phase !== "reveal") {
    return { type: "reveal", grade: now.grade || "early", score: now.score };
  }

  if (now.wrecks > (Number(before.wrecks) || 0)) return { type: "wreck" };
  if (now.shipsIn > (Number(before.shipsIn) || 0)) return { type: "port" };
  if (!before.oilOut && now.oilOut) return { type: "oilOut" };
  if ((Number(before.trackInst) || 0) < 0.45 && now.trackInst >= 0.55) {
    return { type: "track" };
  }
  if (
    now.status === "playing" &&
    now.phase === "play" &&
    Math.abs(now.intensity - (Number(before.intensity) || 0)) >= 0.12
  ) {
    return { type: "lamp" };
  }

  return null;
}

export function createSfx() {
  return {
    prev: null,
    muted: loadMuted(),
    ctx: null,
    master: null,
    compressor: null,
    noiseBuf: null,
    waveSrc: null,
    waveFilter: null,
    waveGain: null,
    lampOsc: null,
    lampGain: null,
    hornOscA: null,
    hornOscB: null,
    hornFilter: null,
    hornGain: null,
    lastRotateAt: 0,
    lastLampAt: 0,
  };
}

export function resetSfx(sfx) {
  if (!sfx) return;
  sfx.prev = null;
  sfx.lastRotateAt = 0;
  sfx.lastLampAt = 0;
  stopLoops(sfx, true);
}

function applyMuteGain(sfx, now) {
  if (!sfx?.master || !sfx.ctx) return;
  const g = sfx.master.gain;
  const t = now ?? sfx.ctx.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(sfx.muted ? 0 : MASTER_GAIN, t + 0.03);
}

export function setMuted(sfx, muted, storage = globalThis.localStorage) {
  if (!sfx) return;
  sfx.muted = !!muted;
  writeMuted(sfx.muted, storage);
  applyMuteGain(sfx);
}

export function isMuted(sfx) {
  return !!sfx?.muted;
}

/** 最初の操作で AudioContext を作り、iOS 向けに resume する。 */
export function unlockSfx(sfx) {
  if (!sfx) return;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return;
  try {
    if (!sfx.ctx) {
      const ctx = new AC();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 12;
      compressor.ratio.value = 2.8;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.18;
      const master = ctx.createGain();
      master.gain.value = sfx.muted ? 0 : MASTER_GAIN;
      master.connect(compressor);
      compressor.connect(ctx.destination);
      sfx.ctx = ctx;
      sfx.master = master;
      sfx.compressor = compressor;
    }
    if (sfx.ctx.state === "suspended") {
      const p = sfx.ctx.resume();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
  } catch {
    /* AudioContext unavailable */
  }
}

function noiseBuffer(sfx) {
  if (sfx.noiseBuf) return sfx.noiseBuf;
  const ctx = sfx.ctx;
  const len = Math.floor(ctx.sampleRate * 1.3);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = last * 0.86 + white * 0.14;
    data[i] = last;
  }
  sfx.noiseBuf = buf;
  return buf;
}

function playTone(ctx, dest, { freq, type = "sine", t0, dur, peak, attack = 0.012, endFreq }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(dest);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function playNoiseBurst(sfx, { t0, dur, peak, hp = 400, lp = 1800, attack = 0.008 }) {
  const ctx = sfx.ctx;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(sfx);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = (hp + lp) * 0.5;
  filter.Q.value = 0.7;
  const hip = ctx.createBiquadFilter();
  hip.type = "highpass";
  hip.frequency.value = hp;
  const low = ctx.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.value = lp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(hip);
  hip.connect(low);
  low.connect(g);
  g.connect(sfx.master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
  return filter;
}

function hashSeed(s) {
  const str = String(s || "toudai-hikari");
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seedShift(seed) {
  const h = hashSeed(seed);
  return ((h % 17) - 8) / 80;
}

function playPlace(sfx, seed) {
  const ctx = sfx.ctx;
  const t0 = ctx.currentTime;
  const d = seedShift(seed);
  playNoiseBurst(sfx, { t0, dur: 0.28, peak: 0.07, hp: 200, lp: 900, attack: 0.03 });
  playTone(ctx, sfx.master, { freq: 180 + d * 40, type: "triangle", t0, dur: 0.32, peak: 0.05, attack: 0.04, endFreq: 260 + d * 30 });
}

function playWreck(sfx) {
  const ctx = sfx.ctx;
  const t0 = ctx.currentTime;
  playNoiseBurst(sfx, { t0, dur: 0.22, peak: 0.1, hp: 80, lp: 420, attack: 0.008 });
  playTone(ctx, sfx.master, { freq: 92, type: "sine", t0, dur: 0.28, peak: 0.08, attack: 0.01, endFreq: 48 });
}

function playPort(sfx, seed) {
  const ctx = sfx.ctx;
  const t0 = ctx.currentTime;
  const d = seedShift(seed);
  playTone(ctx, sfx.master, { freq: 492 + d * 30, type: "sine", t0, dur: 0.55, peak: 0.055, attack: 0.01 });
  playTone(ctx, sfx.master, { freq: 738 + d * 40, type: "sine", t0: t0 + 0.04, dur: 0.42, peak: 0.03, attack: 0.012 });
}

function playOilOut(sfx) {
  const ctx = sfx.ctx;
  const t0 = ctx.currentTime;
  playNoiseBurst(sfx, { t0, dur: 0.35, peak: 0.05, hp: 120, lp: 700, attack: 0.02 });
  playTone(ctx, sfx.master, { freq: 240, type: "triangle", t0, dur: 0.4, peak: 0.04, attack: 0.02, endFreq: 90 });
}

function playTrack(sfx) {
  const ctx = sfx.ctx;
  const t0 = ctx.currentTime;
  playNoiseBurst(sfx, { t0, dur: 0.22, peak: 0.035, hp: 200, lp: 800, attack: 0.02 });
  playTone(ctx, sfx.master, { freq: 196, type: "sine", t0, dur: 0.28, peak: 0.03, attack: 0.02, endFreq: 160 });
}

function playLamp(sfx) {
  const ctx = sfx.ctx;
  const t0 = ctx.currentTime;
  playNoiseBurst(sfx, { t0, dur: 0.16, peak: 0.04, hp: 180, lp: 1100, attack: 0.018 });
}

function playRotateTick(sfx, rate) {
  const ctx = sfx.ctx;
  const now = ctx.currentTime;
  const interval = clamp(0.16 - rate * 0.08, 0.07, 0.16);
  if (now - (sfx.lastRotateAt || 0) < interval) return;
  sfx.lastRotateAt = now;
  const peak = clamp(0.012 + rate * 0.03, 0.01, 0.045);
  playTone(ctx, sfx.master, { freq: 520, type: "triangle", t0: now, dur: 0.06, peak, attack: 0.004, endFreq: 380 });
  playTone(ctx, sfx.master, { freq: 1240, type: "sine", t0: now, dur: 0.05, peak: peak * 0.45, attack: 0.003 });
}

function playReveal(sfx, ev) {
  const ctx = sfx.ctx;
  const t0 = ctx.currentTime;
  playNoiseBurst(sfx, { t0, dur: 0.7, peak: 0.055, hp: 60, lp: 380, attack: 0.05 });
  playTone(ctx, sfx.master, { freq: 160, type: "sine", t0, dur: 0.55, peak: 0.03, attack: 0.04, endFreq: 90 });
  const grade = ev?.grade || "early";
  if (grade === "lofty") {
    playTone(ctx, sfx.master, { freq: 524, type: "sine", t0: t0 + 0.18, dur: 0.7, peak: 0.06, attack: 0.02 });
    playTone(ctx, sfx.master, { freq: 784, type: "sine", t0: t0 + 0.28, dur: 0.7, peak: 0.045, attack: 0.02 });
  } else if (grade === "good") {
    playTone(ctx, sfx.master, { freq: 440, type: "sine", t0: t0 + 0.18, dur: 0.65, peak: 0.055, attack: 0.02 });
    playTone(ctx, sfx.master, { freq: 660, type: "sine", t0: t0 + 0.28, dur: 0.6, peak: 0.035, attack: 0.02 });
  } else if (grade === "close") {
    playTone(ctx, sfx.master, { freq: 196, type: "sine", t0: t0 + 0.14, dur: 0.45, peak: 0.05, attack: 0.02 });
  } else {
    playNoiseBurst(sfx, { t0: t0 + 0.08, dur: 0.12, peak: 0.045, hp: 200, lp: 900, attack: 0.01 });
  }
}

function ensureLoops(sfx) {
  const ctx = sfx.ctx;
  if (!ctx || !sfx.master) return;
  if (!sfx.waveGain) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(sfx);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(filter);
    filter.connect(g);
    g.connect(sfx.master);
    src.start();
    sfx.waveSrc = src;
    sfx.waveFilter = filter;
    sfx.waveGain = g;
  }
  if (!sfx.lampGain) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 110;
    const g = ctx.createGain();
    g.gain.value = 0;
    osc.connect(g);
    g.connect(sfx.master);
    osc.start();
    sfx.lampOsc = osc;
    sfx.lampGain = g;
  }
  if (!sfx.hornGain) {
    const a = ctx.createOscillator();
    const b = ctx.createOscillator();
    a.type = "sine";
    b.type = "sine";
    a.frequency.value = 98;
    b.frequency.value = 123;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 280;
    const g = ctx.createGain();
    g.gain.value = 0;
    a.connect(filter);
    b.connect(filter);
    filter.connect(g);
    g.connect(sfx.master);
    a.start();
    b.start();
    sfx.hornOscA = a;
    sfx.hornOscB = b;
    sfx.hornFilter = filter;
    sfx.hornGain = g;
  }
}

function stopLoops(sfx, immediate) {
  if (!sfx?.ctx) return;
  const t = sfx.ctx.currentTime;
  const fade = immediate ? 0.02 : 0.12;
  for (const node of [sfx.waveGain, sfx.lampGain, sfx.hornGain]) {
    if (!node) continue;
    try {
      node.gain.cancelScheduledValues(t);
      node.gain.setValueAtTime(node.gain.value, t);
      node.gain.linearRampToValueAtTime(0, t + fade);
    } catch {
      /* ignore */
    }
  }
}

function syncLoops(sfx, state) {
  if (!sfx?.ctx || !sfx.master) return;
  const playing = state?.status === "playing";
  const phase = state?.phase;
  if (!playing || (phase !== "place" && phase !== "play" && phase !== "reveal")) {
    stopLoops(sfx, false);
    return;
  }
  ensureLoops(sfx);
  const t = sfx.ctx.currentTime;
  const snap = snapshot(state);
  const waveWant = phase === "reveal" ? 0.012 : 0.028;
  if (sfx.waveGain) {
    sfx.waveGain.gain.cancelScheduledValues(t);
    sfx.waveGain.gain.setValueAtTime(sfx.waveGain.gain.value, t);
    sfx.waveGain.gain.linearRampToValueAtTime(waveWant, t + 0.12);
  }
  const lampWant =
    phase === "play" || phase === "place" ? 0.008 + snap.intensity * 0.018 : 0;
  if (sfx.lampGain) {
    sfx.lampGain.gain.cancelScheduledValues(t);
    sfx.lampGain.gain.setValueAtTime(sfx.lampGain.gain.value, t);
    sfx.lampGain.gain.linearRampToValueAtTime(lampWant, t + 0.1);
  }
  if (sfx.lampOsc && snap.intensity >= 0) {
    try {
      sfx.lampOsc.frequency.setTargetAtTime(90 + snap.intensity * 50, t, 0.12);
    } catch {
      /* ignore */
    }
  }
  const blasting = phase === "play" && !!state?.right?.blasting && (Number(state?.air) || 0) > 0;
  const hornWant = blasting ? (snap.hornWindow ? 0.16 : 0.11) : 0;
  if (sfx.hornGain) {
    sfx.hornGain.gain.cancelScheduledValues(t);
    sfx.hornGain.gain.setValueAtTime(sfx.hornGain.gain.value, t);
    sfx.hornGain.gain.linearRampToValueAtTime(hornWant, t + (blasting ? 0.08 : 0.1));
  }
  if (sfx.hornFilter) {
    try {
      sfx.hornFilter.frequency.setTargetAtTime(snap.hornWindow ? 360 : 260, t, 0.1);
    } catch {
      /* ignore */
    }
  }
  if (phase === "play") {
    const des = Number(state?.left?.headingDes);
    const head = Number(state?.left?.heading) || 0;
    const rate = Number.isFinite(des) ? Math.abs(des - head) : 0;
    if (rate > 0.04) playRotateTick(sfx, clamp(rate / 0.6, 0, 1));
  }
}

function fire(sfx, ev) {
  if (!ev || !sfx.ctx || !sfx.master) return;
  const seed = sfx.prev?.seed || "";
  if (ev.type === "place") playPlace(sfx, seed);
  else if (ev.type === "wreck") playWreck(sfx);
  else if (ev.type === "port") playPort(sfx, seed);
  else if (ev.type === "oilOut") playOilOut(sfx);
  else if (ev.type === "track") playTrack(sfx);
  else if (ev.type === "lamp") playLamp(sfx);
  else if (ev.type === "reveal") playReveal(sfx, ev);
}

export function syncSound(sfx, state) {
  if (!sfx) return;
  const ev = soundEvent(sfx.prev, state);
  sfx.prev = snapshot(state);
  if (sfx.ctx && ev) fire(sfx, ev);
  if (sfx.ctx) syncLoops(sfx, state);
}
