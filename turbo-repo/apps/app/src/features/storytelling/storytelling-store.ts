import { AI_AUTHOR } from "./people";
import { BOARD_DECK, SEED_STORIES } from "./seed-stories";
import type { ArtifactType, StoryItem } from "./storytelling.types";

/**
 * Frontend-only persistence — there's no backend for storytelling yet, so
 * both the list page and the chat's `create_story` trigger (which runs in
 * the browser, not on the server — see create-story-card.tsx) read/write the
 * same localStorage-backed list. Falls back to the seed list until the first
 * mutation, so nothing needs to explicitly "seed" storage up front.
 */
const STORAGE_KEY = "miot.storytelling.stories.v1";
// Seed ids the user has explicitly deleted. Without this, readAll() can't
// tell "this browser's snapshot predates a newly-added seed" (migrate it in)
// from "the user deleted this seed" (leave it gone) — so a deleted seed
// would keep coming back on the next remount/reload.
const DELETED_SEEDS_KEY = "miot.storytelling.deleted-seeds.v1";

const SEED_IDS = new Set(SEED_STORIES.map((seed) => seed.id));

/** Fills in fields that didn't exist yet when this record was persisted
 * (artifactType, and the createdBy/updatedAt/updatedBy authorship trio) —
 * once localStorage has anything at all, it's used as-is instead of
 * SEED_STORIES, so older snapshots don't pick up new fields on their own. */
function normalize(story: StoryItem): StoryItem {
  const authoredBy = story.source === "ai" ? AI_AUTHOR : "—";
  return {
    ...story,
    artifactType: story.artifactType ?? "html",
    createdBy: story.createdBy ?? authoredBy,
    updatedAt: story.updatedAt ?? story.createdAt,
    updatedBy: story.updatedBy ?? story.createdBy ?? authoredBy,
  };
}

function readDeletedSeedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DELETED_SEEDS_KEY) ?? "[]");
    return Array.isArray(parsed) ? new Set(parsed as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function writeDeletedSeedIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DELETED_SEEDS_KEY, JSON.stringify([...ids]));
}

/** Record any seed ids in `removedIds` as deleted so readAll() stops
 * re-adding them. No-op for non-seed ids — AI stories are never re-migrated. */
function tombstoneSeeds(removedIds: Iterable<string>): void {
  const deleted = readDeletedSeedIds();
  let changed = false;
  for (const id of removedIds) {
    if (SEED_IDS.has(id) && !deleted.has(id)) {
      deleted.add(id);
      changed = true;
    }
  }
  if (changed) writeDeletedSeedIds(deleted);
}

/** Drop `ids` from the tombstone set — called when a story with one of
 * those ids is (re-)created, so it resurfaces normally afterwards. */
function untombstone(ids: Iterable<string>): void {
  const deleted = readDeletedSeedIds();
  let changed = false;
  for (const id of ids) {
    if (deleted.delete(id)) changed = true;
  }
  if (changed) writeDeletedSeedIds(deleted);
}

function readAll(): StoryItem[] {
  if (typeof window === "undefined") return [...SEED_STORIES];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const deletedSeedIds = readDeletedSeedIds();
    const availableSeeds = SEED_STORIES.filter((seed) => !deletedSeedIds.has(seed.id));
    if (!raw) return availableSeeds;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return availableSeeds;
    const stored = (parsed as StoryItem[]).map(normalize);
    // Bring in any seed stories a snapshot from before they existed
    // wouldn't have — e.g. the markdown/ppt/pdf demo seeds added after this
    // browser already had a persisted list — but not ones the user deleted.
    const storedIds = new Set(stored.map((story) => story.id));
    const missingSeeds = availableSeeds.filter((seed) => !storedIds.has(seed.id));
    return [...stored, ...missingSeeds];
  } catch {
    return SEED_STORIES.filter((seed) => !readDeletedSeedIds().has(seed.id));
  }
}

function writeAll(stories: StoryItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stories));
}

export function getStories(): StoryItem[] {
  return readAll();
}

/**
 * Whether a story's share link can actually resolve in someone else's
 * browser. Seed stories ship in the bundle so every client has them; AI
 * stories live only in the creating browser's localStorage (no backend
 * yet), so a shared URL to one just shows "Story not found". Hide sharing
 * for those until there's server-side persistence.
 */
export function isStoryShareable(story: StoryItem): boolean {
  return story.source !== "ai";
}

export function getStory(id: string): StoryItem | undefined {
  return readAll().find((story) => story.id === id);
}

export function addStory(input: { id: string; title?: string; authorName?: string }): StoryItem {
  const today = new Date().toISOString().slice(0, 10);
  // Attribute to whoever was actually driving the chat, not a generic
  // "Harness AI" label — falls back to it only when no signed-in name was
  // available to pass in (see create-story-card.tsx's useSession()).
  const author = input.authorName?.trim() || AI_AUTHOR;
  const story: StoryItem = {
    id: input.id,
    title: input.title?.trim() || `Story ${input.id}`,
    createdAt: today,
    createdBy: author,
    updatedAt: today,
    updatedBy: author,
    source: "ai",
    // The chat's create_story trigger only ever produces the HTML dashboard
    // artifact today — the other previewer types are testing-only for now.
    artifactType: "html",
  };
  writeAll([story, ...readAll().filter((existing) => existing.id !== story.id)]);
  untombstone([story.id]);
  return story;
}

const CREATE_STORY_TYPES: readonly ArtifactType[] = ["html", "ppt", "pdf", "markdown"];

/**
 * The chat's create_story trigger doesn't generate real per-type content
 * yet, so one call produces one demo story per previewer type — every
 * previewer (previewers/html, /ppt, /pdf, /markdown) is reachable from the
 * same chat action instead of always landing on html. See
 * create-story-card.tsx for how these render as one card per type.
 *
 * The ppt one clones BOARD_DECK (the same fixture board-deck-demo uses)
 * rather than generating anything — no ppt content generation exists yet,
 * so this just reuses the one deck the app already has instead of standing
 * up a thin placeholder.
 */
export function addStoriesForAllTypes(input: {
  id: string;
  title?: string;
  authorName?: string;
}): StoryItem[] {
  const title = input.title?.trim() || `Story ${input.id}`;
  const createdAt = new Date().toISOString().slice(0, 10);
  // Same fallback as addStory — the real signed-in name when the caller has
  // one, "Harness AI" only when it doesn't.
  const author = input.authorName?.trim() || AI_AUTHOR;
  const stories: StoryItem[] = CREATE_STORY_TYPES.map((artifactType) => ({
    id: `${input.id}-${artifactType}`,
    title,
    createdAt,
    createdBy: author,
    updatedAt: createdAt,
    updatedBy: author,
    source: "ai",
    artifactType,
    ...(artifactType === "ppt" ? { deck: BOARD_DECK } : {}),
  }));
  const newIds = new Set(stories.map((story) => story.id));
  writeAll([...stories, ...readAll().filter((existing) => !newIds.has(existing.id))]);
  untombstone(newIds);
  return stories;
}

export function removeStory(id: string): void {
  writeAll(readAll().filter((story) => story.id !== id));
  tombstoneSeeds([id]);
}

/** Mass delete (storytelling-page-content.tsx's selection toolbar) — one
 * writeAll pass instead of calling removeStory per id. */
export function removeStories(ids: readonly string[]): void {
  const idSet = new Set(ids);
  writeAll(readAll().filter((story) => !idSet.has(story.id)));
  tombstoneSeeds(ids);
}
