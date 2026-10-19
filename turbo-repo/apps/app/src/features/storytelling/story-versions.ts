import type { StoryVersion } from "./storytelling.types";

/** Children keyed by parent id — the shape the version tree renderer walks.
 * A version whose parent is not in the list is treated as a root. */
export function versionChildren(
  versions: readonly StoryVersion[]
): Map<string | null, StoryVersion[]> {
  const known = new Set(versions.map((version) => version.id));
  const byParent = new Map<string | null, StoryVersion[]>();
  for (const version of versions) {
    const parent =
      version.parentId && known.has(version.parentId) ? version.parentId : null;
    const siblings = byParent.get(parent) ?? [];
    siblings.push(version);
    byParent.set(parent, siblings);
  }
  return byParent;
}
