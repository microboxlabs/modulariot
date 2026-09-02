/**
 * The isolation suite. Its job is to make the tenancy invariant a test
 * failure rather than a code-review observation: a credential for one tenant
 * must resolve nothing from another, on every action, and the store must not
 * even be consulted before the scope check passes.
 *
 * Every later phase adds its service on top of `authorize` and inherits
 * these cases unchanged.
 */

import { describe, expect, it, vi } from "vitest";
import { NO_CAPABILITIES } from "../seams/identity";
import type { ServerDashboardRef } from "../seams/store";
import { embed, harness, user, type Memberships } from "../test/fixtures";
import type { DashboardAction } from "./access-control";
import { DashboardServerError } from "./errors";
import { FULL_CAPABILITIES, capabilitiesForRole } from "./roles";

const ALL_ACTIONS: readonly DashboardAction[] = [
  "dashboard.list",
  "dashboard.load",
  "dashboard.save",
  "dashboard.delete",
  "dashboard.permissions.read",
  "dashboard.permissions.write",
  "datasource.list",
  "datasource.query",
  "datasource.write",
  "embed.token.issue",
];

const SCOPE_ACTIONS: readonly DashboardAction[] = [
  "dashboard.list",
  "datasource.list",
  "datasource.query",
  "datasource.write",
];

const A: ServerDashboardRef = {
  tenantId: "acme",
  scopeId: "ops",
  slug: "fleet",
};

/** Same scope and slug names as tenant A — the collision an isolation bug hides behind. */
const B_TWIN: ServerDashboardRef = {
  tenantId: "globex",
  scopeId: "ops",
  slug: "fleet",
};

const memberships: Memberships = {
  acme: {
    ops: {
      alice: "Coordinator",
      eve: "Editor",
      carl: "Contributor",
      con: "Consumer",
    },
  },
  globex: { ops: { bob: "Coordinator" } },
};

const seed = [
  { ref: A, record: { createdBy: "carl" } },
  { ref: B_TWIN, record: { createdBy: "bob" } },
];

async function expectError(
  promise: Promise<unknown>,
): Promise<DashboardServerError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof DashboardServerError) return error;
    throw error;
  }
  throw new Error("expected a DashboardServerError");
}

describe("tenant isolation", () => {
  for (const action of ALL_ACTIONS) {
    const slug = SCOPE_ACTIONS.includes(action) ? undefined : A.slug;

    it(`${action}: a tenant-B credential naming tenant A's scope is refused before any store call`, async () => {
      const h = harness({ memberships, seed });
      const outsider = user("mallory", "globex");

      const error = await expectError(
        h.control.authorize(outsider, {
          scopeId: A.scopeId,
          ...(slug === undefined ? {} : { slug }),
          action,
        }),
      );

      expect(error.status).toBe(403);
      expect(error.reason).toBe("TENANT_SCOPE");
      expect(h.store.touched()).toBe(false);
      expect(h.audit.events).toEqual([
        expect.objectContaining({
          action,
          outcome: "denied",
          tenantId: "globex",
          userId: "mallory",
          detail: expect.objectContaining({ reason: "TENANT_SCOPE" }),
        }),
      ]);
    });
  }

  it("a scope the credential's tenant has no membership in is refused identically to a foreign one", async () => {
    const h = harness({ memberships, seed });
    const [foreign, unknown] = await Promise.all([
      expectError(
        h.control.authorize(user("zed", "globex"), {
          scopeId: "ops",
          slug: "fleet",
          action: "dashboard.load",
        }),
      ),
      expectError(
        h.control.authorize(user("zed", "globex"), {
          scopeId: "no-such-scope",
          slug: "fleet",
          action: "dashboard.load",
        }),
      ),
    ]);
    expect(foreign.toEnvelope()).toEqual(unknown.toEnvelope());
    expect(h.store.touched()).toBe(false);
  });

  it("the store reference always carries the credential's tenant, even when scope and slug names collide across tenants", async () => {
    const h = harness({ memberships, seed });

    const decision = await h.control.authorize(user("bob", "globex"), {
      scopeId: "ops",
      slug: "fleet",
      action: "dashboard.load",
    });

    expect(h.store.load).toHaveBeenCalledWith(B_TWIN);
    expect(h.store.load).not.toHaveBeenCalledWith(A);
    expect(decision.dashboard?.ref).toEqual(B_TWIN);
    expect(decision.dashboard?.record?.createdBy).toBe("bob");
  });

  it("list is scoped to the credential's tenant, not the URL", async () => {
    const h = harness({ memberships, seed });
    const decision = await h.control.authorize(user("bob", "globex"), {
      scopeId: "ops",
      action: "dashboard.list",
    });
    expect(decision).toEqual({
      identity: expect.objectContaining({ tenantId: "globex" }),
      scopeId: "ops",
      scopeRole: "Coordinator",
    });
    expect(decision.dashboard).toBeUndefined();
  });
});

