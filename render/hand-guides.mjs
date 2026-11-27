/** 灯台の光: 左手は弧の上をずらし、右手は明るさの溝を上下。霧笛は点滅の印。 */
import * as C from "../engine/constants.mjs";
import {
  GUIDE_FILL,
  GUIDE_INK,
  drawArrow,
  drawGhostThumb,
  drawTravelGuide,
  guideNow,
  pathArc,
  pathLine,
  prefersReducedMotion,
} from "./motion-guide.mjs";

const ARC_CX = C.ARC_CX ?? C.LENS_CX ?? 188;
const ARC_CY = C.ARC_CY ?? C.LENS_CY ?? 312;
const ARC_R = C.ARC_R ?? C.LENS_R ?? 102;
const LAMP_CX = C.LAMP_CX ?? C.LEVER_CX ?? 600;
const GROOVE_Y1 = C.GROOVE_Y1 ?? C.LAMP_Y1 ?? 368;
const GROOVE_Y0 = C.GROOVE_Y0 ?? GROOVE_Y1 - (C.GROOVE_H ?? 200);
const HORN_CX = C.HORN_CX ?? 748;
const HORN_CY = C.HORN_CY ?? 268;

export function drawMotionGuides(ctx, view, state) {
  if (state?.status !== "playing") return;
  if (state.phase === "reveal") return;
  const reduced = prefersReducedMotion();
  const t = guideNow();
  if (state.hintLeft !== false) {
    drawTravelGuide(ctx, view, pathArc(ARC_CX, ARC_CY, ARC_R, -1.15, 1.15, 28), t, {
      period: 2.8,
      loop: "pingpong",
      reduced,
      alpha: 0.5,
    });
  }
  if (state.hintRight !== false) {
    const pts = pathLine(LAMP_CX, GROOVE_Y1 - 8, LAMP_CX, GROOVE_Y0 + 8, 18);
    drawTravelGuide(ctx, view, pts, t, { period: 2.3, loop: "pingpong", reduced, alpha: 0.46 });
    const pulse = reduced ? 1 : 0.82 + 0.18 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 1.3));
    drawGhostThumb(ctx, view, HORN_CX, HORN_CY, GUIDE_INK, GUIDE_FILL, 0.32 * pulse, 13);
    drawArrow(ctx, view, HORN_CX, HORN_CY + 28, 0, -1, GUIDE_INK, 0.4 * pulse, 14);
  }
}
