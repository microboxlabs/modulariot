/**
 * Test wiring.
 *
 * The seam implementations themselves live in `src/testing.ts` and are shipped,
 * because the dev server and any integrator need exactly the same doubles. What
 * lives here is only what tests need on top: spies, so a test can assert that
 * the store was never reached, and a harness that assembles the parts.
 *
 * Keeping one implementation matters. When the store double was defined twice,
 * the copy that nothing asserted on quietly grew a key-collision bug.
 */

import { vi } from "vitest";
import {
  createMemoryScopeAuthority,
  createMemoryStore,
  createMemoryTenantAuthority,
  createRecordingAuditSink,
  type Memberships,
  type SeedDashboard,
} from "../testing";
import type { AuditEvent, AuditSink } from "../seams/audit";
import type {
  DashboardIdentity,
  DashboardPrincipal,
  IdentityResolver,
} from "../seams/identity";
import type { ServerDashboardStore } from "../seams/store";
import { FULL_CAPABILITIES } from "../access/roles";
import {
  createAccessControl,
  type AccessControl,
  type AccessControlOptions,
  type AccessTarget,
} from "../access/access-control";

export type { Memberships, SeedDashboard };

/**
 * The request type is the identity itself, so tests hand the access control
 * exactly the identity they want it to see. What is under test is everything
 * after identity resolution, which is everything this package owns.
 *
 * It carries a tenant, which a real `DashboardPrincipal` does not: the
 * fixtures use it to fill in the tenant a request would have named in its
 * path. The resolver below strips it, so the code under test still only ever
 * sees a principal and has to get the tenant from the target.
 */
export type TestRequest = DashboardIdentity | null;

export const identityFromRequest: IdentityResolver<TestRequest> = {
  resolve: (request) => {
    if (request === null) return Promise.resolve(null);
    const { tenantId: _bound, ...principal } = request;
    return Promise.resolve(principal satisfies DashboardPrincipal);
  },
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
    embedScope: { tenantId, scopeId, slug },
    capabilities: { ...FULL_CAPABILITIES },
    ...overrides,
  };
}

export const scopeAuthority = createMemoryScopeAuthority;

export interface MemoryStore extends ServerDashboardStore {
  load: ReturnType<typeof vi.fn<ServerDashboardStore["load"]>>;
  list: ReturnType<typeof vi.fn<ServerDashboardStore["list"]>>;
  getPermissions: ReturnType<
    typeof vi.fn<ServerDashboardStore["getPermissions"]>
  >;
  save: ReturnType<typeof vi.fn<ServerDashboardStore["save"]>>;
  remove: ReturnType<typeof vi.fn<ServerDashboardStore["remove"]>>;
  setPermissions: ReturnType<
    typeof vi.fn<ServerDashboardStore["setPermissions"]>
  >;
  /** True when any read or write reached the store. */
  touched(): boolean;
}

/** The shipped in-memory store, with every method wrapped in a spy. */
export function memoryStore(seed: SeedDashboard[] = []): MemoryStore {
  const inner = createMemoryStore({
    seed,
    now: () => new Date("2026-01-01T00:00:00.000Z"),
  });

  const load = vi.fn<ServerDashboardStore["load"]>(inner.load.bind(inner));
  const list = vi.fn<ServerDashboardStore["list"]>(inner.list.bind(inner));
  const save = vi.fn<ServerDashboardStore["save"]>(inner.save.bind(inner));
  const remove = vi.fn<ServerDashboardStore["remove"]>(
    inner.remove.bind(inner),
  );
  const getPermissions = vi.fn<ServerDashboardStore["getPermissions"]>(
    inner.getPermissions.bind(inner),
  );
  const setPermissions = vi.fn<ServerDashboardStore["setPermissions"]>(
    inner.setPermissions.bind(inner),
  );

  return {
    load,
    list,
    save,
    remove,
    getPermissions,
    setPermissions,
    touched: () =>
      [load, list, save, remove, getPermissions, setPermissions].some(
        (fn) => fn.mock.calls.length > 0,
      ),
  };
}

export interface RecordingAudit extends AuditSink {
  events: AuditEvent[];
}

export function recordingAudit(): RecordingAudit {
  const sink = createRecordingAuditSink();
  return {
    events: sink.events as AuditEvent[],
    record: (event) => sink.record(event),
  };
}

/**
 * The harness's access control, with the tenant made optional on a target.
 * Only the fixtures may leave it out; the real `AccessControl` requires it.
 */
export interface HarnessControl {
  authorize(
    request: TestRequest,
    target: Omit<AccessTarget, "tenantId"> & { tenantId?: string },
  ): ReturnType<AccessControl<TestRequest>["authorize"]>;
  capabilities(
    request: TestRequest,
    target: { tenantId?: string; scopeId: string; slug: string },
  ): ReturnType<AccessControl<TestRequest>["capabilities"]>;
}

export interface Harness {
  control: HarnessControl;
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
  const memberships = options.memberships ?? {};
  const control = createAccessControl<TestRequest>({
    identity: identityFromRequest,
    tenants: createMemoryTenantAuthority(memberships),
    scopes: createMemoryScopeAuthority(memberships),
    store,
    audit,
    ...(options.policy ? { policy: options.policy } : {}),
    ...(options.onAuditError ? { onAuditError: options.onAuditError } : {}),
    now: () => new Date("2026-09-02T12:00:00.000Z"),
  });

  // A target with no tenant means "the one this principal is in", which is
  // what a request naming its own tenant in the path amounts to. A test about
  // crossing tenants passes `tenantId` and this leaves it alone.
  const withTenant = <T extends { tenantId?: string }>(
    request: TestRequest,
    target: T,
  ): T & { tenantId: string } => ({
    tenantId: request?.tenantId ?? "no-tenant-named",
    ...target,
  });

  return {
    control: {
      authorize: (request, target) =>
        control.authorize(request, withTenant(request, target)),
      capabilities: (request, target) =>
        control.capabilities(request, withTenant(request, target)),
    },
    store,
    audit,
  };
}
