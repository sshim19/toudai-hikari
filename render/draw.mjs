/**
 * 岬・海・霧・灯台・光・船・礁・港・左右の域・縮小図。
 * 844×390 論理座標。Y は下向き。カメラは描画側だけが持つ。画像アセットは使わない。
 */

import * as constants from "../engine/constants.mjs";
import {
  drawFx,
  revealZoom,
  seaPoint,
  lanternPos,
  shipTrackInst,
  isTrackable,
  SEA,
  LANTERN as LANTERN_POS,
  SEA_SCALE,
} from "./fx.mjs";
import { drawMotionGuides } from "./hand-guides.mjs";

export const VIEW_W = constants.VIEW_W ?? 844;
export const VIEW_H = constants.VIEW_H ?? 390;

export const LEFT_X0 = constants.LEFT_X0 ?? 0;
export const LEFT_X1 = constants.LEFT_X1 ?? 400;
export const LEFT_Y0 = constants.LEFT_Y0 ?? 44;
export const LEFT_Y1 = constants.LEFT_Y1 ?? 390;

export const RIGHT_X0 = constants.RIGHT_X0 ?? 444;
export const RIGHT_X1 = constants.RIGHT_X1 ?? 844;
export const RIGHT_Y0 = constants.RIGHT_Y0 ?? 44;
export const RIGHT_Y1 = constants.RIGHT_Y1 ?? 390;
export const RIGHT_EDGE_SLACK = constants.RIGHT_EDGE_SLACK ?? 24;

export const ARC_CX = constants.ARC_CX ?? constants.LENS_CX ?? 188;
export const ARC_CY = constants.ARC_CY ?? constants.LENS_CY ?? 312;
export const ARC_R = constants.ARC_R ?? constants.LENS_R ?? 102;
export const ARC_WIDTH = constants.ARC_WIDTH ?? constants.LENS_WIDTH ?? 52;
export const HEADING_MAX = constants.HEADING_MAX ?? 1.4;

export const LAMP_CX = constants.LAMP_CX ?? constants.LEVER_CX ?? 600;
export const LAMP_CY = constants.LAMP_CY ?? constants.LEVER_CY ?? 268;
export const GROOVE_W = constants.GROOVE_W ?? 56;
export const GROOVE_H = constants.GROOVE_H ?? 200;
export const GROOVE_Y1 = constants.GROOVE_Y1 ?? constants.LAMP_Y1 ?? 368;

export const HORN_CX = constants.HORN_CX ?? 748;
export const HORN_CY = constants.HORN_CY ?? 268;
export const HORN_SIZE = constants.HORN_SIZE ?? constants.HORN_W ?? 56;

export const BEAM_INNER = constants.BEAM_INNER ?? 0.22;
export const BEAM_OUTER = constants.BEAM_OUTER ?? 0.48;
export const KEEP_BAND = constants.KEEP_BAND ?? 0.2;

export const MINIMAP = { x: 16, y: 48, w: 176, h: 96 };
export const THUMB_GUIDE_R = 22;

const SKY_A = "#0b1724";
const SKY_B = "#152536";
const SEA_A = "#0c2430";
const SEA_B = "#163440";
const FOG = "#6a7a88";
const ROCK_A = "#3a3c44";
const ROCK_B = "#2a2c34";
const STONE_A = "#d0c8b8";
const STONE_B = "#9a948c";
const LANTERN = "#f2e6a8";
const BEAM = "#f4e4a0";
const REEF = "#2c2a32";
const REEF_EDGE = "#5a5860";
const QUAY = "#4a463e";
const PORT_LAMP = "#e8a858";
const SHIP = "#1c1e26";
const SHIP_LIT = "#d8c89a";
const INK = "#1c2430";
const HUD_BG = "#eef2f4";
const FONT = `"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif`;

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, Number(n) || 0));
}

function clamp01(n) {
  return clamp(n, 0, 1);
}

