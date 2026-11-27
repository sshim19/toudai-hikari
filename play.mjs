/**
 * 入力、向き、rAF、画面遷移の配線。
 *
 * エンジンインタフェース（engine/sim.mjs）:
 *   createInitialState({ seed, dateJst, bestScore, todayBestScore })
 *     → status は "playing"、phase は "place"。タイトルはこちらで "title" にする。
 *   tick(state, input, dt) → 新しい state（非破壊）。dt は秒。最大 50ms。
 *   finishNow(state) は「仕舞う」と時間切れと全船入港が共有する確定。
 *   canFinish(state) は 22秒以降、または船をすべて港へ入れたとき true。
 *   input は {
 *     left:  { active, x, y },
 *     right: { active, x, y },
 *     finish: boolean,
 *     landscape: boolean
 *   }。
 *     x, y はそのフレームの論理 wu。active が false のとき x, y は無視する。
 *     finish はそのフレームの立ち上がりだけ true。
 *     landscape が false なら、tick は回す・強さを変える・霧笛・仕舞うを無視する
 *       （向きと強さは保持。時刻も船も油も進めない。霧笛は止める）。
 *   tick は input を書き換えない。
 */
import * as sim from "./engine/sim.mjs";
import * as constants from "./engine/constants.mjs";
import {
  drawScene,
  drawTitlePreview,
  clientToLogical,
  inLeftZone,
  inRightZone,
} from "./render/draw.mjs";
import { createFx, resetFx, syncFx } from "./render/fx.mjs";
import { createSfx, resetSfx, syncSound, unlockSfx, setMuted } from "./render/sound.mjs";
import { bindScreens } from "./render/screens.mjs";
import {
  getJstDate,
  seedString,
  loadBests,
  saveBests,
  shareText,
  sharePageUrl,
  tweetShareUrl,
  lineShareUrl,
} from "./render/share.mjs";

const { tick, createInitialState } = sim;

const MAX_DT = constants.MAX_DT ?? 0.05;
const PLAY_TIME =
  constants.PLAY_TIME ?? constants.PLAY_DURATION ?? constants.PLAY_DUR ?? 75;
const FINISH_MIN_TIME =
  constants.FINISH_MIN ?? constants.FINISH_MIN_TIME ?? constants.FINISH_UNLOCK ?? 22;

const screens = bindScreens(document);
const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d", { alpha: false });

const motionQuery =
  typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };

function reducedMotion() {
  return !!motionQuery.matches;
}

function isLandscape() {
  return window.innerWidth >= window.innerHeight;
}

const { dateJst, dateLabel } = getJstDate();
const seed = seedString(dateJst);

let stored = loadBests(dateJst);
let state = titleStateFrom(stored);
let ended = false;
let landscape = isLandscape();

let leftPointer = null;
let rightPointer = null;
let left = { active: false, x: 0, y: 0 };
let right = { active: false, x: 0, y: 0 };
let finishPulse = false;

let lastTs = 0;
let lastShare = shareText({ dateLabel, score: 0, grade: "early" });
const fx = createFx();
const sfx = createSfx();
screens.setMuteUi(sfx.muted);
screens.setPortrait(!landscape);

function titleStateFrom(bests) {
  const playing = createInitialState({
    seed,
    dateJst,
    bestScore: bests.bestScore ?? 0,
    todayBestScore: bests.todayBestScore ?? 0,
  });
  return { ...playing, status: "title" };
}

function freshRun() {
  stored = loadBests(dateJst);
  ended = false;
  clearPointers();
  lastTs = 0;
  resetFx(fx);
  resetSfx(sfx);
  return createInitialState({
    seed,
    dateJst,
    bestScore: stored.bestScore ?? 0,
    todayBestScore: stored.todayBestScore ?? 0,
  });
}

function allShipsInPort(s) {
  if (!s) return false;
  const ships = Array.isArray(s.ships) ? s.ships : [];
  if (ships.length > 0) return ships.every((sh) => sh && sh.inPort);
  const total = Number(s.shipsTotal) || 0;
  const arrived = Number(s.shipsIn) || 0;
  const wrecks = Number(s.wrecks) || 0;
  const missed = Number(s.missed) || 0;
  return total > 0 && arrived === total && wrecks === 0 && missed === 0;
}

