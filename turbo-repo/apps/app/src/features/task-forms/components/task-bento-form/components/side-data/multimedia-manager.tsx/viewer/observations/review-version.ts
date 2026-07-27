import type { TimelineEntry } from "./observation.types";

/** A verdict as the reviewer states it. Mirrors `ReviewStatus` without importing the gallery. */
export type ReviewVerdict = "approved" | "rejected" | "pending";

/** One revision's decisions, oldest first. `version` is null for a decision taken before the
 *  repository versioned the node. */
export type VersionGroup = {
  version: string | null;
  entries: TimelineEntry[];
};

/** Two versions are the same revision. `null` and `undefined` both mean "no label". */
function sameVersion(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? null) === (b ?? null);
}

/**
 * Whether an entry decided the revision currently on screen.
 *
 * Entries with no version at all count as current. Those are the forum-era ones, which never
 * recorded a revision: filing them under a version they never named would hide the only review
 * history that content has.
 */
export function judgedCurrentVersion(
  entry: TimelineEntry,
  currentVersion: string | null | undefined
): boolean {
  if (entry.kind !== "state_change") return true;
  if (entry.version === undefined) return true;
  return sameVersion(entry.version, currentVersion);
}

/**
 * Splits a timeline into what decided the revision on screen and what decided earlier ones.
 *
 * @param entries oldest first, as the repository returns rounds
 * @returns `current` in the input order; `history` grouped by version, most recently decided
 *          group first, so the revision just replaced is the one the reader reaches first
 */
export function splitByVersion(
  entries: readonly TimelineEntry[],
  currentVersion: string | null | undefined
): { current: TimelineEntry[]; history: VersionGroup[] } {
  const current: TimelineEntry[] = [];
  // Null keys a group of its own: decisions taken before the node was versioned are one
  // revision between them, not one group each.
  const groups = new Map<string | null, VersionGroup>();

  for (const entry of entries) {
    if (judgedCurrentVersion(entry, currentVersion)) {
      current.push(entry);
      continue;
    }
    // A string or null - `undefined` was taken as current above.
    const version = (entry as { version: string | null }).version;
    const group = groups.get(version) ?? { version, entries: [] };
    group.entries.push(entry);
    groups.set(version, group);
  }

  // By when the group was last decided, not by parsing "1.10" as a number — the label is the
  // repository's to shape, and a decision's own timestamp orders reliably whatever it looks like.
  const history = [...groups.values()].sort((a, b) => lastDecidedAt(b) - lastDecidedAt(a));
  return { current, history };
}

function lastDecidedAt(group: VersionGroup): number {
  return group.entries.reduce((latest, entry) => {
    const at = entry.kind === "state_change" ? entry.committedAt : entry.createdAt;
    return Math.max(latest, at.getTime());
  }, 0);
}

/**
 * The verdict standing against the revision on screen, or null when the timeline cannot say.
 *
 * Only version-stamped entries — review rounds — can answer. A timeline built from the forum
 * has no idea which revision it judged, so this returns null and the caller keeps the stored
 * `mintral:reviewStatus`, which is the only fact that era recorded.
 *
 * Rounds that all judged earlier revisions give `"pending"`: the content has been replaced
 * since and nobody has looked at what replaced it. That is the whole point of the reset the
 * repository already performs on re-upload, which the panel used to contradict by showing the
 * superseded rejection as the current state.
 */
export function statusForCurrentVersion(
  entries: readonly TimelineEntry[],
  currentVersion: string | null | undefined
): ReviewVerdict | null {
  const stamped = entries.filter(
    (entry) => entry.kind === "state_change" && entry.version !== undefined
  );
  if (stamped.length === 0) return null;

  const forThisVersion = stamped.filter((entry) => judgedCurrentVersion(entry, currentVersion));
  const newest = forThisVersion.at(-1);
  if (!newest || newest.kind !== "state_change") return "pending";
  return newest.status;
}

/** The revision a node is at, as the file list reports it. Null until it is versioned. */
export function versionOf(
  entry: { properties?: Record<string, string | undefined> } | undefined
): string | null {
  return entry?.properties?.["cm:versionLabel"] ?? null;
}
