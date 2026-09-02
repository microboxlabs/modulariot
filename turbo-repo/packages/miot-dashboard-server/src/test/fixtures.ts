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
  createRecordingAuditSink,
  type Memberships,
  type SeedDashboard,
} from "../testing";
import type { AuditEvent, AuditSink } from "../seams/audit";
import type { DashboardIdentity, IdentityResolver } from "../seams/identity";
import type { ServerDashboardStore } from "../seams/store";
import { FULL_CAPABILITIES } from "../access/roles";
import {
  createAccessControl,
  type AccessControl,
  type AccessControlOptions,
} from "../access/access-control";

export type { Memberships, SeedDashboard };

/**
 * The request type is the identity itself, so tests hand the access control
 * exactly the identity they want it to see. What is under test is everything
 * after identity resolution, which is everything this package owns.
 */
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
    scopes: createMemoryScopeAuthority(options.memberships ?? {}),
    store,
    audit,
    ...(options.policy ? { policy: options.policy } : {}),
    ...(options.onAuditError ? { onAuditError: options.onAuditError } : {}),
    now: () => new Date("2026-09-02T12:00:00.000Z"),
  });
  return { control, store, audit };
}