function rgba(hex, a) {
  const n = parseInt(String(hex || "#ffffff").replace("#", ""), 16);
  if (!Number.isFinite(n)) return `rgba(255, 255, 255, ${a})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function intensityAtY(y) {
  return clamp01((GROOVE_Y1 - y) / GROOVE_H);
}

export function yAtIntensity(intensity) {
  return GROOVE_Y1 - clamp01(intensity) * GROOVE_H;
}

export function headingPoint(heading, radius = ARC_R) {
  return {
    x: ARC_CX + Math.sin(heading) * radius,
    y: ARC_CY - Math.cos(heading) * radius,
  };
}

export function angleFromArc(x, y) {
  return Math.atan2(x - ARC_CX, ARC_CY - y);
}

export function syncCanvasSize(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const cssW = Math.max(1, canvas.clientWidth || VIEW_W);
  const cssH = Math.max(1, canvas.clientHeight || VIEW_H);
  const w = Math.round(cssW * dpr);
  const h = Math.round(cssH * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return { cssW, cssH, dpr };
}

/**
 * 高さに合わせて 844×390 を伸ばし、幅が足りなければ contain する。
 * 余った部分は同じ空色で埋める。
 */
export function makeView(cssW, cssH) {
  let scale = cssH / VIEW_H;
  if (VIEW_W * scale > cssW + 0.5) scale = cssW / VIEW_W;
  const drawW = VIEW_W * scale;
  const drawH = VIEW_H * scale;
  const ox = (cssW - drawW) / 2;
  const oy = (cssH - drawH) / 2;
  return {
    scale,
    ox,
    oy,
    drawW,
    drawH,
    cssW,
    cssH,
    sx(x) {
      return ox + x * scale;
    },
    sy(y) {
      return oy + y * scale;
    },
    px(wu) {
      return wu * scale;
    },
    worldX(cssX) {
      return (cssX - ox) / scale;
    },
    worldY(cssY) {
      return (cssY - oy) / scale;
    },
  };
}

/**
 * クライアント座標をキャンバス論理座標（0..844, 0..390, Y 下向き）へ。
 * @returns {{ x: number, y: number }}
 */
export function clientToLogical(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const cssW = canvas.clientWidth || rect.width || VIEW_W;
  const cssH = canvas.clientHeight || rect.height || VIEW_H;
  const view = makeView(cssW, cssH);
  const cssX = ((clientX - rect.left) / (rect.width || 1)) * cssW;
  const cssY = ((clientY - rect.top) / (rect.height || 1)) * cssH;
  return { x: view.worldX(cssX), y: view.worldY(cssY) };
}

export function inLeftZone(x, y) {
  return x >= LEFT_X0 && x <= LEFT_X1 && y >= LEFT_Y0 && y <= LEFT_Y1;
}

export function inRightZone(x, y, slack = 0) {
  return (
    x >= RIGHT_X0 - slack &&
    x <= RIGHT_X1 + slack &&
    y >= RIGHT_Y0 - slack &&
    y <= RIGHT_Y1 + slack
  );
}

function fogKind(state) {
  const fog = state?.params?.fog;
  if (fog === "thin" || fog === "薄い") return "thin";
  if (fog === "thick" || fog === "濃い") return "thick";
  return "normal";
}

function fogAlpha(kind) {
  if (kind === "thin") return 0.14;
  if (kind === "thick") return 0.46;
  return 0.28;
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
  return Number.isFinite(v) ? v : 0.36;
}

function portOf(state) {
  const port = state?.params?.port;
  return {
    m0: Number.isFinite(Number(port?.m0)) ? Number(port.m0) : 0.86,
    m1: Number.isFinite(Number(port?.m1)) ? Number(port.m1) : 0.96,
    halfW: Number(port?.halfW) || 0.08,
  };
}

function fillSky(ctx, view) {
  const g = ctx.createLinearGradient(0, 0, 0, view.cssH);
  g.addColorStop(0, SKY_A);
  g.addColorStop(1, SKY_B);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.cssW, view.cssH);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

function drawSkySea(ctx, view, fx, reduced, state) {
  const sx = (x) => view.sx(x);
  const sy = (y) => view.sy(y);
  const lantern = lanternPos();
  const horizon = sy(Math.max(64, SEA.yFar - 14));
  const bottom = sy(lantern.y + 8);
  const sky = ctx.createLinearGradient(0, view.sy(0), 0, horizon);
  sky.addColorStop(0, SKY_A);
  sky.addColorStop(1, SKY_B);
  ctx.fillStyle = sky;
  ctx.fillRect(sx(0), sy(0), view.px(VIEW_W), horizon - sy(0));

  const sea = ctx.createLinearGradient(0, horizon, 0, bottom);
  sea.addColorStop(0, SEA_B);
  sea.addColorStop(1, SEA_A);
  ctx.fillStyle = sea;
  ctx.fillRect(sx(0), horizon, view.px(VIEW_W), Math.max(1, bottom - horizon));

  const phase = reduced ? 0 : Number(fx?.wavePhase) || 0;
  ctx.strokeStyle = rgba("#8eb0b8", 0.22);
  ctx.lineWidth = Math.max(1, view.px(1.1));
  for (let i = 0; i < 5; i++) {
    const y0 = 92 + i * 28;
    ctx.beginPath();
    for (let x = 0; x <= VIEW_W; x += 16) {
      const y = y0 + Math.sin(x * 0.03 + phase * (0.8 + i * 0.15) + i) * (reduced ? 0 : 2.2);
      if (x === 0) ctx.moveTo(sx(x), sy(y));
      else ctx.lineTo(sx(x), sy(y));
    }
    ctx.stroke();
  }

  const kind = fogKind(state);
  const fogShift = reduced ? 0 : Math.sin((Number(fx?.fogPhase) || 0) * 0.7) * 8;
  ctx.fillStyle = rgba(FOG, fogAlpha(kind));
  ctx.fillRect(sx(0), sy(58), view.px(VIEW_W), view.px(70));
  ctx.beginPath();
  ctx.ellipse(sx(400 + fogShift), sy(86), view.px(420), view.px(36 + fogAlpha(kind) * 18), 0, 0, Math.PI * 2);
  ctx.fill();
  if (kind !== "thin") {
    ctx.fillStyle = rgba(FOG, fogAlpha(kind) * 0.45);
    ctx.fillRect(sx(0), sy(78), view.px(VIEW_W), view.px(150));
  }
}

function drawCourse(ctx, view) {
  const sx = (x) => view.sx(x);
  const sy = (y) => view.sy(y);
  ctx.save();
  ctx.strokeStyle = rgba("#d8e0e6", 0.72);
  ctx.lineWidth = Math.max(1.5, view.px(2.2));
  ctx.setLineDash([view.px(7), view.px(5)]);
  ctx.beginPath();
  for (let t = 0; t <= 1.001; t += 0.04) {
    const p = seaPoint(t, 0);
    if (t === 0) ctx.moveTo(sx(p.x), sy(p.y));
    else ctx.lineTo(sx(p.x), sy(p.y));
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function reefRadius(r) {
  return Math.max(8, (Number(r) || 0.05) * SEA_SCALE * 1.2);
}

function drawReefs(ctx, view, state) {
  const sx = (x) => view.sx(x);
  const sy = (y) => view.sy(y);
  const reefs = Array.isArray(state?.params?.reefs) ? state.params.reefs : [];
  for (const reef of reefs) {
    const p = seaPoint(Number(reef.along) || 0, Number(reef.lat) || 0);
    const rad = reefRadius(reef.r);
    ctx.beginPath();
    ctx.ellipse(sx(p.x - 1), sy(p.y + 1), view.px(rad * 1.15), view.px(rad * 0.72), -0.3, 0, Math.PI * 2);
    ctx.fillStyle = REEF;
    ctx.fill();
    ctx.strokeStyle = REEF_EDGE;
    ctx.lineWidth = Math.max(1.5, view.px(2.2));
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(sx(p.x + rad * 0.2), sy(p.y - rad * 0.15), view.px(rad * 0.45), view.px(rad * 0.28), 0.4, 0, Math.PI * 2);
    ctx.fillStyle = rgba(REEF_EDGE, 0.7);
    ctx.fill();
  }
}

function drawPort(ctx, view, state) {
  const sx = (x) => view.sx(x);
  const sy = (y) => view.sy(y);
  const port = portOf(state);
  const left0 = seaPoint(port.m0, -port.halfW);
  const left1 = seaPoint(port.m1, -port.halfW);
  const right0 = seaPoint(port.m0, port.halfW);
  const right1 = seaPoint(port.m1, port.halfW);
  const backL = seaPoint(1.02, -port.halfW * 1.15);
  const backR = seaPoint(1.02, port.halfW * 1.15);
  ctx.fillStyle = QUAY;
  ctx.strokeStyle = rgba("#1c1e26", 0.55);
  ctx.lineWidth = Math.max(1, view.px(1.4));
  const arm = (a, b, out) => {
    const ox = out * 10;
    ctx.beginPath();
    ctx.moveTo(sx(a.x), sy(a.y));
    ctx.lineTo(sx(b.x), sy(b.y));
    ctx.lineTo(sx(b.x + ox), sy(b.y + 8));
    ctx.lineTo(sx(a.x + ox), sy(a.y + 8));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  arm(left0, left1, -1);
  arm(right0, right1, 1);
  ctx.beginPath();
  ctx.moveTo(sx(left1.x), sy(left1.y));
  ctx.lineTo(sx(backL.x), sy(backL.y));
  ctx.lineTo(sx(backR.x), sy(backR.y));
  ctx.lineTo(sx(right1.x), sy(right1.y));
  ctx.closePath();
  ctx.fillStyle = rgba(QUAY, 0.95);
  ctx.fill();
  ctx.stroke();
  const lamps = [left0, right0, left1, right1];
  for (const p of lamps) {
    ctx.beginPath();
    ctx.arc(sx(p.x), sy(p.y - 5), view.px(3.2), 0, Math.PI * 2);
    ctx.fillStyle = PORT_LAMP;
    ctx.fill();
    ctx.strokeStyle = rgba("#1c1e26", 0.55);
    ctx.lineWidth = Math.max(1, view.px(0.9));
    ctx.stroke();
  }
}

function drawCapeAndLighthouse(ctx, view, state, fx) {
  const sx = (x) => view.sx(x);
  const sy = (y) => view.sy(y);
  const lantern = lanternPos();
  ctx.beginPath();
  ctx.moveTo(sx(0), sy(390));
  ctx.lineTo(sx(0), sy(318));
  ctx.quadraticCurveTo(sx(90), sy(300), sx(200), sy(312));
  ctx.quadraticCurveTo(sx(300), sy(300), sx(lantern.x - 30), sy(268));
  ctx.quadraticCurveTo(sx(lantern.x + 8), sy(278), sx(lantern.x + 46), sy(292));
  ctx.quadraticCurveTo(sx(520), sy(330), sx(640), sy(352));
  ctx.lineTo(sx(844), sy(370));
  ctx.lineTo(sx(844), sy(390));
  ctx.closePath();
  const rock = ctx.createLinearGradient(0, sy(280), 0, sy(390));
  rock.addColorStop(0, ROCK_A);
  rock.addColorStop(1, ROCK_B);
  ctx.fillStyle = rock;
  ctx.fill();

  const baseY = lantern.y + 52;
  const topY = lantern.y + 8;
  ctx.beginPath();
  ctx.moveTo(sx(lantern.x - 16), sy(baseY));
  ctx.lineTo(sx(lantern.x - 11), sy(topY));
  ctx.lineTo(sx(lantern.x + 11), sy(topY));
  ctx.lineTo(sx(lantern.x + 16), sy(baseY));
  ctx.closePath();
  const stone = ctx.createLinearGradient(sx(lantern.x - 16), 0, sx(lantern.x + 16), 0);
  stone.addColorStop(0, STONE_B);
  stone.addColorStop(0.5, STONE_A);
  stone.addColorStop(1, STONE_B);
  ctx.fillStyle = stone;
  ctx.fill();
  ctx.strokeStyle = rgba("#1c1e26", 0.35);
  ctx.lineWidth = Math.max(1, view.px(1));
  ctx.stroke();

  const glow = 0.35 + 0.65 * clamp01(intensityOf(state)) * (0.55 + 0.45 * (Number(fx?.placeGlow) || 1));
  ctx.fillStyle = rgba(LANTERN, 0.95);
  roundRect(ctx, sx(lantern.x - 9), sy(lantern.y - 8), view.px(18), view.px(16), view.px(2));
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx(lantern.x), sy(lantern.y), view.px(5.5), 0, Math.PI * 2);
  ctx.fillStyle = rgba("#fff6c8", 0.55 + 0.45 * glow);
  ctx.fill();
  ctx.fillStyle = rgba(ROCK_B, 0.9);
  ctx.fillRect(sx(lantern.x - 10), sy(lantern.y - 11), view.px(20), view.px(3));
}

function beamSpread(heading, half, length) {
  const lantern = lanternPos();
  return {
    x: lantern.x + Math.sin(heading + half) * length,
    y: lantern.y - Math.cos(heading + half) * length,
  };
}

function drawBeam(ctx, view, state, fx, faint = false) {
  const intensity = intensityOf(state);
  const heading = headingOf(state);
  const lantern = lanternPos();
  const sx = (x) => view.sx(x);
  const sy = (y) => view.sy(y);
  const length = 250;
  const a = beamSpread(heading, -BEAM_OUTER, length);
  const b = beamSpread(heading, BEAM_OUTER, length);
  const ai = beamSpread(heading, -BEAM_INNER, length * 0.92);
  const bi = beamSpread(heading, BEAM_INNER, length * 0.92);
  const alpha = faint ? 0.08 + intensity * 0.08 : 0.16 + intensity * 0.42;
  const calm = Number(fx?.trackGlow) || 0;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sx(lantern.x), sy(lantern.y));
  ctx.lineTo(sx(a.x), sy(a.y));
  ctx.lineTo(sx(b.x), sy(b.y));
  ctx.closePath();
  ctx.fillStyle = rgba(BEAM, alpha * (0.7 + 0.3 * calm));
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(sx(lantern.x), sy(lantern.y));
  ctx.lineTo(sx(ai.x), sy(ai.y));
  ctx.lineTo(sx(bi.x), sy(bi.y));
  ctx.closePath();
  ctx.fillStyle = rgba(BEAM, alpha * 0.85 + calm * 0.12);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(sx(lantern.x), sy(lantern.y));
  ctx.lineTo(sx(a.x), sy(a.y));
  ctx.moveTo(sx(lantern.x), sy(lantern.y));
  ctx.lineTo(sx(b.x), sy(b.y));
  ctx.strokeStyle = rgba(BEAM, faint ? 0.35 : 0.7 + intensity * 0.25);
  ctx.lineWidth = Math.max(1.2, view.px(1.6));
  ctx.stroke();
  ctx.restore();
}

function drawBeamTrail(ctx, view, fx, reduced) {
  if (!fx?.trail?.length) return;
  const lantern = lanternPos();
  const sx = (x) => view.sx(x);
  const sy = (y) => view.sy(y);
  const n = fx.trail.length;
  const step = reduced ? 6 : 3;
  for (let i = 0; i < n; i += step) {
    const rec = fx.trail[i];
    const u = i / Math.max(1, n - 1);
    const len = 200;
    const a = {
      x: lantern.x + Math.sin(rec.heading - BEAM_INNER) * len,
      y: lantern.y - Math.cos(rec.heading - BEAM_INNER) * len,
    };
    const b = {
      x: lantern.x + Math.sin(rec.heading + BEAM_INNER) * len,
      y: lantern.y - Math.cos(rec.heading + BEAM_INNER) * len,
    };
    ctx.beginPath();
    ctx.moveTo(sx(lantern.x), sy(lantern.y));
    ctx.lineTo(sx(a.x), sy(a.y));
    ctx.lineTo(sx(b.x), sy(b.y));
    ctx.closePath();
    ctx.fillStyle = rgba(BEAM, 0.04 + u * 0.1 * (0.4 + rec.intensity));
    ctx.fill();
  }
}

function drawShipWakes(ctx, view, fx) {
  if (!fx?.shipTrails?.length) return;
  const sx = (x) => view.sx(x);
  const sy = (y) => view.sy(y);
  for (const list of fx.shipTrails) {
    if (!list || list.length < 2) continue;
    ctx.beginPath();
    for (let i = 0; i < list.length; i++) {
      const p = seaPoint(list[i].along, list[i].lat);
      if (i === 0) ctx.moveTo(sx(p.x), sy(p.y));
      else ctx.lineTo(sx(p.x), sy(p.y));
    }
    const last = list[list.length - 1];
    const color = last.wrecked ? "#6a3a3a" : last.inPort || last.track > 0.4 ? SHIP_LIT : "#c8d0d6";
    ctx.strokeStyle = rgba(color, 0.85);
    ctx.lineWidth = Math.max(1.6, view.px(2.2));
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }
}

function drawShips(ctx, view, state) {
  const sx = (x) => view.sx(x);
  const sy = (y) => view.sy(y);
  const ships = Array.isArray(state?.ships) ? state.ships : [];
  const playT = Number(state?.playT) || 0;
  for (const sh of ships) {
    if (!sh) continue;
    const appear = Number(sh.appearT);
    const visible = sh.inPort || sh.wrecked || sh.missed || !Number.isFinite(appear) || playT >= appear || Number.isFinite(Number(sh.along));
    if (!visible && state?.phase !== "reveal") continue;
    if (!Number.isFinite(Number(sh.along))) continue;
    const p = seaPoint(sh.along, sh.lat);
    const lit = shipTrackInst(state, sh) >= 0.45 || (sh.inPort && state?.phase === "reveal");
    const wrecked = !!sh.wrecked;
    ctx.save();
    ctx.translate(sx(p.x), sy(p.y));
    const next = seaPoint((Number(sh.along) || 0) + 0.04, sh.lat);
    ctx.rotate(Math.atan2(next.y - p.y, next.x - p.x));
    const s = view.px(1);
    ctx.beginPath();
    ctx.moveTo(12 * s, 0);
    ctx.lineTo(-9 * s, 5 * s);
    ctx.lineTo(-8 * s, -5 * s);
    ctx.closePath();
    ctx.fillStyle = wrecked ? "#3a3034" : lit ? SHIP_LIT : SHIP;
    ctx.fill();
    ctx.strokeStyle = wrecked ? rgba("#d8c89a", 0.7) : rgba(lit ? "#fff6c8" : "#eef2f4", lit ? 0.85 : 0.92);
    ctx.lineWidth = Math.max(1.3, view.px(1.6));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-1 * s, 0);
    ctx.lineTo(-1 * s, -11 * s);
    ctx.strokeStyle = wrecked ? "#5a5054" : lit ? "#fff6c8" : "#eef2f4";
    ctx.lineWidth = Math.max(1.4, view.px(1.7));
    ctx.stroke();
    ctx.restore();
  }
}

function drawArc(ctx, view, state) {
  const sx = (x) => view.sx(x);
  const sy = (y) => view.sy(y);
  const heading = headingOf(state);
  const inner = ARC_R - ARC_WIDTH / 2;
  const outer = ARC_R + ARC_WIDTH / 2;
  ctx.save();
  ctx.strokeStyle = rgba(HUD_BG, 0.82);
  ctx.lineWidth = Math.max(2, view.px(ARC_WIDTH - 8));
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(sx(ARC_CX), sy(ARC_CY), view.px(ARC_R), -Math.PI / 2 - HEADING_MAX, -Math.PI / 2 + HEADING_MAX);
  ctx.stroke();
  ctx.strokeStyle = rgba("#3a3c44", 0.85);
  ctx.lineWidth = Math.max(1.2, view.px(2));
  ctx.beginPath();
  ctx.arc(sx(ARC_CX), sy(ARC_CY), view.px(inner), -Math.PI / 2 - HEADING_MAX, -Math.PI / 2 + HEADING_MAX);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(sx(ARC_CX), sy(ARC_CY), view.px(outer), -Math.PI / 2 - HEADING_MAX, -Math.PI / 2 + HEADING_MAX);
  ctx.stroke();
  const zero = headingPoint(0, ARC_R);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(sx(zero.x), sy(zero.y), view.px(3.2), 0, Math.PI * 2);
  ctx.fill();
  const knob = headingPoint(heading, ARC_R);
  ctx.beginPath();
  ctx.arc(sx(knob.x), sy(knob.y), view.px(11), 0, Math.PI * 2);
  ctx.fillStyle = rgba(LANTERN, 0.95);
  ctx.fill();
  ctx.strokeStyle = rgba(INK, 0.7);
  ctx.lineWidth = Math.max(1.2, view.px(1.6));
  ctx.stroke();
  ctx.restore();
}

function drawLampLever(ctx, view, state) {
  const sx = (x) => view.sx(x);
  const sy = (y) => view.sy(y);
  const x0 = LAMP_CX - GROOVE_W / 2;
  const y0 = GROOVE_Y1 - GROOVE_H;
  ctx.fillStyle = rgba(HUD_BG, 0.88);
  roundRect(ctx, sx(x0), sy(y0), view.px(GROOVE_W), view.px(GROOVE_H), view.px(8));
  ctx.fill();
  ctx.strokeStyle = rgba(INK, 0.55);
  ctx.lineWidth = Math.max(1.2, view.px(1.5));
  ctx.stroke();
  const need = lightNeedOf(state);
  const needY = yAtIntensity(need);
  const bandY0 = yAtIntensity(Math.min(1, need + KEEP_BAND));
  const bandH = needY - bandY0;
  ctx.fillStyle = rgba("#f2e6a8", 0.55);
  ctx.fillRect(sx(x0 + 6), sy(bandY0), view.px(GROOVE_W - 12), view.px(Math.max(4, bandH)));
  ctx.fillStyle = PORT_LAMP;
  ctx.fillRect(sx(x0 + 3), sy(needY - 2), view.px(GROOVE_W - 6), view.px(4));
  const intensity = intensityOf(state);
  const ky = yAtIntensity(intensity);
  const inBand = intensity >= need && intensity <= need + KEEP_BAND;
  ctx.beginPath();
  ctx.arc(sx(LAMP_CX), sy(ky), view.px(13), 0, Math.PI * 2);
  ctx.fillStyle = inBand ? rgba(LANTERN, 1) : rgba("#f4e4a0", 0.95);
  ctx.fill();
  ctx.strokeStyle = rgba(INK, 0.75);
  ctx.lineWidth = Math.max(1.3, view.px(1.7));
  ctx.stroke();
  if (!inBand) {
    ctx.beginPath();
    ctx.arc(sx(LAMP_CX + 2), sy(ky - 3), view.px(4.5), 0, Math.PI * 2);
    ctx.fillStyle = rgba("#fff6c8", 0.7);
    ctx.fill();
  }
}

function drawHorn(ctx, view, state) {
  const sx = (x) => view.sx(x);
  const sy = (y) => view.sy(y);
  const blasting = !!state?.right?.blasting;
  const air = clamp01(Number.isFinite(Number(state?.air)) ? Number(state.air) : 1);
  ctx.beginPath();
  ctx.arc(sx(HORN_CX), sy(HORN_CY), view.px(HORN_SIZE / 2), 0, Math.PI * 2);
  ctx.fillStyle = blasting ? rgba(PORT_LAMP, 0.95) : rgba(HUD_BG, 0.92);
  ctx.fill();
  ctx.strokeStyle = rgba(INK, 0.7);
  ctx.lineWidth = Math.max(1.6, view.px(2));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(sx(HORN_CX), sy(HORN_CY), view.px(HORN_SIZE / 2 - 7), 0, Math.PI * 2);
  ctx.strokeStyle = rgba(INK, blasting ? 0.55 : 0.35);
  ctx.lineWidth = Math.max(1, view.px(1.4));
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `700 ${Math.max(10, view.px(12))}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("霧笛", sx(HORN_CX), sy(HORN_CY));
  if (air <= 0) {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = rgba("#1c2430", 0.25);
    ctx.beginPath();
    ctx.arc(sx(HORN_CX), sy(HORN_CY), view.px(HORN_SIZE / 2), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawVial(ctx, view, x, y, w, h, fill, color, label) {
  const sx = (v) => view.sx(v);
  const sy = (v) => view.sy(v);
  ctx.fillStyle = rgba(HUD_BG, 0.92);
  roundRect(ctx, sx(x), sy(y), view.px(w), view.px(h), view.px(4));
  ctx.fill();
  ctx.strokeStyle = rgba(INK, 0.7);
  ctx.lineWidth = Math.max(1.2, view.px(1.5));
  ctx.stroke();
  const pad = 3;
  const fh = (h - pad * 2) * clamp01(fill);
  if (fh > 0.5) {
    ctx.fillStyle = color;
    roundRect(ctx, sx(x + pad), sy(y + h - pad - fh), view.px(w - pad * 2), view.px(fh), view.px(2));
    ctx.fill();
  }
  ctx.fillStyle = INK;
  ctx.font = `700 ${Math.max(10, view.px(11))}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(label, sx(x + w / 2), sy(y + h + 4));
}

function drawGauges(ctx, view, state) {
  const oil = clamp01(Number.isFinite(Number(state?.oil)) ? Number(state.oil) : 1);
  const air = clamp01(Number.isFinite(Number(state?.air)) ? Number(state.air) : 1);
  drawVial(ctx, view, 646, 188, 20, 132, oil, oil <= 0.22 ? "#c86838" : "#c88838", "油");
  drawVial(ctx, view, 676, 188, 20, 132, air, air <= 0.22 ? "#6a7a88" : "#7aa0b0", "空気");
}

function drawThumbGuide(ctx, view, x, y, active, hint) {
  const sx = (v) => view.sx(v);
  const sy = (v) => view.sy(v);
  ctx.beginPath();
  ctx.arc(sx(x), sy(y), view.px(THUMB_GUIDE_R), 0, Math.PI * 2);
  ctx.fillStyle = rgba(HUD_BG, active ? 0.42 : hint ? 0.34 : 0.22);
  ctx.fill();
  ctx.strokeStyle = rgba(INK, active ? 0.55 : 0.32);
  ctx.lineWidth = Math.max(1, view.px(1.4));
  ctx.stroke();
}

function leftThumbPos(left, state) {
  if (left?.active && Number.isFinite(left.x) && Number.isFinite(left.y)) {
    return { x: left.x, y: left.y, active: true };
  }
  const p = headingPoint(headingOf(state));
  return { x: p.x, y: p.y, active: false };
}

function rightThumbPos(right, state) {
  if (right?.active && Number.isFinite(right.x) && Number.isFinite(right.y)) {
    return { x: right.x, y: right.y, active: true };
  }
  if (state?.right?.blasting) return { x: HORN_CX, y: HORN_CY, active: false };
  return { x: LAMP_CX, y: yAtIntensity(intensityOf(state)), active: false };
}

function chartPoint(box, along, lat) {
  const p = seaPoint(along, lat);
  const pad = 90;
  const x0 = LANTERN_POS.x - pad;
  const x1 = LANTERN_POS.x + pad;
  const y0 = SEA.yFar - 14;
  const y1 = LANTERN_POS.y + 12;
  return {
    x: box.x + ((p.x - x0) / (x1 - x0)) * box.w,
    y: box.y + ((p.y - y0) / (y1 - y0)) * box.h,
  };
}

function drawChart(ctx, box, state, opts = {}) {
  const { showShips = true, showBeam = true, title = false } = opts;
  ctx.fillStyle = title ? "#10202a" : rgba("#10202a", 0.96);
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, 4);
    ctx.fill();
  } else {
    ctx.fillRect(box.x, box.y, box.w, box.h);
  }
  ctx.strokeStyle = rgba("#eef2f4", 0.7);
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.beginPath();
  for (let t = 0; t <= 1.001; t += 0.05) {
    const p = chartPoint(box, t, 0);
    if (t === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.strokeStyle = rgba("#d8e0e6", 0.85);
  ctx.lineWidth = 1.4;
  ctx.stroke();

  const reefs = Array.isArray(state?.params?.reefs) ? state.params.reefs : [];
  for (const reef of reefs) {
    const p = chartPoint(box, Number(reef.along) || 0, Number(reef.lat) || 0);
    const r = Math.max(3.2, (Number(reef.r) || 0.05) * 42);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = REEF;
    ctx.fill();
    ctx.strokeStyle = REEF_EDGE;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  const port = portOf(state);
  const l0 = chartPoint(box, port.m0, -port.halfW);
  const l1 = chartPoint(box, port.m1, -port.halfW);
  const r0 = chartPoint(box, port.m0, port.halfW);
  const r1 = chartPoint(box, port.m1, port.halfW);
  ctx.strokeStyle = QUAY;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(l0.x, l0.y);
  ctx.lineTo(l1.x, l1.y);
  ctx.moveTo(r0.x, r0.y);
  ctx.lineTo(r1.x, r1.y);
  ctx.stroke();
  ctx.fillStyle = PORT_LAMP;
  for (const p of [l0, r0]) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  const lp = {
    x: box.x + ((LANTERN_POS.x - (LANTERN_POS.x - 90)) / 180) * box.w,
    y: box.y + ((LANTERN_POS.y - (SEA.yFar - 14)) / ((LANTERN_POS.y + 12) - (SEA.yFar - 14))) * box.h,
  };
  ctx.fillStyle = STONE_A;
  ctx.fillRect(lp.x - 2, lp.y - 7, 4, 9);
  ctx.fillStyle = LANTERN;
  ctx.beginPath();
  ctx.arc(lp.x, lp.y - 8, 2.2, 0, Math.PI * 2);
  ctx.fill();

  if (showBeam) {
    const heading = headingOf(state);
    const len = box.h * 0.7;
    ctx.beginPath();
    ctx.moveTo(lp.x, lp.y - 8);
    ctx.lineTo(lp.x + Math.sin(heading - 0.2) * len, lp.y - 8 - Math.cos(heading - 0.2) * len);
    ctx.lineTo(lp.x + Math.sin(heading + 0.2) * len, lp.y - 8 - Math.cos(heading + 0.2) * len);
    ctx.closePath();
    ctx.fillStyle = rgba(BEAM, 0.45);
    ctx.fill();
  }

  if (showShips) {
    const ships = Array.isArray(state?.ships) ? state.ships : [];
    const playT = Number(state?.playT) || 0;
    for (const sh of ships) {
      if (!sh || !Number.isFinite(Number(sh.along))) continue;
      const appear = Number(sh.appearT);
      if (Number.isFinite(appear) && playT < appear && !sh.inPort && !sh.wrecked && state?.status !== "title") continue;
      const p = chartPoint(box, sh.along, sh.lat);
      const lit = shipTrackInst(state, sh) >= 0.45;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = sh.wrecked ? "#3a3034" : lit || sh.inPort ? SHIP_LIT : "#eef2f4";
      ctx.fill();
      ctx.strokeStyle = "#1c1e26";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

}

function drawMinimap(ctx, view, state) {
  const box = {
    x: view.sx(MINIMAP.x),
    y: view.sy(MINIMAP.y),
    w: view.px(MINIMAP.w),
    h: view.px(MINIMAP.h),
  };
  drawChart(ctx, box, state, { showShips: true, showBeam: true });
  ctx.font = `700 ${Math.max(10, view.px(11))}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const label = "海";
  const lw = ctx.measureText(label).width;
  ctx.fillStyle = rgba(HUD_BG, 0.94);
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(box.x + 4, box.y + 4, lw + 10, view.px(16), 3);
    ctx.fill();
  } else {
    ctx.fillRect(box.x + 4, box.y + 4, lw + 10, view.px(16));
  }
  ctx.fillStyle = INK;
  ctx.fillText(label, box.x + 9, box.y + 4 + view.px(8));
}

/**
 * タイトルの海の縮小図。礁と港は見せ、配置の解説も数値も出さない。
 * @param {HTMLCanvasElement} canvas
 * @param {object} state
 */
export function drawTitlePreview(canvas, state) {
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = Math.max(1, canvas.clientWidth || 240);
  const cssH = Math.max(1, canvas.clientHeight || 100);
  const w = Math.round(cssW * dpr);
  const h = Math.round(cssH * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = HUD_BG;
  ctx.fillRect(0, 0, cssW, cssH);
  const pad = 6;
  drawChart(ctx, { x: pad, y: pad, w: cssW - pad * 2, h: cssH - pad * 2 }, state, {
    showShips: false,
    showBeam: false,
    title: true,
  });
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} state
 * @param {{ reducedMotion?: boolean, fx?: object, left?: object, right?: object }} [opts]
 */
export function drawScene(ctx, state, opts = {}) {
  const canvas = ctx.canvas;
  const { cssW, cssH, dpr } = syncCanvasSize(canvas);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const base = makeView(cssW, cssH);
  const reduced = !!opts.reducedMotion;
  const fx = opts.fx;
  const zoom = revealZoom(fx, reduced);
  const lantern = lanternPos();
  const view =
    zoom === 1
      ? base
      : {
          ...base,
          sx(x) {
            return base.sx(lantern.x + (x - lantern.x) * zoom);
          },
          sy(y) {
            return base.sy(lantern.y + (y - lantern.y) * zoom);
          },
          px(wu) {
            return base.px(wu * zoom);
          },
        };

  fillSky(ctx, base);
  drawSkySea(ctx, view, fx, reduced, state);
  drawCourse(ctx, view);
  drawReefs(ctx, view, state);
  drawPort(ctx, view, state);
  drawCapeAndLighthouse(ctx, view, state, fx);

  const playing = state?.status === "playing";
  const phase = state?.phase;
  const showControls = playing && phase !== "reveal";

  if (showControls) {
    drawArc(ctx, view, state);
    drawLampLever(ctx, view, state);
    drawHorn(ctx, view, state);
    drawGauges(ctx, view, state);
    const leftPos = leftThumbPos(opts.left, state);
    const rightPos = rightThumbPos(opts.right, state);
    drawThumbGuide(ctx, view, leftPos.x, leftPos.y, leftPos.active, !!state?.hintLeft);
    drawThumbGuide(ctx, view, rightPos.x, rightPos.y, rightPos.active, !!state?.hintRight);
    drawMotionGuides(ctx, view, state);
  }

  if (playing && phase === "reveal") {
    drawBeamTrail(ctx, view, fx, reduced);
    drawShipWakes(ctx, view, fx);
  }

  if (state?.status !== "over") {
    drawBeam(ctx, view, state, fx, state?.status === "title");
    drawShips(ctx, view, state);
  }

  if (playing) drawMinimap(ctx, base, state);

  drawFx(ctx, fx, { ...view, reducedMotion: reduced }, state);
}
