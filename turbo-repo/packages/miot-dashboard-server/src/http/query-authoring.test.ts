import type { QueryPlan } from "@microboxlabs/miot-dashboard-contract/authoring";
import { describe, expect, it, vi } from "vitest";
import { createDashboardHandler } from "./handler";
import {
  createInsecureHeaderIdentityResolver,
  createMemoryScopeAuthority,
  createMemoryStore,
  createMemoryTenantAuthority,
} from "../testing";
import type { QueryAuthoring } from "../seams/authoring";

const BASE = "https://dashboard.test/tenants/acme/scopes/ops/query-sources";
const draft = {
  name: "Daily trips",
  projectId: "analytics-prod",
  location: "US",
  sql: "SELECT 1 AS one",
  maximumBytesBilled: 1000,
  parameters: [],
};
const saved: QueryPlan = {
  ...draft,
  id: "p1",
  sourceId: "warehouse",
  revision: "r1",
  updatedAt: "2026-10-27T00:00:00Z",
};
const dryRun = {
  statistics: {
    totalBytesProcessed: "10",
    query: { statementType: "SELECT", schema: { fields: [] } },
  },
};

function setup() {
  const memberships = {
    acme: {
      ops: {
        coordinator: "Coordinator" as const,
        editor: "Editor" as const,
        contributor: "Contributor" as const,
      },
    },
  };
  const update = vi.fn<QueryAuthoring["plans"]["update"]>(async () => ({
    ...saved,
    revision: "r2",
  }));
  const authoring: QueryAuthoring = {
    listSources: async () => [
      {
        id: "warehouse",
        label: "Warehouse",
        kind: "BIGQUERY",
        defaultProjectId: "analytics-prod",
      },
    ],
    accessFor: async ({ sourceId }) =>
      sourceId === "warehouse" ? { accessToken: "source-token" } : null,
    plans: {
      list: async () => [saved],
      get: async (_tenant, _source, id) => (id === "p1" ? saved : null),
      create: async () => saved,
      update,
      remove: async () => {},
    },
  };
  const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(dryRun));
  const handler = createDashboardHandler({
    identity: createInsecureHeaderIdentityResolver(),
    tenants: createMemoryTenantAuthority(memberships),
    scopes: createMemoryScopeAuthority(memberships),
    store: createMemoryStore(),
    authoring,
    authoringOptions: { fetchImpl },
  });
  return { handler, update, fetchImpl };
}

const call = (
  user: string,
  path: string,
  init: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
) =>
  new Request(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: { "x-dev-user": user, ...init.headers },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

describe("query authoring routes", () => {
  it("lets an Editor read and run, but not save", async () => {
    const { handler } = setup();
    expect((await handler(call("editor", ""))).status).toBe(200);
    expect(
      (
        await handler(
          call("editor", "/warehouse/estimate", {
            method: "POST",
            body: draft,
          }),
        )
      ).status,
    ).toBe(200);
    const save = await handler(
      call("editor", "/warehouse/plans", { method: "POST", body: draft }),
    );
    expect(save.status).toBe(403);
  });

  it("refuses a Contributor everything", async () => {
    const { handler, fetchImpl } = setup();
    expect((await handler(call("contributor", ""))).status).toBe(403);
    expect(
      (
        await handler(
          call("contributor", "/warehouse/preview", {
            method: "POST",
            body: draft,
          }),
        )
      ).status,
    ).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("lets a Coordinator save, with the revision as ETag", async () => {
    const { handler } = setup();
    const created = await handler(
      call("coordinator", "/warehouse/plans", { method: "POST", body: draft }),
    );
    expect(created.status).toBe(201);
    expect(created.headers.get("etag")).toBe('"r1"');
  });

  it("replaces a saved query only with If-Match", async () => {
    const { handler, update } = setup();
    const missing = await handler(
      call("coordinator", "/warehouse/plans/p1", {
        method: "PUT",
        body: draft,
      }),
    );
    expect(missing.status).toBe(400);
    const replaced = await handler(
      call("coordinator", "/warehouse/plans/p1", {
        method: "PUT",
        body: draft,
        headers: { "if-match": '"r1"' },
      }),
    );
    expect(replaced.status).toBe(200);
    expect(replaced.headers.get("etag")).toBe('"r2"');
    expect(update.mock.lastCall?.[4]).toBe("r1");
  });

  it("answers 404 for an unknown source and when authoring is not provided", async () => {
    const { handler } = setup();
    expect((await handler(call("editor", "/elsewhere/plans"))).status).toBe(
      404,
    );
    const bare = createDashboardHandler({
      identity: createInsecureHeaderIdentityResolver(),
      tenants: createMemoryTenantAuthority({}),
      scopes: createMemoryScopeAuthority({}),
      store: createMemoryStore(),
    });
    expect((await bare(call("editor", ""))).status).toBe(404);
  });
});
