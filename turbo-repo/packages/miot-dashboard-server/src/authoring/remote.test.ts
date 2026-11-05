import { describe, expect, it, vi } from "vitest";
import { NO_CAPABILITIES } from "../seams/identity";
import { createRemoteQueryAuthoring } from "./remote";

const KEY = "k".repeat(40);
const request = {
  identity: {
    tenantId: "acme",
    userId: "ana",
    kind: "user" as const,
    capabilities: NO_CAPABILITIES,
  },
  scopeId: "ops",
  signal: new AbortController().signal,
};
const content = {
  name: "Daily",
  projectId: "analytics-prod",
  location: "US",
  sql: "SELECT 1",
  maximumBytesBilled: 1000,
  parameters: [{ name: "since", type: "DATE" as const }],
  columns: [{ name: "one", type: "INTEGER" }],
};

function setup(...responses: Response[]) {
  const fetchImpl = vi.fn<typeof fetch>();
  for (const response of responses) fetchImpl.mockResolvedValueOnce(response);
  const authoring = createRemoteQueryAuthoring({
    url: "https://modulith.internal/internal/dashboard-authoring/",
    proxyKey: KEY,
    fetchImpl,
  });
  const sent = (index: number) => ({
    url: String(fetchImpl.mock.calls[index]![0]),
    body: JSON.parse(String(fetchImpl.mock.calls[index]![1]!.body)),
    key: new Headers(fetchImpl.mock.calls[index]![1]!.headers).get(
      "x-miot-proxy-key",
    ),
  });
  return { authoring, sent };
}

describe("remote query authoring", () => {
  it("asks the host for sources and a token with the service key", async () => {
    const { authoring, sent } = setup(
      Response.json([
        {
          id: "c1",
          label: "Warehouse",
          kind: "BIGQUERY",
          defaultProjectId: "analytics-prod",
        },
      ]),
      Response.json({ accessToken: "token", expiresAt: null }),
    );
    expect(await authoring.listSources(request)).toHaveLength(1);
    expect(await authoring.accessFor({ ...request, sourceId: "c1" })).toEqual({
      accessToken: "token",
    });
    expect(sent(0)).toEqual({
      url: "https://modulith.internal/internal/dashboard-authoring/sources",
      body: { tenantId: "acme", userId: "ana" },
      key: KEY,
    });
    expect(sent(1).body).toEqual({
      tenantId: "acme",
      userId: "ana",
      sourceId: "c1",
    });
  });

  it("gives no token for a source the host does not know", async () => {
    const { authoring } = setup(
      Response.json({ error: "Query source not found" }, { status: 404 }),
    );
    expect(await authoring.accessFor({ ...request, sourceId: "x" })).toBeNull();
  });

  it("sends saved queries with null for absent fields and reads them back without nulls", async () => {
    const { authoring, sent } = setup(
      Response.json(
        {
          ...content,
          id: "p1",
          sourceId: "c1",
          description: null,
          parameters: [{ name: "since", type: "DATE", sample: null }],
          revision: "17",
          updatedAt: "2026-10-27T00:00:00Z",
          updatedBy: null,
        },
        { status: 201 },
      ),
    );
    const plan = await authoring.plans.create("acme", "c1", content, "ana");
    expect(plan).not.toHaveProperty("description");
    expect(plan.parameters).toEqual([{ name: "since", type: "DATE" }]);
    expect(sent(0).body).toEqual({
      tenantId: "acme",
      userId: "ana",
      sourceId: "c1",
      content: {
        ...content,
        description: null,
        parameters: [{ name: "since", type: "DATE", sample: null }],
        columns: [{ name: "one", type: "INTEGER", mode: "NULLABLE" }],
      },
    });
  });

  it("turns the host's refusals into the server's errors", async () => {
    const { authoring } = setup(
      Response.json(
        { error: "The query was saved by someone else" },
        { status: 409 },
      ),
      Response.json({ error: "Invalid query" }, { status: 400 }),
      Response.json({ error: "Query not found" }, { status: 404 }),
    );
    await expect(
      authoring.plans.update("acme", "c1", "p1", content, "1", "ana"),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      authoring.plans.update("acme", "c1", "p1", content, "1", "ana"),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Invalid query" });
    await expect(authoring.plans.get("acme", "c1", "p9")).resolves.toBeNull();
  });

  it("refuses an insecure endpoint or a short key", () => {
    expect(() =>
      createRemoteQueryAuthoring({ url: "http://modulith/x", proxyKey: KEY }),
    ).toThrow(TypeError);
    expect(() =>
      createRemoteQueryAuthoring({
        url: "https://modulith/x",
        proxyKey: "short",
      }),
    ).toThrow(TypeError);
  });
});

it.each(["broken-json", "wrong-plan", "wrong-list"])(
  "rejects a malformed successful host response: %s",
  async (kind) => {
    const response =
      kind === "broken-json"
        ? new Response("{")
        : Response.json(
            kind === "wrong-plan"
              ? { id: "incomplete" }
              : [{ id: "incomplete" }],
          );
    const { authoring } = setup(response);
    const pending =
      kind === "wrong-list"
        ? authoring.plans.list("demo", "source")
        : authoring.plans.get("demo", "source", "plan");
    await expect(pending).rejects.toMatchObject({ code: "UPSTREAM_ERROR" });
  },
);
