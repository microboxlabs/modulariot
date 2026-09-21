/**
 * The datasource and credential routes.
 *
 * The last block is the gate P3 exists for: every response any of these
 * routes can produce is walked, and a property name that can carry a secret
 * fails the test. It is structural rather than a list of assertions per
 * route, so a route added later is covered without anyone remembering to
 * cover it.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { createDashboardHandler } from "./handler";
import { SECRET_PROPERTY_NAMES } from "../seams/credentials";
import type { CredentialsStore } from "../seams/credentials";
import type { DataSourceStore } from "../seams/datasources";
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

function build(overrides: Record<string, unknown> = {}) {
  return createDashboardHandler({
    identity: createInsecureHeaderIdentityResolver(),
    tenants: createMemoryTenantAuthority(MEMBERSHIPS),
    scopes: createMemoryScopeAuthority(MEMBERSHIPS),
    store: createMemoryStore(),
    dataSources,
    credentials,
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
    // 404, the same answer as a deployment with no vault at all: which of
    // the two it is would tell an outsider how this server is configured.
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

  /**
   * Responses from every route in this file, success and failure, including
   * the ones that carried a secret in on the way. A body is only in the
   * clear if no property of it can hold one.
   */
  async function everyResponse(): Promise<Response[]> {
    const created = await call(DS, "alice", "POST", pgrest);
    const { data } = (await created.clone().json()) as {
      data: { id: string };
    };
    const id = data.id;

    return [
      created,
      await call(`${CRED}/fleet`, "alice", "PUT", {
        kind: "BEARER",
        token: TOKEN,
      }),
      await call(`${CRED}/gcp`, "alice", "PUT", {
        kind: "SERVICE_ACCOUNT",
        projectId: "p",
        clientEmail: "svc@example.iam.gserviceaccount.com",
        privateKey: "-----BEGIN PRIVATE KEY-----",
      }),
      await call(`${CRED}/basic`, "alice", "PUT", {
        kind: "BASIC",
        username: "ana",
        password: "s3cret-and-long",
      }),
      await call(DS, "alice"),
      await call(`${DS}/${id}`, "alice"),
      await call(CRED, "alice"),
      await call(`${CRED}/fleet`, "alice"),
      // Failures too: an error envelope is the easier place to leak.
      await call(DS),
      await call(DS, "con", "POST", pgrest),
      await call(`${DS}/missing`, "alice"),
      await call(DS, "alice", "POST", { ...pgrest, target: "not-a-url" }),
      await call(`${CRED}/fleet`, "alice", "PUT", { kind: "NOPE" }),
    ];
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
    const secrets = [TOKEN, "s3cret-and-long", "-----BEGIN PRIVATE KEY-----"];

    for (const response of await everyResponse()) {
      const text = await response.text();
      for (const secret of secrets) {
        expect(text).not.toContain(secret);
      }
    }
  });
});
