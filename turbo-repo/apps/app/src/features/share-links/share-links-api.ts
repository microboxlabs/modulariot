import type {
  Story,
  StoryVersion,
} from "@/features/storytelling/storytelling.types";

/**
 * Client for the app's `/api/links` routes: links any member of the
 * organization can open to read a story or a chat thread.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const API = `${BASE_PATH}/api/links`;

export type LinkTargetType = "story" | "thread";

export interface ShareLink {
  readonly token: string;
  readonly targetType: LinkTargetType;
  readonly targetId: string;
  readonly access: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly path: string;
}

export interface SharedThread {
  readonly id: string;
  readonly title: string | null;
  readonly ownerId: string;
  readonly createdAt: string;
  readonly lastMessageAt: string | null;
}

export interface SharedMessage {
  readonly id: string;
  readonly parentId: string | null;
  readonly format: string;
  readonly payload: Record<string, unknown>;
  readonly seq: number;
  readonly createdAt: string | null;
}

/** What a link opens. The fields of the other target type are null. */
export interface LinkSnapshot {
  readonly targetType: LinkTargetType;
  readonly story: Story | null;
  readonly version: StoryVersion | null;
  readonly thread: SharedThread | null;
  readonly messages: readonly SharedMessage[] | null;
}

export class LinkApiError extends Error {
  constructor(readonly status: number) {
    super(`link request failed with ${status}`);
    this.name = "LinkApiError";
  }
}

async function send<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new LinkApiError(res.status);
  return (await res.json()) as T;
}

/** The active link to a story or thread the caller owns, created if needed. */
export function createLink(targetType: LinkTargetType, targetId: string) {
  return send<ShareLink>(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetType, targetId }),
  });
}

export function resolveLink(
  token: string,
  page: { after?: number; limit?: number } = {}
) {
  const query = new URLSearchParams();
  if (page.after !== undefined) query.set("after", String(page.after));
  if (page.limit !== undefined) query.set("limit", String(page.limit));
  const url = `${API}/${encodeURIComponent(token)}`;
  const qs = query.toString();
  return send<LinkSnapshot>(qs ? `${url}?${qs}` : url);
}

/** The app page that opens a link, as an absolute URL to paste anywhere. */
export function shareLinkUrl(
  origin: string,
  lang: string,
  token: string
): string {
  return `${origin}${BASE_PATH}/${lang}/share/${encodeURIComponent(token)}`;
}

/** Gets the link for a story or thread and copies its URL to the clipboard.
 * Resolves to the URL, or rejects when either step fails. */
export async function copyShareLink(
  targetType: LinkTargetType,
  targetId: string,
  lang: string
): Promise<string> {
  const link = await createLink(targetType, targetId);
  const url = shareLinkUrl(window.location.origin, lang, link.token);
  await navigator.clipboard.writeText(url);
  return url;
}
