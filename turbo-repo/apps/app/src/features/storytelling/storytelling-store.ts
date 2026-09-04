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

function readAll(): StoryItem[] {
  if (typeof window === "undefined") return [...SEED_STORIES];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...SEED_STORIES];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...SEED_STORIES];
    const stored = (parsed as StoryItem[]).map(normalize);
    // Bring in any seed stories a snapshot from before they existed
    // wouldn't have — e.g. the markdown/ppt/pdf demo seeds added after this
    // browser already had a persisted list.
    const storedIds = new Set(stored.map((story) => story.id));
    const missingSeeds = SEED_STORIES.filter((seed) => !storedIds.has(seed.id));
    return [...stored, ...missingSeeds];
  } catch {
    return [...SEED_STORIES];
  }
}

function writeAll(stories: StoryItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stories));
}

export function getStories(): StoryItem[] {
  return readAll();
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
  return stories;
}

export function removeStory(id: string): void {
  writeAll(readAll().filter((story) => story.id !== id));
}

/** Mass delete (storytelling-page-content.tsx's selection toolbar) — one
 * writeAll pass instead of calling removeStory per id. */
export function removeStories(ids: readonly string[]): void {
  const idSet = new Set(ids);
  writeAll(readAll().filter((story) => !idSet.has(story.id)));
}
