/** A frame that reached the platform this late (in seconds) gets a ring. */
export const LATE_FRAME_S = 600;

type Frame = {
  timestamp: string;
  longitude: number | null;
  latitude: number | null;
  received_at?: string | null;
  delay_s?: number | null;
};

export type LngLatPoint = [number, number];

type PositionedFrame = Frame & { longitude: number; latitude: number };

/** Rows without a geographic position cannot be drawn as rings or silence endpoints. */
export function hasFramePosition(frame: Frame): frame is PositionedFrame {
  return Number.isFinite(frame.longitude) && Number.isFinite(frame.latitude);
}

/** Seconds between the frame's GPS time and its arrival, or null if unknown. */
export function frameDelay(frame: Frame | null | undefined): number | null {
  if (!frame) return null;
  if (typeof frame.delay_s === "number" && Number.isFinite(frame.delay_s))
    return frame.delay_s;
  if (!frame.received_at) return null;
  const sent = new Date(frame.timestamp).getTime();
  const received = new Date(frame.received_at).getTime();
  if (Number.isNaN(sent) || Number.isNaN(received)) return null;
  return Math.round((received - sent) / 1000);
}

export function isLate(frame: Frame): boolean {
  const delay = frameDelay(frame);
  return delay !== null && delay >= LATE_FRAME_S;
}

/**
 * The silence of a lost signal: from the last frame at or before `lostSince`
 * to the first frame after it. Null while the vehicle is still silent, or
 * without a lost signal.
 */
export function silenceGap(
  frames: Frame[] | null | undefined,
  lostSince: string | null | undefined
): { from: LngLatPoint; to: LngLatPoint } | null {
  if (!frames?.length || !lostSince) return null;
  const lost = new Date(lostSince).getTime();
  if (Number.isNaN(lost)) return null;
  let before: PositionedFrame | null = null;
  let after: PositionedFrame | null = null;
  for (const f of frames) {
    if (!hasFramePosition(f)) continue;
    const t = new Date(f.timestamp).getTime();
    if (Number.isNaN(t)) continue;
    if (t <= lost && (!before || t >= new Date(before.timestamp).getTime()))
      before = f;
    if (t > lost && (!after || t < new Date(after.timestamp).getTime()))
      after = f;
  }
  if (!before || !after) return null;
  return {
    from: [before.longitude, before.latitude],
    to: [after.longitude, after.latitude],
  };
}

/** A straight line cut into `dashes` dashes with equal gaps, for a dashed look. */
export function dashSegments(
  from: LngLatPoint,
  to: LngLatPoint,
  dashes = 12
): { from: LngLatPoint; to: LngLatPoint }[] {
  const pieces = dashes * 2 - 1;
  const at = (i: number): LngLatPoint => [
    from[0] + ((to[0] - from[0]) * i) / pieces,
    from[1] + ((to[1] - from[1]) * i) / pieces,
  ];
  const out: { from: LngLatPoint; to: LngLatPoint }[] = [];
  for (let i = 0; i < pieces; i += 2) out.push({ from: at(i), to: at(i + 1) });
  return out;
}
