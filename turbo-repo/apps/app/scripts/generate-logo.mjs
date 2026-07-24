#!/usr/bin/env node
/**
 * ModularIoT "Golden Owl" logo generator.
 *
 * The mark is Bubo blakistoni (Blakiston's fish owl) drawn with three
 * instruments and one rule — every measure is a power of φ times the module a:
 *
 *   Head   — union of two circles r = φa centered (±a/φ, 0); the brow and
 *            chin creases fall at the circle crossings.
 *   Eyes   — centers (±a, 0): ring a/φ (knockout), iris a/φ² (amber),
 *            pupil a/φ³ (ink).
 *   Beak   — vesica piscis w = a/φ³, h = a/φ, tip rising to −a/φ² between
 *            the eyes; the mouth line is a chevron ribbon across it —
 *            half a cell down per cell toward the center, vertex (0, a/2),
 *            a quarter-cell (a/16) thick.
 *   Tufts  — the fish owl's wind-blown ear tufts; square-drawn polygons with
 *            every vertex on the a/4 lattice ("celled canvas"):
 *            (1, −1.5) (2.25, −2) (1.75, −1.25) (2.75, −0.75) (1.75, −0.5) · a,
 *            mirrored.
 *
 * Regenerates three artifacts:
 *   public/logo2.svg                 square mark
 *   public/logo.svg                  horizontal lockup (mark + wordmark)
 *   ../../packages/miot-auth/src/logo.ts   the same mark inlined as a string,
 *                                    so the CLI loopback pages render offline
 *
 * The wordmark glyphs are read back from the existing public/logo.svg, so the
 * script only owns the bird. Shipped files adapt to dark mode via a
 * prefers-color-scheme rule that works inside plain <img> tags.
 *
 * Usage: node scripts/generate-logo.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const a = 48;
const PHI = (1 + Math.sqrt(5)) / 2;

const G = {
  R: PHI * a, // head circles
  C: a / PHI, // head circle centers (±C, 0)
  ring: a / PHI, // eye ring (knockout)
  iris: a / PHI ** 2, // amber iris
  pupil: a / PHI ** 3, // ink pupil
  cross: Math.sqrt(PHI ** 2 - PHI ** -2) * a, // head outline crossings (0, ±cross)
  bW: a / PHI ** 3, // beak vesica half-width
  bH: a / PHI, // beak vesica half-height
  bTip: -a / PHI ** 2, // beak tip y
  tuft: [
    [1.0, -1.5],
    [2.25, -2.0],
    [1.75, -1.25],
    [2.75, -0.75],
    [1.75, -0.5],
  ],
};
const bY = G.bTip + G.bH;

const NAVY = "#072444";
const AMBER = "#FAB55E";
const PORCELAIN = "#E9F0F7";

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

// the mouth line: a chevron ribbon across the vesica — half a cell down per
// cell toward the center, vertex at (0, a/2), a quarter-cell (a/16) thick
function beakLine() {
  const x = a / 4,
    y1 = 0.375 * a,
    y2 = a / 2,
    t = a / 16;
  return (
    `M${fmt(-x)} ${fmt(y1)} L0 ${fmt(y2)} L${fmt(x)} ${fmt(y1)} ` +
    `L${fmt(x)} ${fmt(y1 + t)} L0 ${fmt(y2 + t)} L${fmt(-x)} ${fmt(y1 + t)} Z`
  );
}

// single stitched outline of the two-circle union (nonzero-safe: one subpath)
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
    pts
      .map((p, i) => `${i ? "L" : "M"}${fmt(side * p[0] * a)} ${fmt(p[1] * a)}`)
      .join(" ") + " Z"
  );
}

const geomComment =
  `<!-- ModularIoT "Golden Owl" (Bubo blakistoni) - every measure is a power of phi.\n` +
  `     Head: two circles r=phi*a at (+/-a/phi, 0), stitched union outline.\n` +
  `     Eyes at (+/-a, 0): ring a/phi, iris a/phi^2 (amber), pupil a/phi^3 (ink).\n` +
  `     Beak: vesica w=a/phi^3 h=a/phi, tip at -a/phi^2; mouth line = chevron\n` +
  `     ribbon, slope 1:2 to vertex (0, a/2), thickness a/16.\n` +
  `     Tufts: polygons on the a/4 lattice, mirrored. a=${a}.\n` +
  `     Regenerate with: node scripts/generate-logo.mjs -->\n`;

const adaptiveStyle = `  <style>.ink{fill:${NAVY}}@media (prefers-color-scheme:dark){.ink{fill:${PORCELAIN}}}</style>\n`;

const markBody =
  `  <path class="ink" fill-rule="nonzero" d="${headOutline()} ${tuftPath(1)} ${tuftPath(-1)} ` +
  `${circlePath(-a, 0, G.ring, true)} ${circlePath(a, 0, G.ring, true)} ` +
  `${vesicaPath(G.bW, G.bH, bY, true)}"/>\n` +
  `  <circle cx="${fmt(-a)}" cy="0" r="${fmt(G.iris)}" fill="${AMBER}"/>\n` +
  `  <circle cx="${fmt(a)}" cy="0" r="${fmt(G.iris)}" fill="${AMBER}"/>\n` +
  `  <circle class="ink" cx="${fmt(-a)}" cy="0" r="${fmt(G.pupil)}"/>\n` +
  `  <circle class="ink" cx="${fmt(a)}" cy="0" r="${fmt(G.pupil)}"/>\n` +
  `  <path class="ink" d="${beakLine()}"/>\n`;

const here = dirname(fileURLToPath(import.meta.url));
const pub = join(here, "..", "public");

const logo2 =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-146 -158 292 292" width="292" height="292" role="img" aria-label="ModularIoT">\n` +
  geomComment +
  adaptiveStyle +
  markBody +
  `</svg>\n`;

const currentLockup = readFileSync(join(pub, "logo.svg"), "utf8");
const wordmarkMatch = currentLockup.match(
  /<path class="ink" d="(M335\.182[^"]+)"\/>/
);
if (!wordmarkMatch) {
  throw new Error(
    "Wordmark path not found in public/logo.svg — restore it from git history first."
  );
}

const logo =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1052 256" width="1052" height="256" role="img" aria-label="ModularIoT">\n` +
  geomComment +
  adaptiveStyle +
  `  <g transform="translate(146,140)">\n` +
  markBody.replace(/^/gm, "  ") +
  `  </g>\n` +
  `  <path class="ink" d="${wordmarkMatch[1]}"/>\n` +
  `</svg>\n`;

// The CLI loopback pages (packages/miot-auth) inline the mark so they render
// offline, with no network and no /public to fetch from. That copy declares
// itself generated from this file, so generate it here rather than letting the
// two drift. Two differences from the shipped asset: the class is namespaced,
// because an inline <svg><style> in an HTML document is document-scoped and a
// bare `.ink` would leak onto the host page; and no width/height, so the page's
// own `.logo svg` rule sizes it.
const inlineMark =
  `<svg role="img" aria-label="Organization logo" viewBox="-146 -158 292 292" xmlns="http://www.w3.org/2000/svg">` +
  `<style>.miot-owl-ink{fill:${NAVY}}@media (prefers-color-scheme:dark){.miot-owl-ink{fill:${PORCELAIN}}}</style>` +
  markBody
    .replace(/class="ink"/g, 'class="miot-owl-ink"')
    .replace(/\n\s*/g, "")
    .trim() +
  `</svg>`;

