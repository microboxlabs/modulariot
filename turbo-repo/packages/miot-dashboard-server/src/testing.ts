/**
 * In-memory implementations of every seam.
 *
 * Published as `@microboxlabs/miot-dashboard-server/testing` rather than kept
 * in the test folder, because three different audiences need exactly this:
 *
 *  - our own tests,
 *  - the standalone dev server, which has to run before anyone has a database,
 *  - an integrator building their own adapters, who wants the package working
 *    end to end before they write a real store.
 *
 * Nothing here imports a test framework, so it is safe to ship. Nothing here
 * persists anything, so it is not safe to deploy.
 */

import {
  createMemoryTransaction,
  snapshotMap,
} from "./store/memory-transaction";
import { DashboardServerError } from "./access/errors";
import { dashboardDisplayName } from "./store/composite";
import { dashboardSortOrder } from "./store/display-name";
import type { DashboardRole } from "./access/roles";
import { FULL_CAPABILITIES, isDashboardRole } from "./access/roles";
import type { AuditEvent, AuditSink } from "./seams/audit";
import {
  applyCredential,
  previewOf,
  type CredentialInput,
  type CredentialSummary,
  type CredentialsStore,
  type CredentialsVault,
  type DataSourceCredential,
} from "./seams/credentials";
import type {
  DataSourceDescriptor,
  DataSourceInput,
  DataSourceStore,
} from "./seams/datasources";
import type { DashboardFolder, DashboardFolderStore } from "./seams/folders";
import {
  applyFolderPatch,
  folderSubtree,
  requireFreeName,
  requireCompleteFolderRemoval,
  requireParent,
} from "./store/folder-tree";
import type {
  DashboardPrincipal,
  IdentityResolver,
  ScopeAuthority,
  TenantAuthority,
} from "./seams/identity";
import type {
  DashboardRecord,
  DashboardSummary,
  PermissionAssignment,
  SaveOptions,
  ServerDashboardRef,
  ServerDashboardStore,
} from "./seams/store";

// ---------------------------------------------------------------- store ----

export interface SeedDashboard {
  ref: ServerDashboardRef;
  record?: Partial<DashboardRecord>;
  assignments?: PermissionAssignment[];
}

/**
 * Map key for a dashboard reference.
 *
 * `JSON.stringify` of the three parts rather than joining them with a
 * separator: ids are host-defined, so any separator character could appear
 * inside one, and then `{tenantId: "ac", scopeId: "me/ops"}` and
 * `{tenantId: "ac/me", scopeId: "ops"}` would address the same entry.
 */
/**
 * Hand back a copy, never the stored object.
 *
 * This store is published for integrators and dev servers, not just for our
 * own tests, so a caller holding a reference into the `Map` is a caller who
 * can rewrite history: mutating a returned `record.revision` moves the store's
 * own optimistic-concurrency counter, and the conflict path stops meaning
 * anything. A real store hands back rows it decoded, so returning aliases here
 * would also let our tests pass against behaviour Postgres will not reproduce.
 *
 * `config` is spread shallowly and deliberately: it is caller-supplied
 * `unknown`, the store never inspects it, and deep-cloning arbitrary values
 * would be a different promise than the one a database makes.
 */
function copyRecord(record: DashboardRecord): DashboardRecord {
  return { ...record };
}

const key = (ref: ServerDashboardRef) =>
  JSON.stringify([ref.tenantId, ref.scopeId, ref.slug]);

interface Entry {
  ref: ServerDashboardRef;
  name: string;
  record: DashboardRecord;
}

export interface MemoryStore extends ServerDashboardStore {
  transaction<T>(body: () => Promise<T>): Promise<T>;
  /** Listener and optional rollback snapshot join the dashboard transaction. */
  onRemove(
    listener: (ref: ServerDashboardRef) => void,
    snapshot?: () => () => void,
  ): () => void;
}

export interface MemoryStoreOptions {
  seed?: SeedDashboard[];
  /** Clock, so tests can pin `updatedAt`. */
  now?: () => Date;
}

