import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SEED_STORIES } from "./seed-stories";
import {
  addStory,
  getStories,
  getStory,
  removeStories,
  removeStory,
} from "./storytelling-store";

const SEED_ID = SEED_STORIES[0].id;
const SEED_ID_2 = SEED_STORIES[1].id;

describe("storytelling-store seed deletion", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("lists the seed stories before any mutation", () => {
    expect(getStories().map((s) => s.id)).toEqual(SEED_STORIES.map((s) => s.id));
  });

  it("keeps a deleted seed gone across a fresh read (no resurrection)", () => {
    removeStory(SEED_ID);
    expect(getStories().some((s) => s.id === SEED_ID)).toBe(false);
    // A fresh readAll() (what a remount / reload does) must not re-add it.
    expect(getStory(SEED_ID)).toBeUndefined();
  });

  it("still migrates in seeds that were never deleted", () => {
    removeStory(SEED_ID);
    // SEED_ID_2 was never touched — a snapshot without it should still get it.
    expect(getStories().some((s) => s.id === SEED_ID_2)).toBe(true);
  });

  it("handles bulk deletion of seeds", () => {
    removeStories([SEED_ID, SEED_ID_2]);
    const ids = getStories().map((s) => s.id);
    expect(ids).not.toContain(SEED_ID);
    expect(ids).not.toContain(SEED_ID_2);
  });

  it("resurfaces a seed id if a story is re-created with it", () => {
    removeStory(SEED_ID);
    expect(getStory(SEED_ID)).toBeUndefined();
    addStory({ id: SEED_ID, title: "Recreated" });
    expect(getStory(SEED_ID)?.title).toBe("Recreated");
    // …and it stays after a fresh read.
    expect(getStory(SEED_ID)).toBeDefined();
  });

  it("does not tombstone non-seed (AI) stories", () => {
    const created = addStory({ id: "ai-1", title: "AI story" });
    removeStory(created.id);
    expect(getStory(created.id)).toBeUndefined();
    const raw = window.localStorage.getItem("miot.storytelling.deleted-seeds.v1");
    expect(raw ? JSON.parse(raw) : []).not.toContain("ai-1");
  });
});