// Single-quoted on purpose: the markup is full of double quotes and has none of
// its own, so this is the literal prettier would write. Emitting the shape
// prettier wants keeps `npm run format` and this script from fighting over the
// file forever.
const tsLiteral = `'${inlineMark.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

const authLogoTs =
  `// AUTO-GENERATED from apps/app/public/logo2.svg — do not edit by hand.\n` +
  `// Regenerate with: node scripts/generate-logo.mjs (in apps/app).\n` +
  `// Inlined so the CLI loopback success/error pages render the org logo offline.\n` +
  `export const ORG_LOGO_SVG =\n  ${tsLiteral};\n`;

const authLogoPath = join(
  here,
  "..",
  "..",
  "..",
  "packages",
  "miot-auth",
  "src",
  "logo.ts"
);
if (!existsSync(dirname(authLogoPath))) {
  throw new Error(
    `Expected packages/miot-auth/src at ${dirname(authLogoPath)} — the CLI ` +
      `loopback pages inline this mark, and skipping it silently is how the ` +
      `two copies drifted apart before. Fix the path or remove this step.`
  );
}

writeFileSync(join(pub, "logo2.svg"), logo2);
writeFileSync(join(pub, "logo.svg"), logo);
writeFileSync(authLogoPath, authLogoTs);
console.log(
  "Regenerated public/logo2.svg, public/logo.svg and",
  "packages/miot-auth/src/logo.ts (Golden Owl, a =",
  a + ")"
);
