import { generateKeyPairSync } from "node:crypto";
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

  it("reads a BigQuery dataset with the header a host produced", async () => {
    const fetchImpl = answering(200);
    const result = await testDataSourceConnection(
      { ...pgrest, type: "BIGQUERY", target: "my-project.warehouse" },
      applyCredential({ kind: "BEARER", token: TOKEN }),
      { fetchImpl },
    );

    expect(result).toMatchObject({ testable: true, success: true });
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [URL, RequestInit];
    expect(url.href).toBe(
      "https://bigquery.googleapis.com/bigquery/v2/projects/my-project/datasets/warehouse",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );
  });

  it("exchanges a service account for a token, then reads the dataset", async () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const calls: string[] = [];
    const fetchImpl = vi.fn((input: URL | string) => {
      calls.push(String(input));
      return Promise.resolve(
        calls.length === 1
          ? Response.json({ access_token: "ya29.granted", expires_in: 3600 })
          : new Response("{}", { status: 200 }),
      );
    }) as unknown as typeof fetch;

    const result = await testDataSourceConnection(
      { ...pgrest, type: "BIGQUERY", target: "warehouse" },
      applyCredential({
        kind: "SERVICE_ACCOUNT",
        projectId: "my-project",
        clientEmail: "reader@my-project.iam.gserviceaccount.com",
        privateKey,
      }),
      { fetchImpl, googleTokenUrl: "https://token.test/token" },
    );

    expect(result).toMatchObject({ testable: true, success: true });
    expect(calls).toEqual([
      "https://token.test/token",
      "https://bigquery.googleapis.com/bigquery/v2/projects/my-project/datasets/warehouse",
    ]);
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[1] as [URL, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer ya29.granted",
    );
  });

  it("names a dataset the credential cannot see", async () => {
    const result = await testDataSourceConnection(
      { ...pgrest, type: "BIGQUERY", target: "my-project.warehouse" },
      applyCredential({ kind: "BEARER", token: TOKEN }),
      { fetchImpl: answering(404) },
    );

    expect(result).toMatchObject({ success: false, status: 404 });
    expect(result.message).toMatch(/does not exist/);
  });

  it("asks for the project when neither the target nor the credential names it", async () => {
    const fetchImpl = answering(200);
    const result = await testDataSourceConnection(
      { ...pgrest, type: "BIGQUERY", target: "warehouse" },
      applyCredential({ kind: "BEARER", token: TOKEN }),
      { fetchImpl },
    );

    expect(result).toMatchObject({ testable: true, success: false });
    expect(result.message).toMatch(/name the project/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never repeats what the fetch layer says, which can quote the credential", async () => {
    // `fetch` puts an invalid header value in its own message verbatim, and
    // that value is the credential.
    const throwing = vi.fn(() =>
      Promise.reject(
        new TypeError(
          `Headers.append: "Bearer ${TOKEN}" is an invalid header value.`,
        ),
      ),
    ) as unknown as typeof fetch;

    const result = await testDataSourceConnection(
      pgrest,
      applyCredential({ kind: "BEARER", token: TOKEN }),
      { fetchImpl: throwing },
    );

    expect(result).toMatchObject({
      testable: true,
      success: false,
      message: "Could not reach the target",
    });
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });

  it("names a timeout, which says something different to an operator", async () => {
    const timedOut = vi.fn(() => {
      const error = new Error("The operation was aborted due to timeout");
      error.name = "TimeoutError";
      return Promise.reject(error);
    }) as unknown as typeof fetch;

    const result = await testDataSourceConnection(pgrest, null, {
      fetchImpl: timedOut,
    });
    expect(result.message).toBe("The target did not answer in time");
  });

  it("releases the body it never reads", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => {
        controller.enqueue(new TextEncoder().encode("[{}]"));
      },
      cancel: () => {
        cancelled = true;
      },
    });
    const streaming = vi.fn(() =>
      Promise.resolve(new Response(body, { status: 200 })),
    ) as unknown as typeof fetch;

    await testDataSourceConnection(pgrest, null, { fetchImpl: streaming });
    expect(cancelled).toBe(true);
  });

  it("never repeats the target's body, which can quote the credential", async () => {
    const result = await testDataSourceConnection(
      pgrest,
      applyCredential({ kind: "BEARER", token: TOKEN }),
      {
        // Some targets quote the request back in an error.
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
    expect(text).not.toContain(TOKEN);
    // Testing stores nothing.
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

  it("refuses a body that names a credential twice", async () => {
    const { handler } = build(answering(200));
    const response = await post(handler, `${BASE}/test`, "alice", {
      datasource: { ...pgrest, credentialRef: "fleet" },
      credential: { kind: "BEARER", token: TOKEN },
    });
    expect(response.status).toBe(400);
  });

  it("tests unsaved values with the credential the body names", async () => {
    const fetchImpl = answering(200);
    const { handler, credentials } = build(fetchImpl);
    await credentials.putCredential("acme", "fleet", {
      kind: "BEARER",
      token: TOKEN,
    });

    const response = await post(handler, `${BASE}/test`, "alice", {
      datasource: { ...pgrest, credentialRef: "fleet" },
    });

    expect(response.status).toBe(200);
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [URL, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );
  });

  it("fails a datasource whose credential resolves to nothing", async () => {
    const fetchImpl = answering(200);
    const { handler, dataSources } = build(fetchImpl);
    await dataSources.put("acme", "ds1", { ...pgrest, credentialRef: "gone" });

    const response = await post(handler, `${BASE}/ds1/test`, "alice");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: {
        testable: true,
        success: false,
        message: 'The credential "gone" could not be resolved',
      },
    });
    // Probing it anonymously would answer about a datasource nobody has.
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("resolves the credential a BigQuery datasource names", async () => {
    const fetchImpl = answering(200);
    const dataSources = createMemoryDataSourceStore();
    const credentials = createMemoryCredentialsStore();
    const resolve = vi.fn(() =>
      Promise.resolve(applyCredential({ kind: "BEARER", token: TOKEN })),
    );
    const handler = createDashboardHandler({
      identity: createInsecureHeaderIdentityResolver(),
      tenants: createMemoryTenantAuthority(MEMBERSHIPS),
      scopes: createMemoryScopeAuthority(MEMBERSHIPS),
      store: createMemoryStore(),
      dataSources,
      credentials: { ...credentials, resolve } as typeof credentials,
      testConnection: { fetchImpl },
    });
    await dataSources.put("acme", "bq", {
      name: "Warehouse",
      type: "BIGQUERY",
      isActive: true,
      target: "project.dataset",
      credentialRef: "gcp",
    });

    const response = await post(handler, `${BASE}/bq/test`, "alice");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { testable: true, success: true },
    });
    expect(resolve).toHaveBeenCalledWith("acme", "gcp");
  });

  it("reserves `test`, so it never addresses a datasource", async () => {
    const { handler, dataSources } = build(answering(200));
    // A datasource whose id is "test" is unreachable by id. That is the
    // cost of reserving the word, and the contract states it.
    await dataSources.put("acme", "test", pgrest);

    const response = await post(handler, `${BASE}/test`, "alice", {
      datasource: pgrest,
    });
    // Answered by the test route. POST to a datasource id is not allowed.
    expect(response.status).toBe(200);
  });

  it("reserves it after decoding, so `%74est` is not a way in", async () => {
    const { handler, dataSources } = build(answering(200));

    // As an id it is no route at all, so nothing can be stored under it.
    const stored = await handler(
      new Request(`http://test.local${BASE}/%74est`, {
        method: "PUT",
        headers: { "x-dev-user": "alice", "content-type": "application/json" },
        body: JSON.stringify(pgrest),
      }),
    );
    expect(stored.status).toBe(404);
    await expect(dataSources.list("acme")).resolves.toEqual([]);

    // And the encoded spelling reaches the same test route as the plain one.
    const tested = await post(handler, `${BASE}/%74est`, "alice", {
      datasource: pgrest,
    });
    expect(tested.status).toBe(200);

    // A stored datasource called `test` stays unreachable both ways.
    expect((await post(handler, `${BASE}/test/test`, "alice")).status).toBe(
      404,
    );
  });
});
