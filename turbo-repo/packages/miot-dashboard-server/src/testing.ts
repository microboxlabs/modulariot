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

import { DashboardServerError } from "./access/errors";
import { dashboardDisplayName } from "./store/composite";
import type { DashboardRole } from "./access/roles";
import { FULL_CAPABILITIES } from "./access/roles";
import type { AuditEvent, AuditSink } from "./seams/audit";
import type {
  CredentialsVault,
  DataSourceCredential,
} from "./seams/credentials";
import type {
  DashboardIdentity,
  IdentityResolver,
  ScopeAuthority,
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
  name?: string;
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
): ServerDashboardStore {
  const { seed = [], now = () => new Date() } = options;
  const entries = new Map<string, Entry>();
  const permissions = new Map<string, PermissionAssignment[]>();

  for (const item of seed) {
    entries.set(key(item.ref), {
      ref: item.ref,
      name: item.name ?? item.ref.slug,
      record: {
        config: { version: 2 },
        updatedAt: now().toISOString(),
        updatedBy: "seed",
        revision: 1,
        ...item.record,
      },
    });
    permissions.set(key(item.ref), item.assignments ?? []);
  }

  return {
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
      const record: DashboardRecord = {
        config,
        updatedAt: now().toISOString(),
        updatedBy: saveOptions.updatedBy,
        revision: current + 1,
        // Set once, on creation, and preserved from then on: the default
        // capability policy reads it to decide Contributor edit-own.
        ...(existing?.record.createdBy !== undefined
          ? { createdBy: existing.record.createdBy }
          : { createdBy: saveOptions.updatedBy }),
      };
      entries.set(key(ref), {
        ref,
        // Derived from the config, exactly as a real store does it, rather
        // than frozen at whatever the entry was first created with. Keeping
        // the cheap version here would have meant a rename showing up in the
        // list against a database and not against this — a divergence tests
        // written on this store would never see.
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
          .map((e) => ({ slug: e.ref.slug, name: e.name })),
      );
    },

    remove(ref) {
      entries.delete(key(ref));
      permissions.delete(key(ref));
      return Promise.resolve();
    },

    getPermissions(ref) {
      return Promise.resolve([...(permissions.get(key(ref)) ?? [])]);
    },

    setPermissions(ref, assignments) {
      permissions.set(key(ref), [...assignments]);
      return Promise.resolve();
    },
  };
}

// ------------------------------------------------------------- identity ----

/** tenantId → scopeId → userId → role */
export type Memberships = Record<
  string,
  Record<string, Record<string, DashboardRole>>
>;

/**
 * Scope authority backed by a plain object. Absent means denied, which is the
 * correct default and the reason the real seam has no default implementation.
 */
export function createMemoryScopeAuthority(
  memberships: Memberships,
): ScopeAuthority {
  return {
    resolveScopeRole(identity, scopeId) {
      return Promise.resolve(
        memberships[identity.tenantId]?.[scopeId]?.[identity.userId] ?? null,
      );
    },
  };
}

export interface InsecureHeaderIdentityOptions {
  /** Header carrying the user id. Absent header means unauthenticated. */
  userHeader?: string;
  tenantHeader?: string;
  /** Comma-separated group list. */
  groupsHeader?: string;
}

/**
 * Reads an identity straight out of request headers, with no verification of
 * any kind.
 *
 * Named "insecure" deliberately and at every call site: anyone who can reach
 * the server can claim to be anyone in any tenant. It exists so the package
 * can be exercised over HTTP — by Bruno, by an integrator, by a developer —
 * before a real identity provider is wired up.
 *
 * The standalone server refuses to use it unless explicitly switched on.
 * Never reach for it in a deployed environment.
 */
export function createInsecureHeaderIdentityResolver(
  options: InsecureHeaderIdentityOptions = {},
): IdentityResolver<Request> {
  const {
    userHeader = "x-dev-user",
    tenantHeader = "x-dev-tenant",
    groupsHeader = "x-dev-groups",
  } = options;

  return {
    resolve(request: Request) {
      const userId = request.headers.get(userHeader);
      const tenantId = request.headers.get(tenantHeader);
      if (!userId || !tenantId) return Promise.resolve(null);
      const groups = (request.headers.get(groupsHeader) ?? "")
        .split(",")
        .map((g) => g.trim())
        .filter((g) => g.length > 0);
      const identity: DashboardIdentity = {
        userId,
        tenantId,
        kind: "user",
        capabilities: { ...FULL_CAPABILITIES },
        ...(groups.length > 0 ? { groups } : {}),
      };
      return Promise.resolve(identity);
    },
  };
}

// ---------------------------------------------------------- credentials ----

/** Returns whatever it was seeded with, keyed by tenant and datasource. */
export function createMemoryCredentialsVault(
  credentials: Record<string, Record<string, DataSourceCredential>> = {},
): CredentialsVault {
  return {
    resolve(tenantId, dataSourceId) {
      return Promise.resolve(credentials[tenantId]?.[dataSourceId] ?? null);
    },
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