/**
 * A store that keeps everything in a Map.
 *
 * Optimistic concurrency is implemented for real rather than stubbed: `save`
 * refuses a stale `expectedRevision` with a conflict, so the 409 path in the
 * HTTP layer is exercised by something other than a mock.
 */
export function createMemoryStore(
  options: MemoryStoreOptions = {},
): MemoryStore {
  const { seed = [], now = () => new Date() } = options;
  const entries = new Map<string, Entry>();
  const revisions = new Map<string, number>();
  const permissions = new Map<string, PermissionAssignment[]>();

  for (const item of seed) {
    entries.set(key(item.ref), {
      ref: item.ref,
      // The config, as everywhere else. A separate seed field would list one
      // name here and another in a store seeded through `save`.
      name: dashboardDisplayName(item.record?.config, item.ref.slug),
      record: {
        config: { version: 2 },
        updatedAt: now().toISOString(),
        updatedBy: "seed",
        revision: 1,
        ...item.record,
      },
    });
    revisions.set(key(item.ref), item.record?.revision ?? 1);
    permissions.set(key(item.ref), item.assignments ?? []);
  }

  const removed = new Map<
    (ref: ServerDashboardRef) => void,
    (() => () => void) | undefined
  >();
  const tx = createMemoryTransaction(() => {
    const restore = [
      snapshotMap(entries),
      snapshotMap(revisions),
      snapshotMap(permissions),
      ...[...removed.values()].flatMap((snapshot) =>
        snapshot ? [snapshot()] : [],
      ),
    ];
    return () => restore.forEach((undo) => undo());
  });
  const notifyRemoval = (ref: ServerDashboardRef) => {
    for (const listener of removed.keys()) listener(ref);
  };
  const store: ServerDashboardStore = {
    load(ref) {
      const stored = entries.get(key(ref))?.record;
      return Promise.resolve(stored ? copyRecord(stored) : null);
    },

    save(ref: ServerDashboardRef, config: unknown, saveOptions: SaveOptions) {
      const existing = entries.get(key(ref));
      const current = existing?.record.revision ?? 0;
      if (
        saveOptions.expectedRevision !== undefined &&
        saveOptions.expectedRevision !== current
      ) {
        return Promise.reject(
          DashboardServerError.conflict(
            `Dashboard was modified by someone else (expected revision ${saveOptions.expectedRevision}, found ${current})`,
          ),
        );
      }
      const at = now().toISOString();
      const record: DashboardRecord = {
        config,
        updatedAt: at,
        updatedBy: saveOptions.updatedBy,
        revision: (revisions.get(key(ref)) ?? current) + 1,
        // Set once, on creation, and preserved from then on: the default
        // capability policy reads it to decide Contributor edit-own.
        ...(existing?.record.createdBy !== undefined
          ? { createdBy: existing.record.createdBy }
          : { createdBy: saveOptions.updatedBy }),
      };
      revisions.set(key(ref), record.revision);
      entries.set(key(ref), {
        ref,
        // Derived from the config, as the SQL store does. Keeping the name
        // fixed here would make a rename appear in one store's list only.
        name: dashboardDisplayName(config, ref.slug),
        record,
      });
      if (!permissions.has(key(ref))) permissions.set(key(ref), []);
      return Promise.resolve(copyRecord(record));
    },

    list(tenantId: string, scopeId: string): Promise<DashboardSummary[]> {
      return Promise.resolve(
        [...entries.values()]
          .filter(
            (e) => e.ref.tenantId === tenantId && e.ref.scopeId === scopeId,
          )
          .map((e) => {
            const order = dashboardSortOrder(e.record.config);
            return {
              slug: e.ref.slug,
              name: e.name,
              ...(order === undefined ? {} : { order }),
            };
          })
          // The SQL stores' order: by `order` with unordered last, then name, then slug.
          .sort(
            (a, b) =>
              (a.order ?? Number.MAX_SAFE_INTEGER) -
                (b.order ?? Number.MAX_SAFE_INTEGER) ||
              a.name.localeCompare(b.name) ||
              a.slug.localeCompare(b.slug),
          ),
      );
    },

    remove(ref) {
      entries.delete(key(ref));
      permissions.delete(key(ref));
      return Promise.resolve();
    },

    removeIfRevision(ref, revision) {
      if (!Number.isSafeInteger(revision) || revision < 1)
        return Promise.resolve(false);
      if (entries.get(key(ref))?.record.revision !== revision)
        return Promise.resolve(false);
      entries.delete(key(ref));
      permissions.delete(key(ref));
      return Promise.resolve(true);
    },

    getPermissions(ref) {
      return Promise.resolve([...(permissions.get(key(ref)) ?? [])]);
    },

    setPermissions(ref, assignments) {
      permissions.set(key(ref), [...assignments]);
      return Promise.resolve();
    },
  };
  return {
    ...store,
    transaction: tx.run,
    scopeTransaction: (_scope, body) => tx.run(body),
    onRemove(listener, snapshot) {
      tx.participate(snapshot);
      removed.set(listener, snapshot);
      return () => removed.delete(listener);
    },
    save: (ref, config, settings) =>
      tx.run(() => store.save(ref, config, settings)),
    setPermissions: (ref, assignments) =>
      tx.run(() => store.setPermissions(ref, assignments)),
    remove: (ref) =>
      tx.run(async () => {
        await store.remove(ref);
        notifyRemoval(ref);
      }),
    removeIfRevision: (ref, revision) =>
      tx.run(async () => {
        const deleted = await store.removeIfRevision!(ref, revision);
        if (deleted) notifyRemoval(ref);
        return deleted;
      }),
  };
}