describe("unauthenticated requests", () => {
  it("are refused with 401 and audited without an identity", async () => {
    const h = harness({ memberships, seed });
    const error = await expectError(
      h.control.authorize(null, {
        scopeId: A.scopeId,
        slug: A.slug,
        action: "dashboard.load",
      }),
    );
    expect(error.status).toBe(401);
    expect(error.code).toBe("UNAUTHENTICATED");
    expect(h.store.touched()).toBe(false);
    expect(h.audit.events).toHaveLength(1);
    const [event] = h.audit.events;
    expect(event).toMatchObject({
      action: "dashboard.load",
      outcome: "denied",
      target: "ops/fleet",
      detail: { reason: "UNAUTHENTICATED" },
    });
    expect(event).not.toHaveProperty("tenantId");
    expect(event).not.toHaveProperty("userId");
  });
});

describe("embed principals", () => {
  const token = embed("acme", "ops", "fleet");

  it("may load the one dashboard the token names, read-only whatever the token claims", async () => {
    const h = harness({ memberships, seed });
    const decision = await h.control.authorize(token, {
      scopeId: "ops",
      slug: "fleet",
      action: "dashboard.load",
    });
    expect(decision.scopeRole).toBe("Consumer");
    expect(decision.dashboard?.capabilities).toEqual(NO_CAPABILITIES);
    expect(decision.dashboard?.ref).toEqual(A);
  });

  it("may query datasources in its scope without naming the dashboard", async () => {
    const h = harness({ memberships, seed });
    await expect(
      h.control.authorize(token, {
        scopeId: "ops",
        action: "datasource.query",
      }),
    ).resolves.toMatchObject({ scopeRole: "Consumer" });
  });

  it("is refused outside its scope, on another slug, and on every non-render action", async () => {
    const h = harness({ memberships, seed });
    const cases: Array<{
      scopeId: string;
      slug?: string;
      action: DashboardAction;
    }> = [
      { scopeId: "other", slug: "fleet", action: "dashboard.load" },
      { scopeId: "ops", slug: "other", action: "dashboard.load" },
      { scopeId: "other", action: "datasource.query" },
      ...ALL_ACTIONS.filter(
        (a) => a !== "dashboard.load" && a !== "datasource.query",
      ).map((action) => ({ scopeId: "ops", slug: "fleet", action })),
    ];
    for (const target of cases) {
      const error = await expectError(h.control.authorize(token, target));
      expect(error.reason, JSON.stringify(target)).toBe("EMBED_SCOPE");
    }
    expect(h.store.touched()).toBe(false);
  });

  it("an embed identity without an embed scope is refused, not trusted", async () => {
    const h = harness({ memberships, seed });
    const malformed = embed("acme", "ops", "fleet", { embedScope: undefined });
    const error = await expectError(
      h.control.authorize(malformed, {
        scopeId: "ops",
        slug: "fleet",
        action: "dashboard.load",
      }),
    );
    expect(error.reason).toBe("EMBED_SCOPE");
  });

  it("never consults the scope authority", async () => {
    const h = harness({ memberships: {}, seed });
    await expect(
      h.control.authorize(token, {
        scopeId: "ops",
        slug: "fleet",
        action: "dashboard.load",
      }),
    ).resolves.toBeDefined();
  });
});

