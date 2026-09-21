import { describe, expect, it, vi } from "vitest";
import { createDashboardHandler } from "./handler";
import { testDataSourceConnection } from "./test-connection";
import { applyCredential } from "../seams/credentials";
import type { DataSourceInput } from "../seams/datasources";
import {
  createInsecureHeaderIdentityResolver,
  createMemoryCredentialsStore,
  createMemoryDataSourceStore,
  createMemoryScopeAuthority,
  createMemoryTenantAuthority,
  createMemoryStore,
  type Memberships,
} from "../testing";

const MEMBERSHIPS: Memberships = {
  acme: { ops: { alice: "Coordinator", con: "Consumer" } },
};

const TOKEN = "pgrst_live_0123456789abcdef";

const pgrest: DataSourceInput = {
  name: "Fleet",
  type: "POSTGREST",
  isActive: true,
  target: "https://pgrest.example.com",
};

const answering = (status: number, body = "{}") =>
  vi.fn(() =>
    Promise.resolve(new Response(body, { status })),
  ) as unknown as typeof fetch;

describe("probing a datasource", () => {
  it("reports a target that answers", async () => {
    const result = await testDataSourceConnection(pgrest, null, {
      fetchImpl: answering(200),
    });

    expect(result).toMatchObject({
      testable: true,
      success: true,
      status: 200,
    });
  });

  it("sends the credential as auth on the probe", async () => {
    const fetchImpl = answering(200);
    await testDataSourceConnection(
      pgrest,
      applyCredential({ kind: "BEARER", token: TOKEN }),
      { fetchImpl },
    );

    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [URL, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );
  });

  it("puts a query credential in the URL, not a header", async () => {
    const fetchImpl = answering(200);
    await testDataSourceConnection(
      pgrest,
      applyCredential({ kind: "API_KEY_QUERY", param: "apikey", value: TOKEN }),
      { fetchImpl },
    );

    const [url] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [URL];
    expect(url.searchParams.get("apikey")).toBe(TOKEN);
  });

  it("calls a refusal a failed test, not a failed request", async () => {
    const result = await testDataSourceConnection(
      pgrest,
      applyCredential({ kind: "BEARER", token: TOKEN }),
      { fetchImpl: answering(401) },
    );

    // The rule the whole package follows: a datasource rejecting our
    // credential is not the caller's fault.
    expect(result).toMatchObject({
      testable: true,
      success: false,
      status: 401,
      message: "The target refused the credential",
    });
  });

  it("says so when the target wants a credential and none is set", async () => {
    const result = await testDataSourceConnection(
      pgrest,
      { kind: "NONE" },
      {
        fetchImpl: answering(403),
      },
    );

    expect(result.message).toMatch(/requires a credential and none/);
  });

  it("refuses to follow a redirect", async () => {
    const result = await testDataSourceConnection(pgrest, null, {
      fetchImpl: answering(302),
    });

    expect(result).toMatchObject({ success: false, status: 302 });
    expect(result.message).toMatch(/redirect/);
  });

  it("reports a target that cannot be reached", async () => {
    const fetchImpl = vi.fn(() =>
      Promise.reject(new Error("getaddrinfo ENOTFOUND pgrest.example.com")),
    ) as unknown as typeof fetch;

    const result = await testDataSourceConnection(pgrest, null, { fetchImpl });
    expect(result).toMatchObject({ testable: true, success: false });
    expect(result.message).toMatch(/Could not reach/);
  });

  it("reports BigQuery as untestable rather than failing it", async () => {
    const result = await testDataSourceConnection(
      { ...pgrest, type: "BIGQUERY", target: "project.dataset" },
      null,
      { fetchImpl: answering(200) },
    );

    expect(result).toMatchObject({ testable: false, success: false });
  });

  it("never repeats the target's body, which can quote the credential", async () => {
    const result = await testDataSourceConnection(
      pgrest,
      applyCredential({ kind: "BEARER", token: TOKEN }),
      {
        // A target that echoes what it was sent. Some do, in an error.
        fetchImpl: answering(
          400,
          JSON.stringify({ error: `bad request: Bearer ${TOKEN}` }),
        ),
      },
    );

    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });
});

describe("the test routes", () => {
  function build(fetchImpl: typeof fetch) {
    const dataSources = createMemoryDataSourceStore();
    const credentials = createMemoryCredentialsStore();
    const handler = createDashboardHandler({
      identity: createInsecureHeaderIdentityResolver(),
      tenants: createMemoryTenantAuthority(MEMBERSHIPS),
      scopes: createMemoryScopeAuthority(MEMBERSHIPS),
      store: createMemoryStore(),
      dataSources,
      credentials,
      testConnection: { fetchImpl },
    });
    return { handler, dataSources, credentials };
  }

  const post = (
    handler: ReturnType<typeof createDashboardHandler>,
    path: string,
    user: string,
    body?: unknown,
  ) =>
    handler(
      new Request(`http://test.local${path}`, {
        method: "POST",
        headers: {
          "x-dev-user": user,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );

  const BASE = "/tenants/acme/scopes/ops/datasources";

  it("tests values that were never saved", async () => {
    const { handler, dataSources } = build(answering(200));

    const response = await post(handler, `${BASE}/test`, "alice", {
      datasource: pgrest,
      credential: { kind: "BEARER", token: TOKEN },
    });

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      data: {
        testable: true,
        success: true,
        status: 200,
        testedAt: expect.any(String),
        message: "The target answered",
      },
    });
    // The secret came in on this request and must not go back out.
    expect(text).not.toContain(TOKEN);
    // Nor be stored as a side effect of testing.
    await expect(dataSources.list("acme")).resolves.toEqual([]);
  });

  it("tests a stored datasource with the credential it names", async () => {
    const fetchImpl = answering(200);
    const { handler, dataSources, credentials } = build(fetchImpl);

    await credentials.putCredential("acme", "fleet", {
      kind: "BEARER",
      token: TOKEN,
    });
    await dataSources.put("acme", "ds1", {
      ...pgrest,
      credentialRef: "fleet",
    });

    const response = await post(handler, `${BASE}/ds1/test`, "alice");
    expect(response.status).toBe(200);

    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [URL, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );
    expect(await response.text()).not.toContain(TOKEN);
  });

  it("404s a datasource that is not there", async () => {
    const { handler } = build(answering(200));
    const response = await post(handler, `${BASE}/missing/test`, "alice");
    expect(response.status).toBe(404);
  });

  it("refuses a Consumer, who may not change a datasource", async () => {
    const { handler } = build(answering(200));
    const response = await post(handler, `${BASE}/test`, "con", {
      datasource: pgrest,
    });
    expect(response.status).toBe(403);
  });

  it("refuses an unsaved target that is not https", async () => {
    const { handler } = build(answering(200));
    const response = await post(handler, `${BASE}/test`, "alice", {
      datasource: { ...pgrest, target: "http://pgrest.example.com" },
    });
    expect(response.status).toBe(400);
  });

  it("reserves `test`, so it never addresses a datasource", async () => {
    const { handler, dataSources } = build(answering(200));
    // A datasource really called "test" is unreachable by id, which is the
    // cost of the reservation and is stated in the contract.
    await dataSources.put("acme", "test", pgrest);

    const response = await post(handler, `${BASE}/test`, "alice", {
      datasource: pgrest,
    });
    // The test route, not the datasource: a POST to the datasource route is
    // not allowed at all.
    expect(response.status).toBe(200);
  });
});
