import type {
  SharePermission,
  ShareEntry,
  Story,
  StoryKind,
  StoryVersion,
  VersionInput,
} from "./storytelling.types";

/**
 * Client for the app's `/api/stories` routes, which attach the session token
 * and the active org. Failed calls throw a {@link StoriesApiError} carrying
 * the upstream status, so a page can tell "not found" from "unreachable".
 */
const BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/stories`;

export class StoriesApiError extends Error {
  constructor(readonly status: number) {
    super(`stories request failed with ${status}`);
    this.name = "StoriesApiError";
  }
}

async function request<T>(
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: init?.method ?? "GET",
    ...(init?.body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(init.body),
        }),
  });
  if (!res.ok) throw new StoriesApiError(res.status);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const id = encodeURIComponent;

export function listStories(
  filter: { kind?: StoryKind; search?: string; limit?: number } = {}
) {
  const query = new URLSearchParams();
  if (filter.kind) query.set("kind", filter.kind);
  if (filter.search?.trim()) query.set("search", filter.search.trim());
  if (filter.limit) query.set("limit", String(filter.limit));
  const qs = query.toString();
  return request<Story[]>(qs ? `?${qs}` : "");
}

export function getStory(storyId: string) {
  return request<Story>(`/${id(storyId)}`);
}

export interface CreateStoryInput {
  readonly title: string;
  readonly kind: StoryKind;
  readonly description?: string;
  readonly sourceThreadId?: string;
  readonly sourceMessageId?: string;
  readonly version: VersionInput;
}

export function createStory(input: CreateStoryInput) {
  return request<Story>("", { method: "POST", body: input });
}

export function updateStory(
  storyId: string,
  patch: { title?: string; description?: string }
) {
  return request<Story>(`/${id(storyId)}`, { method: "PATCH", body: patch });
}

export function deleteStory(storyId: string) {
  return request<void>(`/${id(storyId)}`, { method: "DELETE" });
}

export function listVersions(storyId: string) {
  return request<StoryVersion[]>(`/${id(storyId)}/versions`);
}

export function getVersion(storyId: string, versionId: string) {
  return request<StoryVersion>(`/${id(storyId)}/versions/${id(versionId)}`);
}

/** Adds a version; upstream makes it the current one. */
export function addVersion(storyId: string, input: VersionInput) {
  return request<StoryVersion>(`/${id(storyId)}/versions`, {
    method: "POST",
    body: input,
  });
}

export function setCurrentVersion(storyId: string, versionId: string) {
  return request<Story>(`/${id(storyId)}/current-version`, {
    method: "PUT",
    body: { versionId },
  });
}

export function shareStory(
  storyId: string,
  principal: string,
  permission: SharePermission
) {
  return request<ShareEntry>(`/${id(storyId)}/shares`, {
    method: "POST",
    body: { principal, permission },
  });
}

export function revokeStoryShare(storyId: string, principal: string) {
  return request<void>(`/${id(storyId)}/shares/${id(principal)}`, {
    method: "DELETE",
  });
}

/** A new version derived from `from`, with the same content. */
export async function iterateVersion(storyId: string, from: StoryVersion) {
  const source =
    from.content === null && from.metadata === null
      ? await getVersion(storyId, from.id)
      : from;
  return addVersion(storyId, {
    parentId: source.id,
    ...(source.content === null ? {} : { content: source.content }),
    ...(source.metadata === null ? {} : { metadata: source.metadata }),
    ...(source.contentType ? { contentType: source.contentType } : {}),
  });
}

export interface ArtifactToSave {
  readonly title: string;
  readonly kind: StoryKind;
  /** The document itself: Markdown, HTML or SVG source, a PDF as base64, or
   * a deck/sections structure as an object. */
  readonly content: string | Record<string, unknown>;
  readonly threadId?: string;
  readonly messageId?: string;
}

/**
 * Keeps an artifact shown in the chat as a new story the caller owns. An
 * object `content` is stored as the version's metadata (a deck's slides, a
 * sectioned story's blocks); a string as its content.
 */
export function saveArtifactAsStory(artifact: ArtifactToSave): Promise<Story> {
  const version: VersionInput =
    typeof artifact.content === "string"
      ? { content: artifact.content }
      : { metadata: artifact.content };
  return createStory({
    title: artifact.title,
    kind: artifact.kind,
    ...(artifact.threadId ? { sourceThreadId: artifact.threadId } : {}),
    ...(artifact.messageId ? { sourceMessageId: artifact.messageId } : {}),
    version,
  });
}