describe("capabilities by role", () => {
  const target = (action: DashboardAction) => ({
    scopeId: A.scopeId,
    slug: A.slug,
    action,
  });

  it("Consumer: load only", async () => {
    const h = harness({ memberships, seed });
    const con = user("con", "acme");
    const decision = await h.control.authorize(con, target("dashboard.load"));
    expect(decision.dashboard?.capabilities).toEqual(NO_CAPABILITIES);
    for (const action of [
      "dashboard.save",
      "dashboard.delete",
      "dashboard.permissions.read",
      "dashboard.permissions.write",
      "embed.token.issue",
      "datasource.write",
    ] as const) {
      const error = await expectError(h.control.authorize(con, target(action)));
      expect(error.reason, action).toBe("CAPABILITY");
    }
    const scopeWrite = await expectError(
      h.control.authorize(con, { scopeId: "ops", action: "datasource.write" }),
    );
    expect(scopeWrite.reason).toBe("CAPABILITY");
  });

  it("Editor: edit, share and write back, but not delete or manage access", async () => {
    const h = harness({ memberships, seed });
    const eve = user("eve", "acme");
    for (const action of [
      "dashboard.load",
      "dashboard.save",
      "embed.token.issue",
      "datasource.write",
    ] as const) {
      await expect(
        h.control.authorize(eve, target(action)),
      ).resolves.toBeDefined();
    }
    for (const action of [
      "dashboard.delete",
      "dashboard.permissions.read",
      "dashboard.permissions.write",
    ] as const) {
      const error = await expectError(h.control.authorize(eve, target(action)));
      expect(error.reason, action).toBe("CAPABILITY");
    }
  });

  it("Coordinator: everything", async () => {
    const h = harness({ memberships, seed });
    const alice = user("alice", "acme");
    for (const action of ALL_ACTIONS) {
      await expect(
        h.control.authorize(alice, target(action)),
        action,
      ).resolves.toBeDefined();
    }
    const decision = await h.control.authorize(alice, target("dashboard.load"));
    expect(decision.dashboard?.capabilities).toEqual(FULL_CAPABILITIES);
  });

  it("Contributor: creates in the scope, edits what they created, nothing else", async () => {
    const h = harness({ memberships, seed });
    const carl = user("carl", "acme");

    // Owns "fleet" (seeded createdBy: carl).
    await expect(
      h.control.authorize(carl, target("dashboard.save")),
    ).resolves.toMatchObject({
      dashboard: { capabilities: { canEdit: true, canDelete: false } },
    });

    // May create a dashboard that does not exist yet.
    const created = await h.control.authorize(carl, {
      scopeId: "ops",
      slug: "brand-new",
      action: "dashboard.save",
    });
    expect(created.dashboard?.record).toBeNull();
    expect(h.store.getPermissions).not.toHaveBeenCalledWith(
      expect.objectContaining({ slug: "brand-new" }),
    );

    // A Consumer may not create.
    const error = await expectError(
      h.control.authorize(user("con", "acme"), {
        scopeId: "ops",
        slug: "brand-new",
        action: "dashboard.save",
      }),
    );
    expect(error.reason).toBe("CAPABILITY");
  });

  it("Contributor may not edit someone else's dashboard", async () => {
    const h = harness({
      memberships,
      seed: [{ ref: A, record: { createdBy: "alice" } }],
    });
    const error = await expectError(
      h.control.authorize(user("carl", "acme"), target("dashboard.save")),
    );
    expect(error.reason).toBe("CAPABILITY");
  });

  it("per-dashboard assignments raise a scope Consumer, by user id or group", async () => {
    const h = harness({
      memberships,
      seed: [
        {
          ref: A,
          assignments: [
            { authorityId: "con", role: "Editor" },
            { authorityId: "GROUP_analysts", role: "Coordinator" },
          ],
        },
      ],
    });
    const byUser = await h.control.authorize(
      user("con", "acme"),
      target("dashboard.load"),
    );
    expect(byUser.dashboard?.capabilities).toEqual(
      capabilitiesForRole("Editor"),
    );

    const byGroup = await h.control.authorize(
      user("con", "acme", { groups: ["GROUP_analysts"] }),
      target("dashboard.load"),
    );
    expect(byGroup.dashboard?.capabilities).toEqual(FULL_CAPABILITIES);
  });

  it("the identity's ceiling narrows what the role would grant", async () => {
    const h = harness({ memberships, seed });
    const cappedAlice = user("alice", "acme", {
      capabilities: { ...FULL_CAPABILITIES, canDelete: false },
    });
    const decision = await h.control.authorize(
      cappedAlice,
      target("dashboard.load"),
    );
    expect(decision.dashboard?.capabilities.canDelete).toBe(false);
    const error = await expectError(
      h.control.authorize(cappedAlice, target("dashboard.delete")),
    );
    expect(error.reason).toBe("CAPABILITY");
  });

  it("a custom policy returning null denies a scope member", async () => {
    const h = harness({
      memberships,
      seed,
      policy: { resolve: () => null },
    });
    const error = await expectError(
      h.control.authorize(user("alice", "acme"), target("dashboard.load")),
    );
    expect(error.reason).toBe("CAPABILITY");
    expect(h.audit.events.at(-1)).toMatchObject({ outcome: "denied" });
  });

  it("a custom policy cannot grant past the ceiling", async () => {
    const h = harness({
      memberships,
      seed,
      policy: { resolve: () => ({ ...FULL_CAPABILITIES }) },
    });
    const decision = await h.control.authorize(
      user("con", "acme", { capabilities: { ...NO_CAPABILITIES } }),
      target("dashboard.load"),
    );
    expect(decision.dashboard?.capabilities).toEqual(NO_CAPABILITIES);
  });
});

