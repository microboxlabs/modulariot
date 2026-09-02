/**
 * The HTTP layer, exercised twice: once against the handler in-process, once
 * against a real Node listener over a socket.
 *
 * That duplication is the point. The project supports two shapes — mount the
 * library, or run the server — and if the suite only ever drove one of them,
 * the other would rot without anyone noticing. Every case below runs against
 * both, so a divergence is a test failure rather than a support ticket.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDashboardHandler } from "./handler";
import { serve, type RunningServer } from "../server/serve";
import {
  createInsecureHeaderIdentityResolver,
  createMemoryScopeAuthority,
  createMemoryStore,
  createRecordingAuditSink,
  type Memberships,
  type SeedDashboard,
} from "../testing";
import type { ServerDashboardStore } from "../seams/store";

const MEMBERSHIPS: Memberships = {
  acme: { ops: { alice: "Coordinator", con: "Consumer", carl: "Contributor" } },
  globex: { ops: { bob: "Coordinator" } },
};

const seedFor = (): SeedDashboard[] => [
  {
    ref: { tenantId: "acme", scopeId: "ops", slug: "fleet" },
    name: "Fleet",
    record: { config: { version: 2, title: "acme fleet" }, createdBy: "carl" },
  },
  {
    // Same scope and slug in another tenant: if isolation leaks anywhere, this
    // is the pair that reveals it.
    ref: { tenantId: "globex", scopeId: "ops", slug: "fleet" },
    name: "Fleet",
    record: { config: { version: 2, title: "globex fleet" } },
  },
];

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

interface Mode {
  name: string;
  fetch: Fetcher;
  store: ServerDashboardStore;
}

function buildOptions() {
  const store = createMemoryStore({
    seed: seedFor(),
    now: () => new Date("2026-01-01T00:00:00.000Z"),
  });
  return {
    store,
    options: {
      identity: createInsecureHeaderIdentityResolver(),
      scopes: createMemoryScopeAuthority(MEMBERSHIPS),
      store,
      audit: createRecordingAuditSink(),
    },
  };
}

const asUser = (userId: string, tenantId: string): RequestInit => ({
  headers: { "x-dev-user": userId, "x-dev-tenant": tenantId },
});

function withBody(
  init: RequestInit,
  method: string,
  body: unknown,
): RequestInit {
  return {
    ...init,
    method,
    headers: {
      ...(init.headers as Record<string, string>),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

let running: RunningServer;
let httpStore: ServerDashboardStore;
let inProcess: Mode;
let overHttp: Mode;

beforeAll(async () => {
  const direct = buildOptions();
  const handler = createDashboardHandler(direct.options);
  inProcess = {
    name: "in-process handler",
    store: direct.store,
    fetch: (path, init) =>
      handler(new Request(`http://test.local${path}`, init)),
  };

  const served = buildOptions();
  httpStore = served.store;
  running = await serve({
    ...served.options,
    port: 0,
    host: "127.0.0.1",
    log: () => {},
  });
  overHttp = {
    name: "node server over http",
    store: served.store,
    fetch: (path, init) => fetch(`${running.url}${path}`, init),
  };
});

afterAll(async () => {
  await running.close();
});

describe.each([
  ["in-process handler", () => inProcess],
  ["node server over http", () => overHttp],
])("%s", (_label, mode) => {
  it("refuses an unauthenticated request with the shared envelope", async () => {
    const response = await mode().fetch("/scopes/ops/dashboards");
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      error: "Authentication required",
      status: 401,
      code: "UNAUTHENTICATED",
    });
  });

  it("refuses a cross-tenant read with reason TENANT_SCOPE", async () => {
    const response = await mode().fetch(
      "/scopes/ops/dashboards/fleet",
      asUser("mallory", "globex"),
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "FORBIDDEN",
      reason: "TENANT_SCOPE",
    });
  });

  it("serves each tenant its own dashboard despite identical scope and slug", async () => {
    const acme = await mode().fetch(
      "/scopes/ops/dashboards/fleet",
      asUser("alice", "acme"),
    );
    const globex = await mode().fetch(
      "/scopes/ops/dashboards/fleet",
      asUser("bob", "globex"),
    );
    await expect(acme.json()).resolves.toEqual({
      data: { version: 2, title: "acme fleet" },
    });
    await expect(globex.json()).resolves.toEqual({
      data: { version: 2, title: "globex fleet" },
    });
  });

  it("lists only the caller's tenant", async () => {
    const response = await mode().fetch(
      "/scopes/ops/dashboards",
      asUser("alice", "acme"),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [{ slug: "fleet", name: "Fleet" }],
    });
  });

  it("returns effective capabilities, and 404 for a dashboard that is not there", async () => {
    const coordinator = await mode().fetch(
      "/scopes/ops/dashboards/fleet/capabilities",
      asUser("alice", "acme"),
    );
    await expect(coordinator.json()).resolves.toEqual({
      readOnly: false,
      canEdit: true,
      canShare: true,
      canManagePermissions: true,
      canDelete: true,
    });

    const consumer = await mode().fetch(
      "/scopes/ops/dashboards/fleet/capabilities",
      asUser("con", "acme"),
    );
    await expect(consumer.json()).resolves.toMatchObject({
      canEdit: false,
      canDelete: false,
    });

    const missing = await mode().fetch(
      "/scopes/ops/dashboards/nope/capabilities",
      asUser("alice", "acme"),
    );
    expect(missing.status).toBe(404);
  });

  it("denies a Consumer's write with reason CAPABILITY", async () => {
    const response = await mode().fetch(
      "/scopes/ops/dashboards/fleet",
      withBody(asUser("con", "acme"), "PUT", { version: 2 }),
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      reason: "CAPABILITY",
    });
  });

  it("saves, bumps the revision, and reports a stale write as 409", async () => {
    const created = await mode().fetch(
      "/scopes/ops/dashboards/newboard",
      withBody(asUser("alice", "acme"), "PUT", { version: 2, title: "first" }),
    );
    expect(created.status).toBe(200);
    const body = (await created.json()) as { data: { revision: number } };
    expect(body.data.revision).toBe(1);

    const stale = await mode().fetch("/scopes/ops/dashboards/newboard", {
      ...withBody(asUser("alice", "acme"), "PUT", { version: 2 }),
      headers: {
        "x-dev-user": "alice",
        "x-dev-tenant": "acme",
        "content-type": "application/json",
        "if-match": "0",
      },
    });
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects a malformed body and a malformed If-Match as 400", async () => {
    const badJson = await mode().fetch("/scopes/ops/dashboards/fleet", {
      method: "PUT",
      headers: {
        "x-dev-user": "alice",
        "x-dev-tenant": "acme",
        "content-type": "application/json",
      },
      body: "{not json",
    });
    expect(badJson.status).toBe(400);

    const badMatch = await mode().fetch("/scopes/ops/dashboards/fleet", {
      ...withBody(asUser("alice", "acme"), "PUT", { version: 2 }),
      headers: {
        "x-dev-user": "alice",
        "x-dev-tenant": "acme",
        "content-type": "application/json",
        "if-match": "banana",
      },
    });
    expect(badMatch.status).toBe(400);
  });

  it("reads and replaces permission assignments", async () => {
    const written = await mode().fetch(
      "/scopes/ops/dashboards/fleet/permissions",
      withBody(asUser("alice", "acme"), "PUT", {
        assignments: [{ authorityId: "con", role: "Editor" }],
      }),
    );
    expect(written.status).toBe(204);

    const read = await mode().fetch(
      "/scopes/ops/dashboards/fleet/permissions",
      asUser("alice", "acme"),
    );
    await expect(read.json()).resolves.toEqual({
      assignments: [{ authorityId: "con", role: "Editor" }],
    });

    // And the assignment now shows up in what that user may do.
    const promoted = await mode().fetch(
      "/scopes/ops/dashboards/fleet/capabilities",
      asUser("con", "acme"),
    );
    await expect(promoted.json()).resolves.toMatchObject({ canEdit: true });
  });

  it("rejects an unknown role rather than storing it", async () => {
    const response = await mode().fetch(
      "/scopes/ops/dashboards/fleet/permissions",
      withBody(asUser("alice", "acme"), "PUT", {
        assignments: [{ authorityId: "con", role: "Administrator" }],
      }),
    );
    expect(response.status).toBe(400);
  });

  it("deletes, then reports the dashboard as gone", async () => {
    await mode().fetch(
      "/scopes/ops/dashboards/doomed",
      withBody(asUser("alice", "acme"), "PUT", { version: 2 }),
    );
    const deleted = await mode().fetch("/scopes/ops/dashboards/doomed", {
      ...asUser("alice", "acme"),
      method: "DELETE",
    });
    expect(deleted.status).toBe(204);

    const gone = await mode().fetch("/scopes/ops/dashboards/doomed", {
      ...asUser("alice", "acme"),
      method: "DELETE",
    });
    expect(gone.status).toBe(404);
  });

  it("answers an unknown path with the same envelope, not a stack trace", async () => {
    const response = await mode().fetch(
      "/scopes/ops/widgets",
      asUser("alice", "acme"),
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "No such endpoint",
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("does not disclose which methods a path supports to an unauthorized caller", async () => {
    const response = await mode().fetch("/scopes/ops/dashboards", {
      ...asUser("alice", "acme"),
      method: "PATCH",
    });
    expect(response.status).toBe(404);
  });
});

describe("mount prefix", () => {
  it.each([
    ["/api/dashboard", "leading slash, no trailing"],
    ["/api/dashboard/", "one trailing slash"],
    ["/api/dashboard///", "several trailing slashes"],
    ["api/dashboard", "no leading slash"],
  ])("normalises %s (%s)", async (basePath) => {
    const { options } = buildOptions();
    const handler = createDashboardHandler({ ...options, basePath });
    const response = await handler(
      new Request(
        "http://test.local/api/dashboard/scopes/ops/dashboards",
        asUser("alice", "acme"),
      ),
    );
    expect(response.status).toBe(200);
  });

  it("normalises a long run of slashes in linear time", () => {
    // Guards the shape of the fix rather than the fix itself: the previous
    // version used a regex that backtracks quadratically on exactly this
    // input, which CodeQL flagged as a polynomial regular expression.
    const { options } = buildOptions();
    const started = Date.now();
    createDashboardHandler({
      ...options,
      basePath: `/x${"/".repeat(200_000)}`,
    });
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("treats a basePath of only slashes as no prefix at all", async () => {
    const { options } = buildOptions();
    const handler = createDashboardHandler({ ...options, basePath: "///" });
    const response = await handler(
      new Request(
        "http://test.local/scopes/ops/dashboards",
        asUser("alice", "acme"),
      ),
    );
    expect(response.status).toBe(200);
  });

  it("serves under a basePath and ignores anything outside it", async () => {
    const { options } = buildOptions();
    const handler = createDashboardHandler({
      ...options,
      basePath: "/api/dashboard",
    });
    const inside = await handler(
      new Request(
        "http://test.local/api/dashboard/scopes/ops/dashboards",
        asUser("alice", "acme"),
      ),
    );
    expect(inside.status).toBe(200);

    const outside = await handler(
      new Request(
        "http://test.local/scopes/ops/dashboards",
        asUser("alice", "acme"),
      ),
    );
    expect(outside.status).toBe(404);
  });
});

describe("standalone server extras", () => {
  it("answers health and readiness probes without authentication", async () => {
    for (const path of ["/health", "/livez", "/readyz"]) {
      const response = await fetch(`${running.url}${path}`);
      expect(response.status, path).toBe(200);
    }
  });

  it("keeps probes out of the library shape, where the host owns them", async () => {
    const { options } = buildOptions();
    const handler = createDashboardHandler(options);
    const response = await handler(new Request("http://test.local/health"));
    expect(response.status).toBe(404);
  });

  it("wrote through to its own store, not the in-process one", async () => {
    await expect(
      httpStore.load({ tenantId: "acme", scopeId: "ops", slug: "newboard" }),
    ).resolves.not.toBeNull();
  });
});
