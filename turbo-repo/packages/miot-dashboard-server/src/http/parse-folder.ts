/**
 * Parsers for the folder bodies. Hand-written for the same reason as the
 * datasource ones, and strict the same way: an unknown field is refused, so a
 * misspelled `parentId` cannot quietly file a folder at the top level.
 */

import { DashboardServerError } from "../access/errors";
import type { FolderPatch, NewFolder } from "../seams/folders";

/** Long enough for any real name; short enough to fit a sidebar row. */
export const MAX_FOLDER_NAME_LENGTH = 120;

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw DashboardServerError.badRequest("Body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

function rejectUnknown(
  raw: Record<string, unknown>,
  allowed: readonly string[],
): void {
  for (const key of Object.keys(raw)) {
    if (!allowed.includes(key)) {
      throw DashboardServerError.badRequest(`Unknown field "${key}"`);
    }
  }
}

function parseName(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw DashboardServerError.badRequest('"name" must be a non-empty string');
  }
  const name = value.trim();
  if (name.includes("\0")) {
    throw DashboardServerError.badRequest(
      '"name" must not contain a null character',
    );
  }
  if (name.length > MAX_FOLDER_NAME_LENGTH) {
    throw DashboardServerError.badRequest(
      `"name" must be at most ${MAX_FOLDER_NAME_LENGTH} characters`,
    );
  }
  return name;
}

/** A folder id, or null for the top level. */
function parseFolderRef(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length === 0) {
    throw DashboardServerError.badRequest(
      `"${field}" must be a folder id or null`,
    );
  }
  return value;
}

/** `{ name, parentId? }`; a missing `parentId` is the top level. */
export function parseNewFolder(body: unknown): NewFolder {
  const raw = asObject(body);
  rejectUnknown(raw, ["name", "parentId"]);
  return {
    name: parseName(raw.name),
    parentId:
      raw.parentId === undefined
        ? null
        : parseFolderRef(raw.parentId, "parentId"),
  };
}

/** `{ name?, parentId? }`, with at least one of them. */
export function parseFolderPatch(body: unknown): FolderPatch {
  const raw = asObject(body);
  rejectUnknown(raw, ["name", "parentId"]);
  if (raw.name === undefined && raw.parentId === undefined) {
    throw DashboardServerError.badRequest('Send "name", "parentId" or both');
  }
  return {
    ...(raw.name === undefined ? {} : { name: parseName(raw.name) }),
    ...(raw.parentId === undefined
      ? {}
      : { parentId: parseFolderRef(raw.parentId, "parentId") }),
  };
}

/** `{ folderId }`: where to file a dashboard, null for the top level. */
export function parsePlacement(body: unknown): string | null {
  const raw = asObject(body);
  rejectUnknown(raw, ["folderId"]);
  if (!("folderId" in raw)) {
    throw DashboardServerError.badRequest('"folderId" is required');
  }
  return parseFolderRef(raw.folderId, "folderId");
}
