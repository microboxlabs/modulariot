/**
 * Test doubles for the four seams.
 *
 * The request type is the identity itself (or null): tests hand the access
 * control exactly the identity they want it to see, so what is under test is
 * everything *after* identity resolution — which is everything this package
 * owns.
 */

import { vi } from "vitest";
import type { AuditEvent, AuditSink } from "../seams/audit";
import type {
  DashboardIdentity,
  IdentityResolver,
  ScopeAuthority,
} from "../seams/identity";
import type {
  DashboardRecord,
  PermissionAssignment,
  ServerDashboardRef,
  ServerDashboardStore,
} from "../seams/store";
import type { DashboardRole } from "../access/roles";
import { FULL_CAPABILITIES } from "../access/roles";
import {
  createAccessControl,
  type AccessControl,
  type AccessControlOptions,
} from "../access/access-control";

export type TestRequest = DashboardIdentity | null;

export const identityFromRequest: IdentityResolver<TestRequest> = {
  resolve: (request) => Promise.resolve(request),
};

export function user(
  userId: string,
  tenantId: string,
  overrides: Partial<DashboardIdentity> = {},
): DashboardIdentity {
  return {
    userId,
    tenantId,
    kind: "user",
    capabilities: { ...FULL_CAPABILITIES },
    ...overrides,
  };
}

export function embed(
  tenantId: string,
  scopeId: string,
  slug: string,
  overrides: Partial<DashboardIdentity> = {},
): DashboardIdentity {
  return {
    userId: `embed:${scopeId}/${slug}`,
    tenantId,
    kind: "embed",
    embedScope: { scopeId, slug },
    capabilities: { ...FULL_CAPABILITIES },
    ...overrides,
  };
}

/** tenantId → scopeId → userId → role */
export type Memberships = Record<
  string,
  Record<string, Record<string, DashboardRole>>
>;

export function scopeAuthority(memberships: Memberships): ScopeAuthority {
  return {
    resolveScopeRole: (identity, scopeId) =>
      Promise.resolve(
        memberships[identity.tenantId]?.[scopeId]?.[identity.userId] ?? null,
      ),
  };
}

export interface SeedDashboard {
  ref: ServerDashboardRef;
  record?: Partial<DashboardRecord>;
  assignments?: PermissionAssignment[];
}

const key = (ref: ServerDashboardRef) =>
  `${ref.tenantId}${ref.scopeId}${ref.slug}`;

export interface MemoryStore extends ServerDashboardStore {
  load: ReturnType<typeof vi.fn<ServerDashboardStore["load"]>>;
  list: ReturnType<typeof vi.fn<ServerDashboardStore["list"]>>;
  getPermissions: ReturnType<
    typeof vi.fn<ServerDashboardStore["getPermissions"]>
  >;
  /** True when any read or write reached the store. */
  touched(): boolean;
}

export function memoryStore(seed: SeedDashboard[] = []): MemoryStore {
  const records = new Map<string, DashboardRecord>();
  const permissions = new Map<string, PermissionAssignment[]>();
  for (const { ref, record, assignments } of seed) {
    records.set(key(ref), {
      config: { version: 2 },
      updatedAt: "2026-01-01T00:00:00.000Z",
      updatedBy: "seed",
      revision: 1,
      ...record,
    });
    permissions.set(key(ref), assignments ?? []);
  }

  const load = vi.fn<ServerDashboardStore["load"]>((ref) =>
    Promise.resolve(records.get(key(ref)) ?? null),
  );
  const list = vi.fn<ServerDashboardStore["list"]>((tenantId, scopeId) =>
    Promise.resolve(
      [...records.keys()]
        .filter((k) => k.startsWith(`${tenantId}${scopeId}`))
        .map((k) => ({ slug: k.split("")[2] ?? "", name: "" })),
    ),
  );
  const getPermissions = vi.fn<ServerDashboardStore["getPermissions"]>((ref) =>
    Promise.resolve(permissions.get(key(ref)) ?? []),
  );
  const save = vi.fn<ServerDashboardStore["save"]>();
  const remove = vi.fn<ServerDashboardStore["remove"]>();
  const setPermissions = vi.fn<ServerDashboardStore["setPermissions"]>();

  return {
    load,
    list,
    getPermissions,
    save,
    remove,
    setPermissions,
    touched: () =>
      [load, list, getPermissions, save, remove, setPermissions].some(
        (fn) => fn.mock.calls.length > 0,
      ),
  };
}

export interface RecordingAudit extends AuditSink {
  events: AuditEvent[];
}

export function recordingAudit(): RecordingAudit {
  const events: AuditEvent[] = [];
  return {
    events,
    record(event) {
      events.push(event);
    },
  };
}

export interface Harness {
  control: AccessControl<TestRequest>;
  store: MemoryStore;
  audit: RecordingAudit;
}

export function harness(
  options: {
    memberships?: Memberships;
    seed?: SeedDashboard[];
  } & Partial<
    Pick<AccessControlOptions<TestRequest>, "policy" | "onAuditError">
  > = {},
): Harness {
  const store = memoryStore(options.seed);
  const audit = recordingAudit();
  const control = createAccessControl<TestRequest>({
    identity: identityFromRequest,
    scopes: scopeAuthority(options.memberships ?? {}),
    store,
    audit,
    ...(options.policy ? { policy: options.policy } : {}),
    ...(options.onAuditError ? { onAuditError: options.onAuditError } : {}),
    now: () => new Date("2026-09-02T12:00:00.000Z"),
  });
  return { control, store, audit };
}
