/**
 * One `ServerDashboardStore` out of a database and a blob store.
 *
 * The write protocol is the whole design, and the order matters:
 *
 *   1. `put` the config at a **brand-new key**. Documents are never overwritten.
 *   2. Compare-and-swap the metadata row to point at that key.
 *
 * Because step 2 is the only arbiter, a reader can only ever reach a key the
 * database has already committed — so it never observes a partial write, and
 * the document store needs no conditional write of its own. A crash between
 * the two steps, or a lost race in step 2, leaves an **orphaned document**
 * rather than a corrupted dashboard. That trade is deliberate: orphans are a
 * collection problem, and a torn config would be a data-loss one.
 *
 * The normal paths clean up after themselves — a superseded document is
 * deleted after a successful swap, and a losing writer deletes its own — so
 * only crashes and races leave anything behind for a sweep to find.
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
  /**
   * Called when a document could not be deleted and has been left behind.
   *
   * The alternative to a hook here is swallowing the error in silence, which
   * is how a bucket fills up without anyone finding out. Failing the request
   * would be worse: by the time this runs, the caller's write has already
   * succeeded or already lost, and neither outcome changes.
   */
  onOrphan?: (key: string, error: unknown) => void;
}

/**
 * `<tenantId>/<uuid>.json`, and deliberately nothing else.
 *
 * No slug and no scope, because a caller-supplied path segment is a traversal
 * against a filesystem-backed document store — `slug = "../../etc/x"` is a
 * legal slug as far as this package is concerned. The database holds the exact
 * key, so the path buys no lookup ability it would be worth taking a risk for.
 *
 * The tenant prefix survives because it is worth something the key alone is
 * not: a bucket prefix policy can enforce tenant isolation underneath us,
 * independently of this code being correct. It is encoded, so a tenant id
 * containing a slash stays one path segment.
 */
function defaultDocumentKey(ref: ServerDashboardRef): string {
  return `${encodeURIComponent(ref.tenantId)}/${crypto.randomUUID()}.json`;
}

/**
 * The display name for the dashboard list.
 *
 * Read off the config when it carries a usable one, because `list` must not
 * have to fetch a document per row — that N+1 is the reason the name is
 * denormalized into the database at all. This is not validation: a config
 * without a name is not malformed, it just lists under its slug.
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
    // `?? null` because `JSON.stringify(undefined)` is `undefined`, not a
    // string, and a store that wrote the four bytes "unde" would be worse
    // than one that refuses.
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
    // The row points at a document that is not JSON. Reporting the key rather
    // than the content: the content is a tenant's data and this message may
    // reach a log.
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
        // A committed row pointing at a missing document. Never reachable by
        // the write protocol above, so it means the document store lost data
        // or a collector deleted something it should not have. Say so rather
        // than reporting the dashboard as empty, which would invite the next
        // save to overwrite a revision that still exists somewhere.
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
        // We lost. Our document is unreachable — nothing points at it — so
        // collect it now rather than leaving it for a sweep.
        await forget(key);
        // Re-read for the message rather than trusting `previous`: the whole
        // point of losing is that someone else moved the revision.
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
