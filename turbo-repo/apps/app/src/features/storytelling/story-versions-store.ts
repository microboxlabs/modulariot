import { AI_AUTHOR } from "./people";
import type { StoryItem } from "./storytelling.types";
import {
  buildDefaultVersions,
  DEFAULT_CURRENT_ID,
  nextVersionLabel,
  subtreeIds,
  type StoryVersion,
} from "./story-versions";

/**
 * Frontend-only persistence for story iterations — same pattern as
 * storytelling-store.ts. One localStorage blob keyed by story id, holding
 * the version list and which one is "current". Falls back to
 * buildDefaultVersions until the first iterate/delete.
 */
const STORAGE_KEY = "miot.storytelling.versions.v1";

interface StoredVersions {
  versions: StoryVersion[];
  currentId: string;
}

export interface StoryVersionState {
  readonly versions: StoryVersion[];
  readonly currentId: string;
  readonly current: StoryVersion;
}

function readAll(): Record<string, StoredVersions> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, StoredVersions>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function seed(story: StoryItem): StoredVersions {
  return { versions: buildDefaultVersions(story), currentId: DEFAULT_CURRENT_ID };
}

function load(story: StoryItem): StoredVersions {
  const stored = readAll()[story.id];
  if (!stored || !Array.isArray(stored.versions) || stored.versions.length === 0) {
    return seed(story);
  }
  const hasCurrent = stored.versions.some((v) => v.id === stored.currentId);
  return {
    versions: stored.versions,
    currentId: hasCurrent ? stored.currentId : stored.versions[stored.versions.length - 1].id,
  };
}

function save(storyId: string, state: StoredVersions): void {
  writeAll({ ...readAll(), [storyId]: state });
}

function resolve(state: StoredVersions): StoryVersionState {
  const current =
    state.versions.find((v) => v.id === state.currentId) ??
    state.versions[state.versions.length - 1];
  return { versions: state.versions, currentId: state.currentId, current };
}

export function getStoryVersionState(story: StoryItem): StoryVersionState {
  return resolve(load(story));
}

/** Append a new iteration branching off `fromId`, make it current. */
export function iterateVersion(story: StoryItem, fromId: string): StoryVersion {
  const state = load(story);
  const parent = state.versions.find((v) => v.id === fromId);
  if (!parent) return resolve(state).current;

  const taken = new Set(state.versions.map((v) => v.label));
  const version: StoryVersion = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `v-${Date.now().toString(36)}`,
    label: nextVersionLabel(parent.label, taken),
    parentId: parent.id,
    createdAt: new Date().toISOString().slice(0, 10),
    createdBy: AI_AUTHOR,
    summary: "New iteration.",
  };

  save(story.id, {
    versions: [...state.versions, version],
    currentId: version.id,
  });
  return version;
}

/** Remove a version and everything branched off it. No-ops on the root, or
 * when it would empty the tree. If the current version is removed, current
 * moves to the deleted node's parent. */
export function deleteStoryVersion(story: StoryItem, id: string): void {
  const state = load(story);
  const target = state.versions.find((v) => v.id === id);
  if (!target || target.parentId === null) return;

  const doomed = subtreeIds(state.versions, id);
  const remaining = state.versions.filter((v) => !doomed.has(v.id));
  if (remaining.length === 0) return;

  const currentId = doomed.has(state.currentId)
    ? (target.parentId ?? remaining[remaining.length - 1].id)
    : state.currentId;

  save(story.id, { versions: remaining, currentId });
}

export function setCurrentVersion(story: StoryItem, id: string): void {
  const state = load(story);
  if (!state.versions.some((v) => v.id === id)) return;
  save(story.id, { versions: state.versions, currentId: id });
}
