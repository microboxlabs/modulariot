import { AI_AUTHOR } from "./people";
import type { StoryItem } from "./storytelling.types";

/**
 * One iteration of a story. `parentId` makes the history a tree rather than
 * a flat list — a version can branch off an earlier one (an experiment that
 * was or wasn't adopted), which is what the versions page draws.
 *
 * Frontend-only, like the rest of storytelling: `buildDefaultVersions` seeds
 * a plausible history from the story's own dates, and story-versions-store.ts
 * layers localStorage on top so "iterate" / "delete" persist. Swap both for
 * a real backend later — the page and badge only depend on this shape.
 */
export interface StoryVersion {
  readonly id: string;
  /** Human label shown on the node and the breadcrumb badge, e.g. "2.0". */
  readonly label: string;
  readonly createdAt: string;
  readonly createdBy: string;
  /** What changed in this iteration. */
  readonly summary: string;
  /** `null` for the root version. */
  readonly parentId: string | null;
}

/** Id of the version the detail view shows before anyone iterates. */
export const DEFAULT_CURRENT_ID = "v3";

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daySpan(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/**
 * Seed history for a story. Mostly a straight line (1.0 → 1.1 → 2.0) with
 * one branch (1.1 → 1.1a) so the tree actually forks. Dates are spread
 * across the story's created→updated window.
 */
export function buildDefaultVersions(story: StoryItem): StoryVersion[] {
  const start = story.createdAt;
  const end = daySpan(start, story.updatedAt) > 2 ? story.updatedAt : addDays(start, 9);
  const span = Math.max(daySpan(start, end), 3);
  const at = (fraction: number) => addDays(start, Math.round(span * fraction));

  return [
    {
      id: "v1",
      label: "1.0",
      parentId: null,
      createdAt: start,
      createdBy: story.createdBy,
      summary: "First draft.",
    },
    {
      id: "v2",
      label: "1.1",
      parentId: "v1",
      createdAt: at(0.35),
      createdBy: story.createdBy,
      summary: "Tightened the narrative and corrected data labels.",
    },
    {
      id: "v2a",
      label: "1.1a",
      parentId: "v2",
      createdAt: at(0.6),
      createdBy: AI_AUTHOR,
      summary: "Explored an alternative layout — not adopted.",
    },
    {
      id: DEFAULT_CURRENT_ID,
      label: "2.0",
      parentId: "v2",
      createdAt: end,
      createdBy: story.updatedBy,
      summary: "Restructured around the latest dataset.",
    },
  ];
}

/** Children keyed by parent id — the shape the tree renderer walks. */
export function versionChildren(
  versions: readonly StoryVersion[]
): Map<string | null, StoryVersion[]> {
  const byParent = new Map<string | null, StoryVersion[]>();
  for (const version of versions) {
    const siblings = byParent.get(version.parentId) ?? [];
    siblings.push(version);
    byParent.set(version.parentId, siblings);
  }
  return byParent;
}

/** Every id in the subtree rooted at `id` (inclusive) — used by delete. */
export function subtreeIds(
  versions: readonly StoryVersion[],
  id: string
): Set<string> {
  const byParent = versionChildren(versions);
  const ids = new Set<string>();
  const walk = (current: string) => {
    ids.add(current);
    for (const child of byParent.get(current) ?? []) walk(child.id);
  };
  walk(id);
  return ids;
}

/**
 * Next label when iterating off `fromLabel`. Bumps the minor of a leading
 * `X.Y` ("2.0" → "2.1"), skipping labels already in use; falls back to
 * `<label>.1` for anything that doesn't parse.
 */
export function nextVersionLabel(
  fromLabel: string,
  taken: ReadonlySet<string>
): string {
  const match = /^(\d+)\.(\d+)/.exec(fromLabel);
  if (!match) {
    let n = 1;
    while (taken.has(`${fromLabel}.${n}`)) n += 1;
    return `${fromLabel}.${n}`;
  }
  const major = Number(match[1]);
  let minor = Number(match[2]) + 1;
  while (taken.has(`${major}.${minor}`)) minor += 1;
  return `${major}.${minor}`;
}
