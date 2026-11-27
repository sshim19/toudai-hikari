/**
 * 半透明の操作案内。矢印と、動きを示す親指の残像。描画だけ。エンジンは見ない。
 */

export const GUIDE_INK = "#1c2430";
export const GUIDE_FILL = "#f5f0e6";

export function prefersReducedMotion() {
  try {
    return !!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  } catch {
    return false;
  }
}

export function guideNow() {
  return (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
}

export function rgba(hex, a) {
  const h = String(hex || "#1c2430").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function pingPong(t, period = 2.2) {
  const p = Math.max(0.2, Number(period) || 2.2);
  const c = ((Number(t) % p) + p) % p;
  const h = p / 2;
  return c < h ? c / h : 2 - c / h;
}

export function cycle(t, period = 2.4) {
  const p = Math.max(0.2, Number(period) || 2.4);
  return (((Number(t) % p) + p) % p) / p;
}

export function pathLine(x0, y0, x1, y1, steps = 20) {
  const n = Math.max(2, steps | 0);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push({ x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u });
  }
  return pts;
}

export function pathCircle(cx, cy, rx, ry, steps = 48, start = 0, span = Math.PI * 2) {
  const n = Math.max(8, steps | 0);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = start + (span * i) / n;
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return pts;
}

export function pathArc(cx, cy, r, a0, a1, steps = 28) {
  const n = Math.max(4, steps | 0);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    pts.push({ x: cx + Math.sin(a) * r, y: cy - Math.cos(a) * r });
  }
  return pts;
}

export function pathW(cx, cy, amp, width, steps = 32) {
  const n = Math.max(8, steps | 0);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const p = i / n;
    pts.push({
      x: cx + Math.sin(p * Math.PI * 2) * (width / 2),
      y: cy - amp / 2 + p * amp,
    });
  }
  return pts;
}

export function samplePath(pts, u) {
  if (!pts || pts.length === 0) return { x: 0, y: 0, tx: 1, ty: 0 };
  if (pts.length === 1) return { x: pts[0].x, y: pts[0].y, tx: 1, ty: 0 };
  const t = Math.max(0, Math.min(1, Number(u) || 0));
  const f = t * (pts.length - 1);
  const i = Math.min(pts.length - 2, Math.floor(f));
  const p = f - i;
  const a = pts[i];
  const b = pts[i + 1];
  const x = a.x + (b.x - a.x) * p;
  const y = a.y + (b.y - a.y) * p;
  let tx = b.x - a.x;
  let ty = b.y - a.y;
  const len = Math.hypot(tx, ty) || 1;
  return { x, y, tx: tx / len, ty: ty / len };
}

export function drawPathStroke(ctx, view, pts, color, alpha) {
  if (!pts || pts.length < 2) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(view.sx(pts[0].x), view.sy(pts[0].y));
  for (let i = 1; i < pts.length; i++) ctx.lineTo(view.sx(pts[i].x), view.sy(pts[i].y));
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = Math.max(1.4, view.px(2.2));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash([view.px(5), view.px(4.5)]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

export function drawGhostThumb(ctx, view, x, y, color, fill, alpha, radius = 17) {
  const cx = view.sx(x);
  const cy = view.sy(y);
  const r = view.px(radius);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = rgba(fill, Math.min(0.55, alpha * 0.85));
  ctx.fill();
  ctx.strokeStyle = rgba(color, Math.min(0.75, alpha + 0.12));
  ctx.lineWidth = Math.max(1.4, view.px(1.8));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = rgba(color, alpha * 0.45);
  ctx.fill();
  ctx.restore();
}

export function drawArrow(ctx, view, x, y, tx, ty, color, alpha, len = 22) {
  const L = Math.hypot(tx, ty) || 1;
  const ux = tx / L;
  const uy = ty / L;
  const px = -uy;
  const py = ux;
  const tipX = x + ux * (len * 0.55);
  const tipY = y + uy * (len * 0.55);
  const baseX = x - ux * (len * 0.35);
  const baseY = y - uy * (len * 0.35);
  const w = len * 0.34;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(view.sx(tipX), view.sy(tipY));
  ctx.lineTo(view.sx(baseX + px * w), view.sy(baseY + py * w));
  ctx.lineTo(view.sx(baseX - px * w), view.sy(baseY - py * w));
  ctx.closePath();
  ctx.fillStyle = rgba(color, alpha);
  ctx.fill();
  ctx.restore();
}

/**
 * 点線の軌道の上を、残像と矢印が往復（または一周）する。
 * @param {{ period?: number, loop?: "pingpong"|"cycle", reduced?: boolean, color?: string, fill?: string, alpha?: number, thumbR?: number, arrowLen?: number }} [opts]
 */
export function drawTravelGuide(ctx, view, pts, t, opts = {}) {
  if (!pts || pts.length < 2) return;
  const color = opts.color || GUIDE_INK;
  const fill = opts.fill || GUIDE_FILL;
  const period = opts.period ?? 2.3;
  const reduced = !!opts.reduced;
  const alpha = opts.alpha ?? 0.46;
  const thumbR = opts.thumbR ?? 17;
  const arrowLen = opts.arrowLen ?? 22;
  const loop = opts.loop || "pingpong";
  const u = reduced ? 0.38 : loop === "cycle" ? cycle(t, period) : pingPong(t, period);
  const pos = samplePath(pts, u);
  let tx = pos.tx;
  let ty = pos.ty;
  if (loop === "pingpong" && !reduced) {
    const p = Math.max(0.2, period);
    const c = ((Number(t) % p) + p) % p;
    if (c >= p / 2) {
      tx = -tx;
      ty = -ty;
    }
  }
  drawPathStroke(ctx, view, pts, color, alpha * 0.55);
  const ahead = 20;
  drawGhostThumb(ctx, view, pos.x, pos.y, color, fill, alpha, thumbR);
  drawArrow(ctx, view, pos.x + tx * ahead, pos.y + ty * ahead, tx, ty, color, Math.min(0.7, alpha + 0.16), arrowLen);
}

/**
 * その場で押さえる案内。残像が脈打ち、内側を向く小さな矢印が付く。
 */
export function drawHoldGuide(ctx, view, x, y, t, opts = {}) {
  const color = opts.color || GUIDE_INK;
  const fill = opts.fill || GUIDE_FILL;
  const alpha = opts.alpha ?? 0.48;
  const radius = opts.thumbR ?? 18;
  const ring = opts.ring ?? 34;
  const reduced = !!opts.reduced;
  const pulse = reduced ? 1 : 0.88 + 0.12 * (0.5 + 0.5 * Math.sin((Number(t) || 0) * Math.PI * 2 * 1.15));
  drawGhostThumb(ctx, view, x, y, color, fill, alpha * pulse, radius * pulse);
  const n = opts.arrows ?? 4;
  const start = opts.startAng ?? 0;
  for (let i = 0; i < n; i++) {
    const a = start + (Math.PI * 2 * i) / n;
    const ox = Math.cos(a);
    const oy = Math.sin(a);
    const d = ring * (reduced ? 1 : 0.92 + 0.08 * pulse);
    drawArrow(ctx, view, x + ox * d, y + oy * d, -ox, -oy, color, alpha * 0.7, opts.arrowLen ?? 16);
  }
}