function canFinishNow(s, isLand) {
  if (!isLand || !s) return false;
  if (typeof sim.canFinish === "function") return sim.canFinish(s);
  if (s.status !== "playing" || s.phase !== "play") return false;
  if (s.finishedAt != null) return false;
  if (allShipsInPort(s)) return true;
  return (Number(s.playT) || 0) >= FINISH_MIN_TIME;
}

function remainingTime(s) {
  if (!s || s.status !== "playing" || s.phase !== "play") return null;
  return Math.max(0, PLAY_TIME - (Number(s.playT) || 0));
}

function finishRun(next) {
  if (ended) {
    state = next;
    return;
  }
  ended = true;
  clearPointers();
  resetFx(fx);
  state = next.status === "over" ? next : { ...next, status: "over" };
  const saved = saveBests({ dateJst, score: state.score });
  stored = { bestScore: saved.bestScore, todayBestScore: saved.todayBestScore };
  lastShare = shareText({ dateLabel, score: state.score, grade: state.grade });
  screens.showOver({
    score: state.score,
    grade: state.grade,
    todayBestScore: saved.todayBestScore,
    bestScore: saved.bestScore,
    isNewBest: saved.isNewBest,
    isNewTodayBest: saved.isNewTodayBest,
  });
}

function takeInput() {
  const input = {
    left: { active: left.active, x: left.x, y: left.y },
    right: { active: right.active, x: right.x, y: right.y },
    finish: finishPulse,
    landscape,
  };
  finishPulse = false;
  return input;
}

function clearPointers() {
  leftPointer = null;
  rightPointer = null;
  left = { active: false, x: 0, y: 0 };
  right = { active: false, x: 0, y: 0 };
  finishPulse = false;
}

function paint() {
  drawScene(ctx, state, {
    reducedMotion: reducedMotion(),
    fx,
    left,
    right,
  });
  if (state.status === "playing") {
    screens.updateHud({
      remaining: remainingTime(state),
      showTime: state.phase === "play",
      canFinish: canFinishNow(state, landscape),
    });
    screens.setHints(!!state.hintLeft, !!state.hintRight);
  }
  const preview = screens.el.titlePath;
  if (state.status === "title" && preview) {
    drawTitlePreview(preview, state);
  }
}

function frame(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(Math.max((ts - lastTs) / 1000, 0), MAX_DT);
  lastTs = ts;

  if (state.status === "playing") {
    const input = takeInput();
    const next = tick(state, input, dt);
    syncFx(fx, next, dt, { reducedMotion: reducedMotion(), right, left });
    syncSound(sfx, next);
    if (next.status === "over") {
      finishRun(next);
    } else {
      state = next;
    }
  } else {
    if (state.status !== "over") clearPointers();
    syncFx(fx, state, dt, { reducedMotion: reducedMotion(), right, left });
    syncSound(sfx, state);
  }

  paint();
  requestAnimationFrame(frame);
}

function idleInput() {
  return {
    left: { active: false, x: 0, y: 0 },
    right: { active: false, x: 0, y: 0 },
    finish: false,
    landscape,
  };
}

function startPlay() {
  if (!landscape) {
    screens.setPortrait(true);
    return;
  }
  state = freshRun();
  state = tick(state, idleInput(), 0);
  screens.showPlay();
  screens.updateHud({
    remaining: remainingTime(state),
    showTime: state.phase === "play",
    canFinish: canFinishNow(state, landscape),
  });
  screens.setHints(state.hintLeft !== false, state.hintRight !== false);
  paint();
}

function unlockAudio() {
  unlockSfx(sfx);
}

window.addEventListener("pointerdown", unlockAudio, { capture: true });
window.addEventListener("touchstart", unlockAudio, { capture: true });
window.addEventListener("keydown", unlockAudio);

screens.el.btnMute?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  unlockSfx(sfx);
  setMuted(sfx, !sfx.muted);
  screens.setMuteUi(sfx.muted);
});

screens.el.btnStart?.addEventListener("click", () => {
  unlockSfx(sfx);
  startPlay();
});

screens.el.btnRetry?.addEventListener("click", () => {
  unlockSfx(sfx);
  startPlay();
});

screens.el.btnFinish?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (!canFinishNow(state, landscape)) return;
  finishPulse = true;
});

function currentShare() {
  return {
    text: lastShare,
    url: sharePageUrl(),
  };
}