// ------------------------------------------------------------- identity ----

/** tenantId → scopeId → userId → role */
export type Memberships = Record<
  string,
  Record<string, Record<string, DashboardRole>>
>;

/**
 * One level of the seed, by own property only.
 *
 * A tenant, scope or user id arrives from the request, and a plain object
 * inherits `constructor`, `toString` and the rest of `Object.prototype`. Read
 * with `[]`, a scope named "constructor" resolves to a function rather than to
 * nothing, and the lookup continues into it instead of stopping. Nothing found
 * that way is a valid role today, so this fails closed either way — but on the
 * strength of what `Object.prototype` happens to hold, which is not a property
 * worth resting on.
 */
function own<T>(
  source: Record<string, T> | undefined,
  key: string,
): T | undefined {
  if (source === undefined || !Object.hasOwn(source, key)) return undefined;
  return source[key];
}

/**
 * Scope authority backed by a plain object. Absent means denied, which is the
 * correct default and the reason the real seam has no default implementation.
 */
export function createMemoryScopeAuthority(
  memberships: Memberships,
): ScopeAuthority {
  return {
    resolveScopeRole(identity, scopeId) {
      const scopes = own(memberships, identity.tenantId);
      const members = own(scopes, scopeId);
      const role = own(members, identity.userId);
      return Promise.resolve(isDashboardRole(role) ? role : null);
    },
  };
}

/**
 * Tenant authority backed by the same object. A principal may act in a tenant
 * when the seed puts them in at least one of its scopes, which is what "is a
 * member of this tenant" means in a seed with no separate tenant roster.
 */
export function createMemoryTenantAuthority(
  memberships: Memberships,
): TenantAuthority {
  return {
    mayActAs(principal, tenantId) {
      const scopes = own(memberships, tenantId);
      return Promise.resolve(
        scopes !== undefined &&
          Object.values(scopes).some(
            (members) => own(members, principal.userId) !== undefined,
          ),
      );
    },
  };
}

export interface InsecureHeaderIdentityOptions {
  /** Header carrying the user id. Absent header means unauthenticated. */
  userHeader?: string;
  /** Comma-separated group list. */
  groupsHeader?: string;
}

/**
 * Reads an identity straight out of request headers, with no verification of
 * any kind.
 *
 * Named "insecure" deliberately and at every call site: anyone who can reach
 * the server can claim to be anyone. It exists so the package
 * can be exercised over HTTP — by Bruno, by an integrator, by a developer —
 * before a real identity provider is wired up.
 *
 * The standalone server refuses to use it unless explicitly switched on.
 * Never reach for it in a deployed environment.
 */
