/**
 * The datasource and credential routes.
 *
 * The last block walks every response these routes can produce and fails on
 * a property name that can carry a secret. Its case list is a total
 * `Record<RouteName, ...>` and a total `Record<CredentialKind, ...>`, so a
 * route or a credential kind added later stops compiling until someone says
 * what it answers.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { createDashboardHandler } from "./handler";
import { SECRET_PROPERTY_NAMES } from "../seams/credentials";
import type {
  CredentialInput,
  CredentialKind,
  CredentialsStore,
} from "../seams/credentials";
import type { DataSourceStore } from "../seams/datasources";
import type { RouteName } from "./routes";
import {
  createInsecureHeaderIdentityResolver,
  createMemoryCredentialsStore,
  createMemoryCredentialsVault,
  createMemoryDataSourceStore,
  createMemoryScopeAuthority,
  createMemoryTenantAuthority,
  createMemoryStore,
  type Memberships,
} from "../testing";

const MEMBERSHIPS: Memberships = {
  acme: { ops: { alice: "Coordinator", con: "Consumer" } },
  globex: { ops: { bob: "Coordinator" } },
};

const TOKEN = "pgrst_live_0123456789abcdef";
const HEADER_KEY = "hdr_live_0123456789abcdef";
const QUERY_KEY = "qry_live_0123456789abcdef";
const PASSWORD = "s3cret-and-long";
const PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----0123456789abcdef";

const pgrest = {
  name: "Fleet telemetry",
  type: "POSTGREST",
  isActive: true,
  target: "https://pgrest.example.com",
  credentialRef: "fleet",
};

let dataSources: DataSourceStore;
let credentials: CredentialsStore;
let handler: ReturnType<typeof createDashboardHandler>;

/** Answers the probe without reaching the network. */
const fetchImpl = (() =>
  Promise.resolve(
    new Response("[]", { status: 200 }),
  )) as unknown as typeof fetch;

function build(overrides: Record<string, unknown> = {}) {
  return createDashboardHandler({
    identity: createInsecureHeaderIdentityResolver(),
    tenants: createMemoryTenantAuthority(MEMBERSHIPS),
    scopes: createMemoryScopeAuthority(MEMBERSHIPS),
    store: createMemoryStore(),
    dataSources,
    credentials,
    testConnection: { fetchImpl },
    ...overrides,
  });
}

beforeEach(() => {
  dataSources = createMemoryDataSourceStore();
  credentials = createMemoryCredentialsStore();
  handler = build();
});

