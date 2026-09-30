"use client";

import type { Evaluation } from "./extensions/learning-eval-args";

/**
 * The trainer's view of the harness's editable knowledge and its
 * evaluations, through the app's `/api/harness/knowledge` and
 * `/api/harness/learning` routes.
 */

const API = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/harness`;

export type KnowledgeSummary = {
  id: string;
  title: string;
  target: string | null;
  updated_at: string | null;
  updated_by: string;
  version: number | null;
};

export type KnowledgeLayer = {
  layer: string;
  label: string;
  editable: boolean;
  targets: string[];
  items: KnowledgeSummary[];
};

export type KnowledgeVersion = {
  version: number;
  updated_at: string | null;
  updated_by: string;
  reason: string;
};

export type KnowledgeItem = {
  layer: string;
  id: string;
  target: string | null;
  title: string;
  content: string;
  meta: Record<string, unknown>;
  version: number | null;
  updated_at: string | null;
  updated_by: string;
  history?: KnowledgeVersion[];
};

export class KnowledgeApiError extends Error {
  constructor(readonly status: number) {
    super(`knowledge request failed (${status})`);
  }
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new KnowledgeApiError(res.status);
  return (await res.json()) as T;
}

function itemUrl(
  layer: string,
  id: string,
  target: string | null,
  suffix = ""
): string {
  const query = target ? `?target=${encodeURIComponent(target)}` : "";
  return `${API}/knowledge/items/${encodeURIComponent(layer)}/${encodeURIComponent(id)}${suffix}${query}`;
}

export async function fetchLayers(): Promise<KnowledgeLayer[]> {
  const body = await json<{ layers: KnowledgeLayer[] }>(
    await fetch(`${API}/knowledge/layers`)
  );
  return Array.isArray(body.layers) ? body.layers : [];
}

/** The item, or null when it does not exist (yet). */
export async function fetchItem(
  layer: string,
  id: string,
  target: string | null
): Promise<KnowledgeItem | null> {
  const res = await fetch(itemUrl(layer, id, target));
  if (res.status === 404) return null;
  return json<KnowledgeItem>(res);
}

export async function fetchItemVersion(
  layer: string,
  id: string,
  target: string | null,
  version: number
): Promise<KnowledgeItem | null> {
  const res = await fetch(itemUrl(layer, id, target, `/versions/${version}`));
  if (res.status === 404) return null;
  return json<KnowledgeItem>(res);
}

/** Saves a new version; the modulith records who wrote it. */
export async function saveItem(
  layer: string,
  id: string,
  target: string | null,
  body: { title: string; content: string; reason: string }
): Promise<KnowledgeItem> {
  return json<KnowledgeItem>(
    await fetch(itemUrl(layer, id, target), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

/** Restores an old version as a new one. */
export async function revertItem(
  layer: string,
  id: string,
  target: string | null,
  version: number
): Promise<KnowledgeItem> {
  return json<KnowledgeItem>(
    await fetch(itemUrl(layer, id, target, "/revert"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version }),
    })
  );
}

export async function fetchEvaluation(id: string): Promise<Evaluation> {
  return json<Evaluation>(
    await fetch(`${API}/learning/evaluations/${encodeURIComponent(id)}`)
  );
}