export function createInsecureHeaderIdentityResolver(
  options: InsecureHeaderIdentityOptions = {},
): IdentityResolver<Request> {
  const { userHeader = "x-dev-user", groupsHeader = "x-dev-groups" } = options;

  return {
    resolve(request: Request) {
      const userId = request.headers.get(userHeader);
      if (!userId) return Promise.resolve(null);
      const groups = (request.headers.get(groupsHeader) ?? "")
        .split(",")
        .map((g) => g.trim())
        .filter((g) => g.length > 0);
      const principal: DashboardPrincipal = {
        userId,
        kind: "user",
        capabilities: { ...FULL_CAPABILITIES },
        ...(groups.length > 0 ? { groups } : {}),
      };
      return Promise.resolve(principal);
    },
  };
}

// ---------------------------------------------------------- credentials ----

/** Returns whatever it was seeded with, keyed by tenant and credential ref. */
export function createMemoryCredentialsVault(
  credentials: Record<string, Record<string, DataSourceCredential>> = {},
): CredentialsVault {
  return {
    resolve(tenantId, credentialRef) {
      return Promise.resolve(credentials[tenantId]?.[credentialRef] ?? null);
    },
  };
}

/**
 * A writable vault holding plaintext in memory, for tests and dev servers.
 * `vault-sql` is the one that encrypts.
 */
export function createMemoryCredentialsStore(
  seed: Record<string, Record<string, CredentialInput>> = {},
): CredentialsStore {
  const byTenant = new Map<string, Map<string, StoredCredential>>();
  for (const [tenantId, refs] of Object.entries(seed)) {
    for (const [ref, input] of Object.entries(refs)) {
      tenantOf(tenantId).set(ref, {
        input: { ...input },
        updatedAt: new Date(0).toISOString(),
      });
    }
  }

  function tenantOf(tenantId: string): Map<string, StoredCredential> {
    let refs = byTenant.get(tenantId);
    if (refs === undefined) {
      refs = new Map();
      byTenant.set(tenantId, refs);
    }
    return refs;
  }

  function summarize(ref: string, stored: StoredCredential): CredentialSummary {
    const preview = previewOf(stored.input);
    return {
      ref,
      kind: stored.input.kind,
      ...(preview === undefined ? {} : { preview }),
      updatedAt: stored.updatedAt,
    };
  }

  return {
    resolve(tenantId, credentialRef) {
      const stored = byTenant.get(tenantId)?.get(credentialRef);
      return Promise.resolve(
        stored === undefined ? null : applyCredential(stored.input),
      );
    },
    listCredentials(tenantId) {
      const refs = byTenant.get(tenantId) ?? new Map();
      return Promise.resolve(
        [...refs.entries()].map(([ref, stored]) => summarize(ref, stored)),
      );
    },
    describeCredential(tenantId, credentialRef) {
      const stored = byTenant.get(tenantId)?.get(credentialRef);
      return Promise.resolve(
        stored === undefined ? null : summarize(credentialRef, stored),
      );
    },
    putCredential(tenantId, credentialRef, input) {
      const stored = {
        input: { ...input },
        updatedAt: new Date().toISOString(),
      };
      tenantOf(tenantId).set(credentialRef, stored);
      return Promise.resolve(summarize(credentialRef, stored));
    },
    removeCredential(tenantId, credentialRef) {
      byTenant.get(tenantId)?.delete(credentialRef);
      return Promise.resolve();
    },
  };
}

interface StoredCredential {
  input: CredentialInput;
  updatedAt: string;
}

// --------------------------------------------------------- datasources ----

