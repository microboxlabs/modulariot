/**
 * Splits the run narration into the steps already done and the one in
 * progress, which is its last non-empty line.
 */
export function splitNarration(text: string): {
  earlier: string;
  current: string | null;
} {
  const trimmed = text.trimEnd();
  const cut = trimmed.lastIndexOf("\n");
  const current = trimmed.slice(cut + 1).trim();
  return {
    earlier: cut < 0 ? "" : trimmed.slice(0, cut).trimEnd(),
    current: current || null,
  };
}

/** mm:ss, growing to h:mm:ss past an hour. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  if (hours > 0)
    return `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`;
  return `${String(minutes).padStart(2, "0")}:${seconds}`;
}
