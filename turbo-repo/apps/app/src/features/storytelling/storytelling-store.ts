import { SEED_STORIES } from "./seed-stories";
import type { StoryItem } from "./storytelling.types";

/**
 * Frontend-only persistence — there's no backend for storytelling yet, so
 * both the list page and the chat's `create_story` trigger (which runs in
 * the browser, not on the server — see create-story-card.tsx) read/write the
 * same localStorage-backed list. Falls back to the seed list until the first
 * mutation, so nothing needs to explicitly "seed" storage up front.
 */
const STORAGE_KEY = "miot.storytelling.stories.v1";

function readAll(): StoryItem[] {
  if (typeof window === "undefined") return [...SEED_STORIES];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...SEED_STORIES];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoryItem[]) : [...SEED_STORIES];
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

export function addStory(input: { id: string; title?: string }): StoryItem {
  const story: StoryItem = {
    id: input.id,
    title: input.title?.trim() || `Story ${input.id}`,
    createdAt: new Date().toISOString().slice(0, 10),
    source: "ai",
  };
  writeAll([story, ...readAll().filter((existing) => existing.id !== story.id)]);
  return story;
}

export function removeStory(id: string): void {
  writeAll(readAll().filter((story) => story.id !== id));
}