/** Keyed by tenant, in insertion order. */
export function createMemoryDataSourceStore(
  seed: Record<string, Record<string, DataSourceInput>> = {},
): DataSourceStore {
  const byTenant = new Map<string, Map<string, DataSourceDescriptor>>();

  function tenantOf(tenantId: string): Map<string, DataSourceDescriptor> {
    let rows = byTenant.get(tenantId);
    if (rows === undefined) {
      rows = new Map();
      byTenant.set(tenantId, rows);
    }
    return rows;
  }

  function write(
    tenantId: string,
    id: string,
    input: DataSourceInput,
    updatedAt: string,
  ): DataSourceDescriptor {
    const descriptor: DataSourceDescriptor = {
      id,
      name: input.name,
      type: input.type,
      ...(input.description === undefined
        ? {}
        : { description: input.description }),
      isActive: input.isActive,
      target: input.target,
      ...(input.credentialRef === undefined
        ? {}
        : { credentialRef: input.credentialRef }),
      updatedAt,
    };
    tenantOf(tenantId).set(id, descriptor);
    return copy(descriptor);
  }

  /** Never the stored object — see the dashboard store above. */
  function copy(descriptor: DataSourceDescriptor): DataSourceDescriptor {
    return { ...descriptor };
  }

  for (const [tenantId, rows] of Object.entries(seed)) {
    for (const [id, input] of Object.entries(rows)) {
      write(tenantId, id, input, new Date(0).toISOString());
    }
  }

  return {
    list(tenantId) {
      const rows = [...(byTenant.get(tenantId)?.values() ?? [])];
      return Promise.resolve(rows.map(copy));
    },
    get(tenantId, id) {
      const row = byTenant.get(tenantId)?.get(id);
      return Promise.resolve(row === undefined ? null : copy(row));
    },
    put(tenantId, id, input) {
      return Promise.resolve(
        write(tenantId, id, input, new Date().toISOString()),
      );
    },
    remove(tenantId, id) {
      byTenant.get(tenantId)?.delete(id);
      return Promise.resolve();
    },
  };
}

// ------------------------------------------------------------- folders ----

/**
 * Folders and placements in memory, with the same rules as the SQL store.
 * Bound to the dashboard store so transactions, existence checks and deletion
 * notifications cover both adapters, including deletion and reuse of a slug.
 */
