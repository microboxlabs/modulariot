import type { DashboardStorageSchema } from "@microboxlabs/miot-dashboard-contract/document";
import type { createDashboardClient } from "./client";
import { DashboardApiError } from "./client/error";

type Client = ReturnType<typeof createDashboardClient>;
type Capabilities = Awaited<ReturnType<Client["capabilities"]>>;

export interface DashboardDocumentSnapshot {
  config: DashboardStorageSchema;
  etag: string | null;
  capabilities: Capabilities | undefined;
  isLoaded: boolean;
  exists: boolean;
  dirty: boolean;
  busy: boolean;
  readOnly: boolean;
  error: number | null;
  editorKey: string;
}

export interface DashboardDocumentOptions {
  client: Pick<Client, "key" | "save" | "capabilities"> & {
    load(
      slug: string,
      signal?: AbortSignal,
    ): Promise<{
      config: DashboardStorageSchema | null;
      etag: string;
    }>;
  };
  slug: string;
  /** Non-secret host generation; replace this session on login/logout or identity changes. */
  sessionKey: string;
  emptyDocument: DashboardStorageSchema;
  /** A host restriction can remove edit access, never grant it. */
  readOnly?: boolean;
}

/** One resource and authentication generation, with no shared cache or persistence fallback. */
export function createDashboardDocument(options: DashboardDocumentOptions) {
  if (!options.sessionKey) throw new DashboardApiError(400);
  const { client, slug, emptyDocument, readOnly: restricted = false } = options;
  const identity = JSON.stringify([options.sessionKey, client.key(slug)]);
  const initial: DashboardDocumentSnapshot = {
    config: emptyDocument,
    etag: null,
    capabilities: undefined,
    isLoaded: false,
    exists: false,
    dirty: false,
    busy: false,
    readOnly: true,
    error: null,
    editorKey: `${identity}:0`,
  };
  let snapshot = initial;
  let generation = 0;
  let destroyed = false;
  let active: AbortController | undefined;
  const listeners = new Set<() => void>();

  function publish(patch: Partial<DashboardDocumentSnapshot>) {
    const next = { ...snapshot, ...patch };
    next.readOnly =
      restricted ||
      !next.isLoaded ||
      !next.exists ||
      next.busy ||
      next.capabilities?.canEdit !== true ||
      next.capabilities.readOnly ||
      next.error === 401 ||
      next.error === 403;
    snapshot = next;
    for (const listener of listeners) listener();
  }

  async function run(
    work: (signal: AbortSignal) => Promise<Partial<DashboardDocumentSnapshot>>,
  ) {
    if (destroyed || active) return false;
    const operation = new AbortController();
    active = operation;
    publish({ busy: true, error: null });
    try {
      if (operation.signal.aborted) return false;
      const patch = await work(operation.signal);
      if (destroyed || active !== operation) return false;
      publish(patch);
      return true;
    } catch (error) {
      operation.abort();
      if (!destroyed && active === operation) {
        publish({
          error: error instanceof DashboardApiError ? error.status : 502,
        });
      }
      return false;
    } finally {
      if (active === operation) {
        active = undefined;
        publish({ busy: false });
      }
    }
  }

  async function reload() {
    return run(async (signal) => {
      const [document, capabilities] = await Promise.all([
        client.load(slug, signal),
        client.capabilities(slug, signal),
      ]);
      return {
        config: document.config ?? emptyDocument,
        etag: document.etag,
        capabilities,
        isLoaded: true,
        exists: document.config !== null,
        dirty: false,
        editorKey: `${identity}:${++generation}`,
      };
    });
  }

  return {
    /** Snapshots and their documents are immutable to callers. */
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      if (destroyed) return () => undefined;
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Loading never discards an existing draft. */
    load() {
      return snapshot.dirty ? Promise.resolve(false) : reload();
    },
    onChange(config: DashboardStorageSchema) {
      if (destroyed || snapshot.readOnly) return false;
      publish({ config, dirty: true });
      return true;
    },
    save() {
      if (snapshot.readOnly || !snapshot.dirty || snapshot.etag === null)
        return Promise.resolve(false);
      const { config, etag } = snapshot;
      return run(async (signal) => {
        const saved = await client.save(slug, config, etag, signal);
        return { etag: saved.etag, dirty: false };
      });
    },
    /** Host obtains explicit discard intent first; failed reloads retain the draft. */
    discardAndReload: reload,
    destroy() {
      destroyed = true;
      active?.abort();
      active = undefined;
      snapshot = initial;
      listeners.clear();
    },
  };
}
