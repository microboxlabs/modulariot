import { generateKeyPairSync } from "node:crypto";
import type { QueryPlan } from "@microboxlabs/miot-dashboard-contract/authoring";
import { describe, expect, it, vi } from "vitest";
import { NO_CAPABILITIES } from "../seams/identity";
import type { QueryPlanStore } from "../seams/authoring";
import {
  createMemoryCredentialsStore,
  createMemoryDataSourceStore,
} from "../testing";
import { createLocalQueryAuthoring, createLocalQueryOperations } from "./local";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const identity = {
  tenantId: "acme",
  userId: "ana",
  kind: "user" as const,
  capabilities: NO_CAPABILITIES,
};
const request = {
  identity,
  scopeId: "ops",
  signal: new AbortController().signal,
};

const plan: QueryPlan = {
  id: "daily",
  sourceId: "warehouse",
  name: "Daily trips",
  projectId: "analytics-prod",
  location: "US",
  sql: "SELECT @since AS since",
  maximumBytesBilled: 1000,
  parameters: [{ name: "since", type: "DATE" }],
  columns: [{ name: "since", type: "DATE" }],
  revision: "r1",
  updatedAt: "2026-10-27T00:00:00Z",
};

const plans: QueryPlanStore = {
  list: async (_tenant, source) => (source === "warehouse" ? [plan] : []),
  get: async (tenant, source, id) =>
    tenant === "acme" && source === "warehouse" && id === "daily" ? plan : null,
  create: async () => plan,
  update: async () => plan,
  remove: async () => {},
};

function setup() {
  const dataSources = createMemoryDataSourceStore({
    acme: {
      warehouse: {
        name: "Warehouse",
        type: "BIGQUERY",
        isActive: true,
        target: "analytics-prod",
        credentialRef: "warehouse-sa",
      },
      paused: {
        name: "Paused",
        type: "BIGQUERY",
        isActive: false,
        target: "analytics-prod",
        credentialRef: "warehouse-sa",
      },
      api: {
        name: "API",
        type: "POSTGREST",
        isActive: true,
        target: "https://api.example.com",
      },
    },
  });
  const credentials = createMemoryCredentialsStore({
    acme: {
      "warehouse-sa": {
        kind: "SERVICE_ACCOUNT",
        projectId: "analytics-prod",
        clientEmail: "reader@analytics-prod.iam.gserviceaccount.com",
        privateKey,
      },
    },
  });
  const fetchImpl = vi.fn<typeof fetch>(async () =>
    Response.json({ access_token: "google-token", expires_in: 3600 }),
  );
  const authoring = createLocalQueryAuthoring({
    dataSources,
    credentials,
    plans,
    fetchImpl,
  });
  return { authoring, fetchImpl };
}

describe("local query authoring", () => {
  it("lists active BigQuery datasources with a service account", async () => {
    const { authoring } = setup();
    expect(await authoring.listSources(request)).toEqual([
      {
        id: "warehouse",
        label: "Warehouse",
        kind: "BIGQUERY",
        defaultProjectId: "analytics-prod",
      },
    ]);
  });

  it("hands out a token for the full BigQuery scope, and reuses it", async () => {
    const { authoring, fetchImpl } = setup();
    const first = await authoring.accessFor({
      ...request,
      sourceId: "warehouse",
    });
    expect(first?.accessToken).toBe("google-token");
    const assertion = new URLSearchParams(
      String(fetchImpl.mock.calls[0]![1]!.body),
    ).get("assertion");
    const claims = JSON.parse(
      Buffer.from(assertion!.split(".")[1]!, "base64url").toString(),
    );
    expect(claims.scope).toBe("https://www.googleapis.com/auth/bigquery");
    await authoring.accessFor({ ...request, sourceId: "warehouse" });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("gives no token for an inactive, foreign or non-BigQuery source", async () => {
    const { authoring } = setup();
    for (const sourceId of ["paused", "api", "missing"])
      expect(await authoring.accessFor({ ...request, sourceId })).toBeNull();
    expect(
      await authoring.accessFor({
        ...request,
        identity: { ...identity, tenantId: "globex" },
        sourceId: "warehouse",
      }),
    ).toBeNull();
  });
});

describe("local query operations", () => {
  it("lists saved queries as operations of their source", async () => {
    const { authoring } = setup();
    const operations = createLocalQueryOperations({ authoring });
    expect(
      await operations.queryCatalog.list({
        identity,
        ref: { tenantId: "acme", scopeId: "ops", slug: "board" },
        signal: request.signal,
      }),
    ).toEqual([
      {
        id: "warehouse",
        label: "Warehouse",
        operations: [{ id: "daily", label: "Daily trips", schema: ["since"] }],
      },
    ]);
  });

  it("runs a saved query, binding a parameter the dashboard did not send as null", async () => {
    const { authoring } = setup();
    const bigQuery = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          statistics: {
            totalBytesProcessed: "10",
            query: { statementType: "SELECT" },
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({}))
      .mockResolvedValueOnce(
        Response.json({
          jobComplete: true,
          totalRows: "1",
          schema: { fields: [{ name: "since", type: "DATE" }] },
          rows: [{ f: [{ v: null }] }],
        }),
      );
    const operations = createLocalQueryOperations({
      authoring,
      fetchImpl: bigQuery,
    });
    const run = (parameters: Record<string, string>) =>
      operations.execute({
        identity,
        ref: { tenantId: "acme", scopeId: "ops", slug: "board" },
        connectionId: "warehouse",
        operationId: "daily",
        parameters,
        signal: request.signal,
        limits: { maxRows: 10, maxBytes: 65_536 },
      });
    expect(await run({})).toEqual({ rows: [{ since: null }] });
    const job = JSON.parse(String(bigQuery.mock.calls[0]![1]!.body));
    expect(job.configuration.query.queryParameters[0].parameterValue).toEqual({
      value: null,
    });
    await expect(run({ other: "x" })).rejects.toMatchObject({
      code: "UPSTREAM_ERROR",
    });
  });
});