export function createMemoryFolderStore(
  store: MemoryStore,
): DashboardFolderStore {
  const folders = new Map<string, DashboardFolder[]>();
  const placements = new Map<string, Map<string, string>>();
  /** Scope key → folder id → its permissions. */
  const grants = new Map<string, Map<string, PermissionAssignment[]>>();
  const grantsOf = (scope: { tenantId: string; scopeId: string }) => {
    const key = keyOf(scope);
    let rows = grants.get(key);
    if (rows === undefined) {
      rows = new Map();
      grants.set(key, rows);
    }
    return rows;
  };
  let counter = 0;
  const keyOf = (s: { tenantId: string; scopeId: string }) =>
    JSON.stringify([s.tenantId, s.scopeId]);
  const foldersOf = (scope: { tenantId: string; scopeId: string }) => {
    const key = keyOf(scope);
    let rows = folders.get(key);
    if (rows === undefined) {
      rows = [];
      folders.set(key, rows);
    }
    return rows;
  };
  const placementsOf = (scope: { tenantId: string; scopeId: string }) => {
    const key = keyOf(scope);
    let rows = placements.get(key);
    if (rows === undefined) {
      rows = new Map();
      placements.set(key, rows);
    }
    return rows;
  };

  store.onRemove(
    (ref) => placementsOf(ref).delete(ref.slug),
    () => {
      const restore = [
        snapshotMap(folders, (rows) => rows.map((folder) => ({ ...folder }))),
        snapshotMap(placements, (rows) => new Map(rows)),
        snapshotMap(grants, (rows) => new Map(rows)),
      ];
      return () => restore.forEach((undo) => undo());
    },
  );
  function transaction<T>(
    _scope: { tenantId: string; scopeId: string },
    body: () => Promise<T>,
  ): Promise<T> {
    return store.transaction(body);
  }

  const adapter: DashboardFolderStore = {
    transaction,
    list: (scope) => Promise.resolve(foldersOf(scope).map((f) => ({ ...f }))),
    placements: (scope) => Promise.resolve(new Map(placementsOf(scope))),
    // async, so a rule that throws rejects the promise as the SQL store does.
    async create(scope, input, createdBy) {
      const rows = foldersOf(scope);
      requireParent(rows, input.parentId);
      requireFreeName(rows, input.parentId, input.name);
      const folder = {
        id: `folder-${++counter}`,
        name: input.name.trim(),
        parentId: input.parentId,
        createdBy,
        ...(input.visibility === "restricted"
          ? { visibility: input.visibility }
          : {}),
      };
      rows.push(folder);
      return { ...folder };
    },
    async update(scope, id, patch) {
      const rows = foldersOf(scope);
      const next = applyFolderPatch(rows, id, patch);
      rows.splice(
        rows.findIndex((f) => f.id === id),
        1,
        next,
      );
      return { ...next };
    },
    subtree: (scope, id) =>
      Promise.resolve(folderSubtree(foldersOf(scope), placementsOf(scope), id)),
    removeFolders(scope, ids) {
      const gone = new Set(ids);
      requireCompleteFolderRemoval(foldersOf(scope), ids);
      const key = keyOf(scope);
      folders.set(
        key,
        foldersOf(scope).filter((f) => !gone.has(f.id)),
      );
      const placed = placementsOf(scope);
      for (const [slug, folderId] of placed) {
        if (gone.has(folderId)) placed.delete(slug);
      }
      const granted = grantsOf(scope);
      for (const id of gone) granted.delete(id);
      return Promise.resolve();
    },
    permissions: (scope) =>
      Promise.resolve(
        new Map(
          [...grantsOf(scope)].map(([id, list]) => [
            id,
            list.map((a) => ({ ...a })),
          ]),
        ),
      ),
    async setPermissions(scope, folderId, assignments, visibility) {
      requireParent(foldersOf(scope), folderId);
      const granted = grantsOf(scope);
      if (assignments.length === 0) granted.delete(folderId);
      else
        granted.set(
          folderId,
          assignments.map((a) => ({ ...a })),
        );
      if (visibility !== undefined) {
        const rows = foldersOf(scope);
        const index = rows.findIndex((f) => f.id === folderId);
        rows[index] = { ...rows[index]!, visibility };
      }
    },
    async setVisibility(scope, folderId, visibility) {
      const rows = foldersOf(scope);
      requireParent(rows, folderId);
      const index = rows.findIndex((f) => f.id === folderId);
      const { visibility: _previous, ...folder } = rows[index]!;
      rows.splice(
        index,
        1,
        visibility === "restricted" ? { ...folder, visibility } : folder,
      );
    },
    async placeDashboard(scope, slug, folderId) {
      requireParent(foldersOf(scope), folderId);
      if ((await store.load({ ...scope, slug })) === null) return false;
      const placed = placementsOf(scope);
      if (folderId === null) placed.delete(slug);
      else placed.set(slug, folderId);
      return true;
    },
  };
  return {
    ...adapter,
    create: (scope, input, creator) =>
      transaction(scope, () => adapter.create(scope, input, creator)),
    update: (scope, id, patch) =>
      transaction(scope, () => adapter.update(scope, id, patch)),
    removeFolders: (scope, ids) =>
      transaction(scope, () => adapter.removeFolders(scope, ids)),
    setPermissions: (scope, id, assignments, visibility) =>
      transaction(scope, () =>
        adapter.setPermissions(scope, id, assignments, visibility),
      ),
    setVisibility: (scope, id, visibility) =>
      transaction(scope, () => adapter.setVisibility(scope, id, visibility)),
    placeDashboard: (scope, slug, id) =>
      transaction(scope, () => adapter.placeDashboard(scope, slug, id)),
  };
}

// --------------------------------------------------------------- audit ----

export interface RecordingAuditSink extends AuditSink {
  readonly events: readonly AuditEvent[];
  clear(): void;
}

/** Keeps every event in an array. Useful in tests and when eyeballing a dev server. */
export function createRecordingAuditSink(): RecordingAuditSink {
  const events: AuditEvent[] = [];
  return {
    events,
    record(event) {
      events.push(event);
    },
    clear() {
      events.length = 0;
    },
  };
}
