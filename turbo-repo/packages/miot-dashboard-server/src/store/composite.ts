/**
 * Builds a `ServerDashboardStore` from a metadata store and a document store.
 *
 * A save writes the config under a new key, then updates the metadata row to
 * point at that key. Only the metadata update is checked for concurrency, so a
 * read never sees a key the database has not recorded, and the document store
 * needs no conditional write. If the process stops between the two steps, or
 * the metadata update is rejected, the document is left unreferenced. `save`
 * and `remove` delete the documents they replace.
 */

import { DashboardServerError } from "../access/errors";
import type { DashboardDocumentStore } from "../seams/documents";
import type { DashboardMetadataStore } from "../seams/metadata";
import type {
  DashboardRecord,
  DashboardSummary,
  SaveOptions,
  ServerDashboardRef,
  ServerDashboardStore,
} from "../seams/store";

export interface CompositeStoreOptions {
  metadata: DashboardMetadataStore;
  documents: DashboardDocumentStore;
  /** Clock, so tests can pin `updatedAt`. */
  now?: () => Date;
  /** Key factory. Overridable so tests can make keys predictable. */
  newDocumentKey?: (ref: ServerDashboardRef) => string;
  /** Called when a document could not be deleted and has been left behind. */
  onOrphan?: (key: string, error: unknown) => void;
}

/**
 * `<tenantId>/<uuid>.json`.
 *
 * The scope and slug are left out because they come from the caller and would
 * allow path traversal in a filesystem-backed document store. The database
 * records the exact key, so nothing needs to derive it. The tenant id is kept
 * as a prefix so bucket policies can restrict access by tenant, and is
 * percent-encoded so it stays one path segment.
 */
function defaultDocumentKey(ref: ServerDashboardRef): string {
  return `${encodeURIComponent(ref.tenantId)}/${crypto.randomUUID()}.json`;
}

/**
 * Copied into the metadata row so `list` does not read one document per entry.
 * A config with no name is not an error; it lists under its slug.
 */
export function dashboardDisplayName(config: unknown, slug: string): string {
  if (typeof config === "object" && config !== null) {
    const named: unknown = (config as { name?: unknown }).name;
    if (typeof named === "string" && named.trim().length > 0) return named;
  }
  return slug;
}

function encode(config: unknown): Uint8Array {
  let json: string;
  try {
    // `JSON.stringify(undefined)` is `undefined`, not a string.
    json = JSON.stringify(config ?? null);
  } catch (error) {
    throw DashboardServerError.badRequest(
      `Dashboard config could not be serialized: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return new TextEncoder().encode(json);
}

function decode(key: string, body: Uint8Array): unknown {
  const text = new TextDecoder().decode(body);
  try {
    return JSON.parse(text);
  } catch {
    // The key, not the content: the content is tenant data and this is logged.
    throw new DashboardServerError(
      "INTERNAL_ERROR",
      `Stored dashboard document ${key} is not valid JSON`,
    );
  }
}

export function createCompositeStore(
  options: CompositeStoreOptions,
): ServerDashboardStore {
  const {
    metadata,
    documents,
    now = () => new Date(),
    newDocumentKey = defaultDocumentKey,
    onOrphan = () => {},
  } = options;

  /** Best-effort delete. The caller's outcome is already decided. */
  const forget = async (key: string): Promise<void> => {
    try {
      await documents.delete(key);
    } catch (error) {
      onOrphan(key, error);
    }
  };

  const toRecord = (
    row: {
      revision: number;
      updatedAt: string;
      updatedBy: string;
      createdBy?: string;
    },
    config: unknown,
  ): DashboardRecord => ({
    config,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
    revision: row.revision,
    ...(row.createdBy !== undefined ? { createdBy: row.createdBy } : {}),
  });

  return {
    async load(ref: ServerDashboardRef): Promise<DashboardRecord | null> {
      const row = await metadata.read(ref);
      if (row === null) return null;
      const body = await documents.get(row.documentKey);
      if (body === null) {
        // The write order above never produces this, so the document store
        // lost data. Returning an empty dashboard would let the next save
        // overwrite a revision whose document may still be recoverable.
        throw new DashboardServerError(
          "INTERNAL_ERROR",
          `Dashboard document ${row.documentKey} is missing`,
        );
      }
      return toRecord(row, decode(row.documentKey, body));
    },

    async save(
      ref: ServerDashboardRef,
      config: unknown,
      saveOptions: SaveOptions,
    ): Promise<DashboardRecord> {
      const body = encode(config);
      const previous = await metadata.read(ref);
      const key = newDocumentKey(ref);

      await documents.put(key, body);

      const row = await metadata.commit(
        ref,
        {
          name: dashboardDisplayName(config, ref.slug),
          documentKey: key,
          updatedBy: saveOptions.updatedBy,
          updatedAt: now().toISOString(),
        },
        saveOptions.expectedRevision,
      );

      if (row === null) {
        // No row references the document this call wrote.
        await forget(key);
        // Re-read: another writer changed the revision.
        const found = (await metadata.read(ref))?.revision ?? 0;
        throw DashboardServerError.conflict(
          `Dashboard was modified by someone else (expected revision ${saveOptions.expectedRevision}, found ${found})`,
        );
      }

      if (previous !== null && previous.documentKey !== key) {
        await forget(previous.documentKey);
      }

      return toRecord(row, config);
    },

    async list(tenantId: string, scopeId: string): Promise<DashboardSummary[]> {
      const rows = await metadata.list(tenantId, scopeId);
      return rows.map((row) => ({ slug: row.slug, name: row.name }));
    },

    async remove(ref: ServerDashboardRef): Promise<void> {
      const row = await metadata.remove(ref);
      if (row !== null) await forget(row.documentKey);
    },

    getPermissions(ref: ServerDashboardRef) {
      return metadata.getPermissions(ref);
    },

    setPermissions(ref: ServerDashboardRef, assignments) {
      return metadata.setPermissions(ref, assignments);
    },
  };
}