const call = (
  path: string,
  user?: string,
  method = "GET",
  body?: unknown,
): Promise<Response> =>
  handler(
    new Request(`http://test.local${path}`, {
      method,
      headers: {
        ...(user === undefined ? {} : { "x-dev-user": user }),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );

const DS = "/tenants/acme/scopes/ops/datasources";
const CRED = "/tenants/acme/scopes/ops/credentials";

describe("datasource routes", () => {
  it("refuse an unauthenticated caller", async () => {
    expect((await call(DS)).status).toBe(401);
  });

  it("let a Consumer read and refuse them a write", async () => {
    expect((await call(DS, "con")).status).toBe(200);
    expect((await call(DS, "con", "POST", pgrest)).status).toBe(403);
  });

  it("create with a server-assigned id", async () => {
    const created = await call(DS, "alice", "POST", pgrest);
    expect(created.status).toBe(201);

    const { data } = (await created.json()) as { data: { id: string } };
    expect(data.id).toMatch(/^[0-9a-f-]{36}$/);

    const listed = await (await call(DS, "alice")).json();
    expect((listed as { data: unknown[] }).data).toHaveLength(1);
  });

  it("replace and delete by id", async () => {
    const { data } = (await (
      await call(DS, "alice", "POST", pgrest)
    ).json()) as { data: { id: string } };

    const replaced = await call(`${DS}/${data.id}`, "alice", "PUT", {
      ...pgrest,
      name: "Renamed",
    });
    expect(replaced.status).toBe(200);

    expect((await call(`${DS}/${data.id}`, "alice", "DELETE")).status).toBe(
      204,
    );
    expect((await call(`${DS}/${data.id}`, "alice")).status).toBe(404);
  });

  it("keep tenants apart", async () => {
    await call(DS, "alice", "POST", pgrest);

    const other = await call("/tenants/globex/scopes/ops/datasources", "bob");
    expect(((await other.json()) as { data: unknown[] }).data).toEqual([]);
  });

  it("refuse a target that is not https", async () => {
    const response = await call(DS, "alice", "POST", {
      ...pgrest,
      target: "http://pgrest.example.com",
    });
    expect(response.status).toBe(400);
  });

  it("refuse a target that carries a password", async () => {
    const response = await call(DS, "alice", "POST", {
      ...pgrest,
      target: "https://ana:s3cret-and-long@pgrest.example.com",
    });
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("s3cret-and-long");
  });

  it("refuse an unknown field rather than dropping it", async () => {
    const response = await call(DS, "alice", "POST", {
      ...pgrest,
      tokne: "typo",
    });
    expect(response.status).toBe(400);
  });

  it("answer 404 where no store is configured", async () => {
    const bare = build({ dataSources: undefined });
    const response = await bare(
      new Request(`http://test.local${DS}`, {
        headers: { "x-dev-user": "alice" },
      }),
    );
    expect(response.status).toBe(404);
  });
});

describe("credential routes", () => {
  it("are absent when the vault cannot be written to", async () => {
    const readOnly = build({ credentials: createMemoryCredentialsVault() });
    const response = await readOnly(
      new Request(`http://test.local${CRED}`, {
        headers: { "x-dev-user": "alice" },
      }),
    );
    // 404, the same as no vault at all. The status code must not say which.
    expect(response.status).toBe(404);
  });

  it("store a credential and answer with a summary, never the secret", async () => {
    const response = await call(`${CRED}/fleet`, "alice", "PUT", {
      kind: "BEARER",
      token: TOKEN,
    });

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain(TOKEN);
    expect(JSON.parse(text)).toEqual({
      data: {
        ref: "fleet",
        kind: "BEARER",
        preview: "…cdef",
        updatedAt: expect.any(String),
      },
    });
  });

  it("refuse a write from a Consumer", async () => {
    const response = await call(`${CRED}/fleet`, "con", "PUT", {
      kind: "BEARER",
      token: TOKEN,
    });
    expect(response.status).toBe(403);
  });

  it("refuse a kind that is only an inherited property", async () => {
    // `"constructor" in CREDENTIAL_FIELDS` is true, and the lookup then
    // answers with a function instead of a field list.
    for (const kind of ["constructor", "__proto__", "toString"]) {
      const response = await call(`${CRED}/fleet`, "alice", "PUT", { kind });
      expect(response.status).toBe(400);
    }
  });

  it("refuse a credential body with an unknown field", async () => {
    const response = await call(`${CRED}/fleet`, "alice", "PUT", {
      kind: "BEARER",
      token: TOKEN,
      extra: "x",
    });
    expect(response.status).toBe(400);
  });

  it("delete one", async () => {
    await call(`${CRED}/fleet`, "alice", "PUT", {
      kind: "BEARER",
      token: TOKEN,
    });
    expect((await call(`${CRED}/fleet`, "alice", "DELETE")).status).toBe(204);
    expect((await call(`${CRED}/fleet`, "alice")).status).toBe(404);
  });
});

describe("the serialization gate", () => {
  /** Every key in a JSON value, at any depth, including inside arrays. */
  function keysOf(value: unknown, found: string[] = []): string[] {
    if (Array.isArray(value)) {
      for (const item of value) keysOf(item, found);
      return found;
    }
    if (typeof value === "object" && value !== null) {
      for (const [key, nested] of Object.entries(value)) {
        found.push(key);
        keysOf(nested, found);
      }
    }
    return found;
  }

  interface Call {
    method: string;
    path: string;
    user?: string;
    body?: unknown;
  }

  /**
   * One write per credential kind, so every secret this server accepts is
   * sent through the routes below and looked for in what comes back.
   */
  const WRITES: Record<CredentialKind, CredentialInput> = {
    NONE: { kind: "NONE" },
    BEARER: { kind: "BEARER", token: TOKEN },
    API_KEY_HEADER: {
      kind: "API_KEY_HEADER",
      header: "x-api-key",
      value: HEADER_KEY,
    },
    API_KEY_QUERY: { kind: "API_KEY_QUERY", param: "key", value: QUERY_KEY },
    BASIC: { kind: "BASIC", username: "ana", password: PASSWORD },
    SERVICE_ACCOUNT: {
      kind: "SERVICE_ACCOUNT",
      projectId: "p",
      clientEmail: "svc@example.iam.gserviceaccount.com",
      privateKey: PRIVATE_KEY,
    },
  };

  /**
   * The dashboard routes answer with caller-supplied config, which may hold
   * a property called `value` of its own. `SECRET_PROPERTY_NAMES` says so.
   */
  const CONFIG_NOT_CREDENTIALS = "answers caller-supplied config" as const;

  /**
   * Every route name, mapped to the calls this gate walks. Total over
   * `RouteName`: a route added to the router stops this file compiling until
   * someone lists its calls, or marks it as answering no credential.
   */
  function callsFor(id: string): Record<RouteName, readonly Call[] | string> {
    return {
      dashboards: CONFIG_NOT_CREDENTIALS,
      dashboard: CONFIG_NOT_CREDENTIALS,
      capabilities: CONFIG_NOT_CREDENTIALS,
      permissions: CONFIG_NOT_CREDENTIALS,
      datasources: [
        { method: "GET", path: DS, user: "alice" },
        { method: "POST", path: DS, user: "alice", body: pgrest },
        // Failures too: an error envelope is the easier place to leak.
        { method: "GET", path: DS },
        { method: "POST", path: DS, user: "con", body: pgrest },
        {
          method: "POST",
          path: DS,
          user: "alice",
          body: { ...pgrest, target: "not-a-url" },
        },
        {
          method: "POST",
          path: DS,
          user: "alice",
          body: {
            ...pgrest,
            target: `https://ana:${PASSWORD}@pgrest.example.com`,
          },
        },
      ],
      datasource: [
        { method: "GET", path: `${DS}/${id}`, user: "alice" },
        {
          method: "PUT",
          path: `${DS}/${id}`,
          user: "alice",
          body: { ...pgrest, name: "Renamed" },
        },
        { method: "GET", path: `${DS}/missing`, user: "alice" },
        { method: "DELETE", path: `${DS}/${id}`, user: "alice" },
      ],
      datasourcesTest: [
        {
          method: "POST",
          path: `${DS}/test`,
          user: "alice",
          body: {
            datasource: pgrest,
            credential: { kind: "BEARER", token: TOKEN },
          },
        },
        // The body carried a secret in; the answer must not carry it back.
        {
          method: "POST",
          path: `${DS}/test`,
          user: "alice",
          body: { datasource: pgrest, credential: { kind: "NOPE" } },
        },
      ],
      datasourceTest: [
        { method: "POST", path: `${DS}/${id}/test`, user: "alice" },
        { method: "POST", path: `${DS}/missing/test`, user: "alice" },
      ],
      credentials: [{ method: "GET", path: CRED, user: "alice" }],
      credential: [
        ...Object.entries(WRITES).map(([kind, body]) => ({
          method: "PUT",
          path: `${CRED}/${kind.toLowerCase()}`,
          user: "alice",
          body,
        })),
        { method: "GET", path: `${CRED}/bearer`, user: "alice" },
        { method: "GET", path: `${CRED}/missing`, user: "alice" },
        {
          method: "PUT",
          path: `${CRED}/bearer`,
          user: "alice",
          body: { kind: "NOPE" },
        },
        { method: "DELETE", path: `${CRED}/bearer`, user: "alice" },
      ],
    };
  }

  /** Every response those calls produce, in the order they are listed. */
  async function everyResponse(): Promise<Response[]> {
    const created = await call(DS, "alice", "POST", pgrest);
    const { data } = (await created.clone().json()) as {
      data: { id: string };
    };

    const responses = [created];
    for (const calls of Object.values(callsFor(data.id))) {
      if (typeof calls === "string") continue;
      for (const one of calls) {
        responses.push(await call(one.path, one.user, one.method, one.body));
      }
    }
    return responses;
  }

  it("never serializes a property that can carry a secret", async () => {
    const offenders: string[] = [];

    for (const response of await everyResponse()) {
      const text = await response.text();
      if (text.length === 0) continue;
      const body: unknown = JSON.parse(text);
      for (const key of keysOf(body)) {
        if (SECRET_PROPERTY_NAMES.includes(key)) offenders.push(key);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("never echoes a secret value, whatever it is called", async () => {
    const secrets = [TOKEN, HEADER_KEY, QUERY_KEY, PASSWORD, PRIVATE_KEY];

    for (const response of await everyResponse()) {
      const text = await response.text();
      for (const secret of secrets) {
        expect(text).not.toContain(secret);
      }
    }
  });
});