describe("target validation", () => {
  it("dashboard-level actions without a slug are a caller bug, reported as 400 and audited", async () => {
    const h = harness({ memberships, seed });
    const error = await expectError(
      h.control.authorize(user("alice", "acme"), {
        scopeId: "ops",
        action: "dashboard.save",
      }),
    );
    expect(error.status).toBe(400);
    expect(h.store.touched()).toBe(false);
    // The module header promises every refusal is audited; this is the path
    // that used to slip out unrecorded.
    expect(h.audit.events).toEqual([
      expect.objectContaining({
        action: "dashboard.save",
        outcome: "denied",
        target: "ops",
        tenantId: "acme",
        userId: "alice",
        detail: expect.objectContaining({ reason: "BAD_REQUEST" }),
      }),
    ]);
  });
});

describe("capabilities()", () => {
  it("returns the effective capabilities for the caller", async () => {
    const h = harness({ memberships, seed });
    await expect(
      h.control.capabilities(user("eve", "acme"), "ops", "fleet"),
    ).resolves.toEqual(capabilitiesForRole("Editor"));
  });

  it("is 404 for a dashboard that does not exist", async () => {
    const h = harness({ memberships, seed });
    const error = await expectError(
      h.control.capabilities(user("alice", "acme"), "ops", "missing"),
    );
    expect(error.status).toBe(404);
  });

  it("is 403 for an outsider, before the store is consulted", async () => {
    const h = harness({ memberships, seed });
    const error = await expectError(
      h.control.capabilities(user("mallory", "globex"), "ops", "fleet"),
    );
    expect(error.reason).toBe("TENANT_SCOPE");
    expect(h.store.touched()).toBe(false);
  });
});

describe("audit", () => {
  it("records allowed decisions with the scope role", async () => {
    const h = harness({ memberships, seed });
    await h.control.authorize(user("eve", "acme"), {
      scopeId: "ops",
      slug: "fleet",
      action: "dashboard.save",
    });
    expect(h.audit.events).toEqual([
      {
        at: "2026-09-02T12:00:00.000Z",
        tenantId: "acme",
        userId: "eve",
        action: "dashboard.save",
        outcome: "allowed",
        target: "ops/fleet",
        detail: { principal: "user", scopeRole: "Editor" },
      },
    ]);
  });

  it("a failing sink never fails the decision, and is reported", async () => {
    const onAuditError = vi.fn();
    const boom = new Error("sink down");
    const h = harness({ memberships, seed, onAuditError });
    h.audit.record = () => Promise.reject(boom);

    await expect(
      h.control.authorize(user("alice", "acme"), {
        scopeId: "ops",
        slug: "fleet",
        action: "dashboard.load",
      }),
    ).resolves.toBeDefined();
    expect(onAuditError).toHaveBeenCalledWith(boom);
  });
});
