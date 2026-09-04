import type {
  LinkAccess,
  ShareRecipient,
  ShareRole,
  StoryShareState,
} from "./storytelling.types";

/**
 * Frontend-only persistence for the story share panel — there's no backend
 * for storytelling sharing yet (see storytelling-store.ts for the same
 * pattern on the stories list). One localStorage blob keyed by story id, so
 * every open story keeps its own invitees and link access.
 */
const STORAGE_KEY = "miot.storytelling.shares.v1";

export const DEFAULT_SHARE_STATE: StoryShareState = {
  people: [],
  linkAccess: "restricted",
};

// The org "directory" the invite box autocompletes against — the shared
// storytelling people pool (people.ts), re-exported so existing call sites
// keep reading `ORG_DIRECTORY` / `DirectoryEntry`.
export { STORY_PEOPLE as ORG_DIRECTORY } from "./people";
export type { StoryPerson as DirectoryEntry } from "./people";

/** Deterministic avatar tint for an initials chip — index into a small set
 * so the same person always reads the same colour across renders. */
const AVATAR_TINTS = [
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
];

export function avatarTint(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = Math.trunc(hash * 31 + (seed.codePointAt(i) ?? 0));
  }
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts.at(-1)![0]).toUpperCase();
}

function isShareRole(value: unknown): value is ShareRole {
  return value === "viewer" || value === "editor";
}

function isLinkAccess(value: unknown): value is LinkAccess {
  return value === "restricted" || isShareRole(value);
}

function normalize(raw: unknown): StoryShareState {
  if (typeof raw !== "object" || raw === null) return DEFAULT_SHARE_STATE;
  const record = raw as Record<string, unknown>;
  const people = Array.isArray(record.people)
    ? (record.people as unknown[]).flatMap((entry): ShareRecipient[] => {
        if (typeof entry !== "object" || entry === null) return [];
        const person = entry as Record<string, unknown>;
        if (
          typeof person.id !== "string" ||
          typeof person.name !== "string" ||
          typeof person.email !== "string" ||
          !isShareRole(person.role)
        ) {
          return [];
        }
        return [
          {
            id: person.id,
            name: person.name,
            email: person.email,
            role: person.role,
          },
        ];
      })
    : [];
  return {
    people,
    linkAccess: isLinkAccess(record.linkAccess)
      ? record.linkAccess
      : "restricted",
  };
}

function readAll(): Record<string, StoryShareState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([id, value]) => [
        id,
        normalize(value),
      ])
    );
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, StoryShareState>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function getShareState(storyId: string): StoryShareState {
  return readAll()[storyId] ?? DEFAULT_SHARE_STATE;
}

export function setShareState(storyId: string, state: StoryShareState): void {
  writeAll({ ...readAll(), [storyId]: state });
}
