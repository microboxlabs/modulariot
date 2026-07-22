#!/usr/bin/env node
/**
 * ModularIoT "Lynx" logo generator (the Golden Owl, second vote — Option II).
 *
 * The mark is Bubo blakistoni drawn with three instruments and one rule —
 * every measure is a power of φ times the module a:
 *
 *   Head   — union of two circles r = φa centered (±a/φ, 0).
 *   Eyes   — centers (±a, 0): ring a/φ (knockout), iris a/φ² (amber),
 *            pupil a/φ³ (ink).
 *   Beak   — vesica piscis w = a/φ³, h = a/φ, tip rising to −a/φ²; the mouth
 *            line is a chevron ribbon, slope 1:2, vertex (0, a/2), a/16 thick.
 *   Tufts  — the Lynx re-pin: root slides to the crown (0.25a, −1.5a) and the
 *            tips land on a frame of the head's own width — upper (2a, (φ−2√5)a),
 *            outer (√5a, −1.25a) reached dead level from the notch. Since
 *            φ³ + φ⁻³ = 2√5 the mark closes an exact square by horn angle alone.
 *
 * Emits:
 *   public/headlogo.svg        adaptive square mark (prefers-color-scheme)
 *   public/headlogo-dark.svg   explicit dark-surface mark
 *   public/logo.svg            adaptive lockup, two-tone (Modular ink · IoT amber)
 *   public/logo-dark.svg       explicit dark-surface lockup
 *   app/icon.svg               favicon tile (ink tile, porcelain owl)
 *   components/v2/brand/lynx-geometry.ts   path data for the React components
 *
 * Usage: node scripts/generate-logo.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WORDMARK_MODULAR, WORDMARK_IOT } from "./wordmark-paths.mjs";

const a = 48;
const PHI = (1 + Math.sqrt(5)) / 2;
const S5 = Math.sqrt(5);

const G = {
  R: PHI * a,
  C: a / PHI,
  ring: a / PHI,
  iris: a / PHI ** 2,
  pupil: a / PHI ** 3,
  cross: Math.sqrt(PHI ** 2 - PHI ** -2) * a,
  bW: a / PHI ** 3,
  bH: a / PHI,
  bTip: -a / PHI ** 2,
  // the Lynx tuft — root on the crown, tips pinned to the 2√5 frame
  tuft: [
    [0.25, -1.5],
    [2, PHI - 2 * S5],
    [1.75, -1.25],
    [S5, -1.25],
    [1.75, -0.75],
  ],
};
const bY = G.bTip + G.bH;

// Brand ink + amber, per the geometry folio: amber deepens on light surfaces
// to hold contrast; porcelain ink on dark.
const INK = "#13273D";
const INK_DARK = "#E8EFF7";
const AMBER = "#E08A28";
const AMBER_DARK = "#F5AE55";

const fmt = (n) => {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? "0" : String(r);
};

function circlePath(x, y, r, ccw = false) {
  const s = ccw ? 0 : 1;
  return (
    `M${fmt(x - r)} ${fmt(y)} A${fmt(r)} ${fmt(r)} 0 1 ${s} ${fmt(x + r)} ${fmt(y)} ` +
    `A${fmt(r)} ${fmt(r)} 0 1 ${s} ${fmt(x - r)} ${fmt(y)} Z`
  );
}

function vesicaPath(w, h, yC, ccw = false) {
  const r = (w + (h * h) / w) / 2;
  const s = ccw ? 0 : 1;
  return (
    `M0 ${fmt(yC - h)} A${fmt(r)} ${fmt(r)} 0 0 ${s} 0 ${fmt(yC + h)} ` +
    `A${fmt(r)} ${fmt(r)} 0 0 ${s} 0 ${fmt(yC - h)} Z`
  );
}

function beakLine() {
  const x = a / 4, y1 = 0.375 * a, y2 = a / 2, t = a / 16;
  return (
    `M${fmt(-x)} ${fmt(y1)} L0 ${fmt(y2)} L${fmt(x)} ${fmt(y1)} ` +
    `L${fmt(x)} ${fmt(y1 + t)} L0 ${fmt(y2 + t)} L${fmt(-x)} ${fmt(y1 + t)} Z`
  );
}

function headOutline() {
  const c = G.cross;
  return (
    `M0 ${fmt(-c)} A${fmt(G.R)} ${fmt(G.R)} 0 1 1 0 ${fmt(c)} ` +
    `A${fmt(G.R)} ${fmt(G.R)} 0 1 1 0 ${fmt(-c)} Z`
  );
}

function tuftPath(side) {
  const pts = side > 0 ? G.tuft : [...G.tuft].reverse();
  return (
    pts.map((p, i) => `${i ? "L" : "M"}${fmt(side * p[0] * a)} ${fmt(p[1] * a)}`).join(" ") + " Z"
  );
}

const solid =
  `${headOutline()} ${tuftPath(1)} ${tuftPath(-1)} ` +
  `${circlePath(-a, 0, G.ring, true)} ${circlePath(a, 0, G.ring, true)} ` +
  `${vesicaPath(G.bW, G.bH, bY, true)}`;

const MARK_VB = "-146 -158 292 292";
const LOCKUP_VB = "0 0 1052 256";

const geomComment =
  `<!-- ModularIoT "Lynx" (the Golden Owl, horns re-pinned to a 2-root-5 frame).\n` +
  `     Every measure is a power of phi times a=${a}; phi^3 + phi^-3 = 2*sqrt(5),\n` +
  `     so the mark closes an exact square by horn angle alone.\n` +
  `     Regenerate with: node scripts/generate-logo.mjs -->\n`;

function markBody(cls = true, ink = INK, amber = AMBER) {
  const inkAttr = cls ? `class="ink"` : `fill="${ink}"`;
  const ambAttr = cls ? `class="amb"` : `fill="${amber}"`;
  return (
    `  <path ${inkAttr} fill-rule="nonzero" d="${solid}"/>\n` +
    `  <circle ${ambAttr} cx="${fmt(-a)}" cy="0" r="${fmt(G.iris)}"/>\n` +
    `  <circle ${ambAttr} cx="${fmt(a)}" cy="0" r="${fmt(G.iris)}"/>\n` +
    `  <circle ${inkAttr} cx="${fmt(-a)}" cy="0" r="${fmt(G.pupil)}"/>\n` +
    `  <circle ${inkAttr} cx="${fmt(a)}" cy="0" r="${fmt(G.pupil)}"/>\n` +
    `  <path ${inkAttr} d="${beakLine()}"/>\n`
  );
}

const adaptiveStyle =
  `  <style>.ink{fill:${INK}}.amb{fill:${AMBER}}` +
  `@media (prefers-color-scheme:dark){.ink{fill:${INK_DARK}}.amb{fill:${AMBER_DARK}}}</style>\n`;

function markSvg({ adaptive, ink, amber }) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VB}" role="img" aria-label="ModularIoT">\n` +
    geomComment +
    (adaptive ? adaptiveStyle : "") +
    markBody(adaptive, ink, amber) +
    `</svg>\n`
  );
}

function lockupSvg({ adaptive, ink, amber }) {
  const inkAttr = adaptive ? `class="ink"` : `fill="${ink}"`;
  const ambAttr = adaptive ? `class="amb"` : `fill="${amber}"`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOCKUP_VB}" role="img" aria-label="ModularIoT">\n` +
    geomComment +
    (adaptive ? adaptiveStyle : "") +
    `<g transform="translate(146,140)">\n` +
    markBody(adaptive, ink, amber) +
    `</g>\n` +
    `<path ${inkAttr} d="${WORDMARK_MODULAR}"/>\n` +
    `<path ${ambAttr} d="${WORDMARK_IOT}"/>\n` +
    `</svg>\n`
  );
}

// Favicon tile — fixed colors (a favicon cannot follow the page theme):
// ink tile, porcelain owl, dark-surface amber.
const iconSvg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="ModularIoT">\n` +
  `<rect width="512" height="512" rx="112" fill="${INK}"/>\n` +
  `<svg x="72" y="72" width="368" height="368" viewBox="${MARK_VB}">\n` +
  markBody(false, INK_DARK, AMBER_DARK) +
  `</svg>\n` +
  `</svg>\n`;

const geometryTs = `// GENERATED by scripts/generate-logo.mjs — do not edit by hand.
// The ModularIoT "Lynx" mark: single nonzero solid (head + tufts with eye-ring
// and beak knockouts), amber irises, ink pupils, chevron mouth line.
export const LYNX_VIEWBOX = ${JSON.stringify(MARK_VB)};
export const LYNX_SOLID = ${JSON.stringify(solid)};
export const LYNX_EYE_X = ${fmt(a)};
export const LYNX_IRIS_R = ${fmt(G.iris)};
export const LYNX_PUPIL_R = ${fmt(G.pupil)};
export const LYNX_BEAK_LINE = ${JSON.stringify(beakLine())};
export const LOCKUP_VIEWBOX = ${JSON.stringify(LOCKUP_VB)};
export const LOCKUP_MARK_TRANSFORM = "translate(146,140)";
export const WORDMARK_MODULAR = ${JSON.stringify(WORDMARK_MODULAR)};
export const WORDMARK_IOT = ${JSON.stringify(WORDMARK_IOT)};
`;

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const out = (rel, content) => {
  writeFileSync(join(root, rel), content);
  console.log("wrote", rel);
};

out("public/headlogo.svg", markSvg({ adaptive: true }));
out("public/headlogo-dark.svg", markSvg({ adaptive: false, ink: INK_DARK, amber: AMBER_DARK }));
out("public/logo.svg", lockupSvg({ adaptive: true }));
out("public/logo-dark.svg", lockupSvg({ adaptive: false, ink: INK_DARK, amber: AMBER_DARK }));
out("app/icon.svg", iconSvg);
out("components/v2/brand/lynx-geometry.ts", geometryTs);
