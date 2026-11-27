/** タイトル / HUD / 縦向き案内 / 終了の DOM と文言。DESIGN.md の文言をそのまま使う。 */

import {
  formatScore,
  gradeResult,
  titleDailyLine,
} from "./share.mjs";

/**
 * @param {ParentNode} [root]
 */
export function bindScreens(root = document) {
  const el = {
    body: document.body,
    html: document.documentElement,
    app: root.querySelector("#app"),
    playBar: root.querySelector("#play-bar"),
    hud: root.querySelector("#play-hud"),
    hudTime: root.querySelector("#hud-time"),
    hintLeft: root.querySelector("#hint-left"),
    hintRight: root.querySelector("#hint-right"),
    title: root.querySelector("#screen-title"),
    titleHeading: root.querySelector("#screen-title h1"),
    titleDaily: root.querySelector("#title-daily"),
    titleDate: root.querySelector("#title-date"),
    titleRecord: root.querySelector("#title-record"),
    btnStart: root.querySelector("#btn-start"),
    btnMute: root.querySelector("#btn-mute"),
    btnFinish: root.querySelector("#btn-finish"),
    over: root.querySelector("#screen-over"),
    overHeading: root.querySelector("#screen-over h1"),
    overScore: root.querySelector("#over-score"),
    overGrade: root.querySelector("#over-grade"),
    overToday: root.querySelector("#over-today"),
    overBest: root.querySelector("#over-best"),
    overNewBest: root.querySelector("#over-new-best"),
    overNewToday: root.querySelector("#over-new-today"),
    btnRetry: root.querySelector("#btn-retry"),
    btnShareX: root.querySelector("#btn-share-x"),
    btnShareLine: root.querySelector("#btn-share-line"),
    portrait: root.querySelector("#screen-portrait"),
    canvas: root.querySelector("#game"),
    titlePath: root.querySelector("#title-path"),
  };

  function setPlaying(on) {
    el.body?.classList.toggle("is-playing", !!on);
    el.html?.classList.toggle("is-playing", !!on);
    el.app?.classList.toggle("is-playing", !!on);
  }

  function hide(node, on) {
    if (!node) return;
    node.hidden = !!on;
  }

  function focusHeading(node) {
    if (!node) return;
    try {
      node.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
  }

  /**
   * @param {{ dateLabel: string, bestScore: number | null, params?: object }} data
   */
  function showTitle(data) {
    setPlaying(false);
    hide(el.title, false);
    hide(el.over, true);
    hide(el.playBar, false);
    hide(el.btnFinish, true);
    hide(el.hud, true);
    setHints(false, false);
    setFinishEnabled(false);
    if (el.titleDaily) el.titleDaily.textContent = titleDailyLine(data.params);
    if (el.titleDate) el.titleDate.textContent = `今日の海（${data.dateLabel}）`;
    if (el.titleRecord) {
      const best = data.bestScore;
      el.titleRecord.textContent =
        best == null || best <= 0 ? "記録はまだありません" : `最高記録 ${formatScore(best)}点`;
    }
    focusHeading(el.titleHeading);
  }

  function showPlay() {
    setPlaying(true);
    hide(el.title, true);
    hide(el.over, true);
    hide(el.playBar, false);
    hide(el.btnFinish, false);
    hide(el.hud, false);
  }

  /**
   * @param {{
   *   score: number,
   *   grade?: string | null,
   *   todayBestScore: number | null,
   *   bestScore: number | null,
   *   isNewBest?: boolean,
   *   isNewTodayBest?: boolean,
   * }} data
   */
  function showOver(data) {
    setPlaying(false);
    hide(el.title, true);
    hide(el.over, false);
    hide(el.playBar, true);
    hide(el.hud, true);
    hide(el.btnFinish, true);
    setHints(false, false);
    setFinishEnabled(false);
    const score = Math.max(0, Math.floor(Number(data.score) || 0));
    if (el.overScore) el.overScore.textContent = `${formatScore(score)}点でした`;
    if (el.overGrade) el.overGrade.textContent = gradeResult(data.grade);
    const today = Math.max(0, Math.floor(Number(data.todayBestScore) || 0));
    const best = Math.max(0, Math.floor(Number(data.bestScore) || 0));
    if (el.overToday) {
      el.overToday.textContent =
        today <= 0 ? "今日の記録はまだありません" : `今日の最高 ${formatScore(today)}点`;
    }
    if (el.overBest) {
      el.overBest.textContent =
        best <= 0 ? "これまでの記録はまだありません" : `これまでの最高 ${formatScore(best)}点`;
    }
    hide(el.overNewBest, !data.isNewBest);
    hide(el.overNewToday, !data.isNewTodayBest);
    focusHeading(el.overHeading);
  }

  /**
   * @param {{ remaining?: number | null, showTime?: boolean, canFinish?: boolean }} data
   */
  function updateHud(data) {
    const show = data.showTime !== false && data.remaining != null && Number.isFinite(data.remaining);
    if (el.hudTime) {
      if (!show) {
        el.hudTime.textContent = "";
      } else {
        const sec = Math.max(0, Math.ceil(Number(data.remaining) || 0));
        el.hudTime.textContent = `残り ${sec}秒`;
      }
    }
    if (data.canFinish != null) setFinishEnabled(data.canFinish);
  }

  /**
   * @param {boolean} left
   * @param {boolean} right
   */
  function setHints(left, right) {
    hide(el.hintLeft, !left);
    hide(el.hintRight, !right);
  }

  /** @param {boolean} enabled */
  function setFinishEnabled(enabled) {
    const btn = el.btnFinish;
    if (!btn) return;
    const on = !!enabled;
    btn.disabled = !on;
    btn.setAttribute("aria-disabled", on ? "false" : "true");
    btn.classList.toggle("is-ready", on);
  }

  /** @param {boolean} visible */
  function setPortrait(visible) {
    const on = !!visible;
    el.body?.classList.toggle("is-portrait", on);
    el.html?.classList.toggle("is-portrait", on);
    el.app?.classList.toggle("is-portrait", on);
    hide(el.portrait, !on);
  }

  /** @param {boolean} muted */
  function setMuteUi(muted) {
    const btn = el.btnMute;
    if (!btn) return;
    const on = !!muted;
    btn.classList.toggle("is-muted", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.setAttribute("aria-label", on ? "音を出す" : "音を消す");
  }

  return {
    el,
    showTitle,
    showPlay,
    showOver,
    updateHud,
    setHints,
    setFinishEnabled,
    setPortrait,
    setMuteUi,
  };
}
