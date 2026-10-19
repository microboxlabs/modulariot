/** The narration without its status lines ("Connecting…", "Thinking…"):
 * they say what is happening now, and are not steps. */
export function withoutStatusLines(
  text: string,
  statusLines: readonly string[]
): string {
  if (statusLines.length === 0) return text;
  return text
    .split("\n")
    .filter((line) => !statusLines.includes(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Splits the run narration into the steps already done and the one in
 * progress, which is its last non-empty line. Status lines are left out of
 * the steps done.
 */
export function splitNarration(
  text: string,
  statusLines: readonly string[] = []
): {
  earlier: string;
  current: string | null;
} {
  const trimmed = text.trimEnd();
  const cut = trimmed.lastIndexOf("\n");
  const current = trimmed.slice(cut + 1).trim();
  return {
    earlier:
      cut < 0
        ? ""
        : withoutStatusLines(trimmed.slice(0, cut), statusLines).trimEnd(),
    current: current || null,
  };
}

/** Where the run's timer counts from: the earlier of the reply's creation
 * and the harness's own start. A reply rebuilt after a reload is created
 * late; the harness start keeps it counting from the real beginning. */
export function runElapsedSince(
  runStartedAt: number | null,
  createdAt: Date | undefined
): Date | undefined {
  if (runStartedAt === null) return createdAt;
  if (!createdAt) return new Date(runStartedAt);
  return new Date(Math.min(runStartedAt, createdAt.getTime()));
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
