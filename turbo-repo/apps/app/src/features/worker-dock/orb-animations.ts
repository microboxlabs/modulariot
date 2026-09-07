import { MathUtils } from "three";

/**
 * Transform offsets layered on top of the orb's resting pose. Anything omitted
 * means "no change" (position 0, scale 1, rotation 0).
 */
export type OrbTransformOffset = {
  px?: number;
  py?: number;
  pz?: number;
  /** uniform scale multiplier */
  scale?: number;
  sx?: number;
  sy?: number;
  sz?: number;
  rx?: number;
  ry?: number;
  rz?: number;
};

// How far (in orb radii) an orb travels to sit fully outside its little box.
const HIDE = 3.4;

// scale curve with a soft overshoot near the end
const backOut = (q: number) => {
  const x = MathUtils.clamp(q, 0, 1) - 1;
  return 1 + 2.9 * x ** 3 + 1.9 * x ** 2;
};

/**
 * The ways a worker orb can come and go. Each entry reads a visibility value
 * `q` — 0 = fully hidden, 1 = fully seated — and returns the offset to apply at
 * that moment. The SAME entry drives both directions: an appear ramps `q` 0→1,
 * a disappear ramps it 1→0. Every entry MUST return the identity at `q === 1`
 * so the orb rests cleanly.
 *
 * `t` is the shared clock time, for entries that want some wobble.
 */
export const ORB_TRANSITIONS: ReadonlyArray<{
  readonly name: string;
  readonly at: (q: number, t: number) => OrbTransformOffset;
}> = [
  {
    // straight up from below the box, stretched tall
    name: "rise",
    at: (q) => ({
      py: (1 - q) * -HIDE,
      sy: 1 + (1 - q) * 0.4,
      sx: 1 - (1 - q) * 0.12,
      sz: 1 - (1 - q) * 0.12,
    }),
  },
  {
    // down from above the box, stretched tall
    name: "drop",
    at: (q) => ({
      py: (1 - q) * HIDE,
      sy: 1 + (1 - q) * 0.4,
      sx: 1 - (1 - q) * 0.12,
      sz: 1 - (1 - q) * 0.12,
    }),
  },
  {
    // scales up from a dot with a little overshoot
    name: "pop",
    at: (q) => ({ scale: Math.max(0, backOut(q)) }),
  },
  {
    // spins in from the side while scaling up
    name: "swirl",
    at: (q) => ({
      scale: q,
      ry: (1 - q) * Math.PI * 2.6,
      px: (1 - q) * HIDE * 0.55,
      rz: (1 - q) * 0.5,
    }),
  },
];

/** Random index into {@link ORB_TRANSITIONS}, chosen fresh per appear / disappear. */
export const pickOrbTransition = (): number =>
  Math.floor(Math.random() * ORB_TRANSITIONS.length);

/**
 * In-place idle→hover reactions. `k` is the hover strength (0 = resting,
 * 1 = fully hovered); `t` is the shared clock. One is chosen at random each
 * time the pointer enters an orb.
 */
export const ORB_HOVERS: ReadonlyArray<(t: number, k: number) => OrbTransformOffset> = [
  // bounce up and down
  (t, k) => ({
    py: Math.abs(Math.sin(t * 9)) * 0.34 * k,
    sy: 1 + Math.sin(t * 9 + 0.6) * 0.1 * k,
  }),
  // rock side to side
  (t, k) => ({
    rz: Math.sin(t * 11) * 0.3 * k,
    px: Math.sin(t * 11) * 0.13 * k,
  }),
  // slow tumble
  (t, k) => ({
    ry: t * 3.2 * k,
    py: Math.sin(t * 4) * 0.07 * k,
  }),
  // breathe / pulse
  (t, k) => {
    const p = 1 + Math.sin(t * 8) * 0.13 * k;
    return { sx: p, sy: p, sz: p };
  },
];

export const pickOrbHover = (): number =>
  Math.floor(Math.random() * ORB_HOVERS.length);