function guardClick(fn) {
  return (e) => {
    e.preventDefault();
    e.stopPropagation();
    fn(e);
  };
}

function openShareTab(href) {
  if (!href) return;
  window.open(href, "_blank", "noopener,noreferrer");
}

screens.el.btnShareX?.addEventListener(
  "click",
  guardClick(() => {
    openShareTab(tweetShareUrl(currentShare()));
  }),
);

screens.el.btnShareLine?.addEventListener(
  "click",
  guardClick(() => {
    openShareTab(lineShareUrl(currentShare()));
  }),
);

function eventPoint(e) {
  return clientToLogical(canvas, e.clientX, e.clientY);
}

function maybeCapture(e) {
  if (e.pointerType && e.pointerType !== "touch") {
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }
}

function isHudTarget(e) {
  const t = e.target;
  if (!t || typeof t.closest !== "function") return false;
  return !!t.closest("#btn-mute, #btn-finish, #btn-start, #btn-retry, .share-btn, .panel, .portrait");
}

function pointerDown(e) {
  if (state.status !== "playing" || !landscape) return;
  if (isHudTarget(e)) return;
  const pt = eventPoint(e);
  if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return;

  if (leftPointer == null && inLeftZone(pt.x, pt.y)) {
    leftPointer = e.pointerId;
    left = { active: true, x: pt.x, y: pt.y };
    maybeCapture(e);
    if (e.cancelable) e.preventDefault();
    return;
  }

  if (rightPointer == null && inRightZone(pt.x, pt.y)) {
    rightPointer = e.pointerId;
    right = { active: true, x: pt.x, y: pt.y };
    maybeCapture(e);
    if (e.cancelable) e.preventDefault();
  }
}

function pointerMove(e) {
  if (state.status !== "playing") return;
  if (e.pointerId === leftPointer || e.pointerId === rightPointer) {
    if (e.cancelable) e.preventDefault();
  }
  if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
  const pt = eventPoint(e);
  if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return;
  if (e.pointerId === leftPointer) {
    left = { active: true, x: pt.x, y: pt.y };
  } else if (e.pointerId === rightPointer) {
    right = { active: true, x: pt.x, y: pt.y };
  }
}

function endHand(e) {
  if (e.pointerId === leftPointer) {
    leftPointer = null;
    left = { active: false, x: left.x, y: left.y };
    return true;
  }
  if (e.pointerId === rightPointer) {
    rightPointer = null;
    right = { active: false, x: right.x, y: right.y };
    return true;
  }
  return false;
}

function pointerUp(e) {
  if (endHand(e) && e.cancelable) e.preventDefault();
}

function pointerCancel(e) {
  // 離した扱い。向きも強さも跳ねない（いまの値に留まる）。
  if (endHand(e) && e.cancelable) e.preventDefault();
}

canvas.addEventListener("pointerdown", pointerDown, { passive: false });
window.addEventListener("pointermove", pointerMove, { passive: false });
window.addEventListener("pointerup", pointerUp, { passive: false });
window.addEventListener("pointercancel", pointerCancel, { passive: false });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

canvas.addEventListener(
  "touchstart",
  (e) => {
    if (state.status === "playing" && e.cancelable) e.preventDefault();
  },
  { passive: false },
);

window.addEventListener(
  "touchmove",
  (e) => {
    if (state.status === "playing" && e.cancelable) e.preventDefault();
  },
  { passive: false },
);

function applyOrientation() {
  const next = isLandscape();
  if (next === landscape) {
    screens.setPortrait(!next);
    return;
  }
  landscape = next;
  screens.setPortrait(!landscape);
  if (!landscape) {
    clearPointers();
  }
}

window.addEventListener("resize", applyOrientation);
window.addEventListener("orientationchange", applyOrientation);

screens.showTitle({ dateLabel, bestScore: stored.bestScore, params: state.params });
screens.updateHud({ remaining: null, showTime: false, canFinish: false });
paint();
requestAnimationFrame(frame);

globalThis.__toudaiQa = {
  getState: () => state,
  getFx: () => fx,
  getSfx: () => sfx,
  getLeft: () => ({ ...left, pointer: leftPointer }),
  getRight: () => ({ ...right, pointer: rightPointer }),
  getEnded: () => ended,
  getLandscape: () => landscape,
};
