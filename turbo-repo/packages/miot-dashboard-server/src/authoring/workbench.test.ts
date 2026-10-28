import type {
  QueryPlan,
  QueryPlanDraft,
} from "@microboxlabs/miot-dashboard-contract/authoring";
import { describe, expect, it, vi } from "vitest";
import { NO_CAPABILITIES } from "../seams/identity";
import type { QueryAuthoring, QueryPlanContent } from "../seams/authoring";
import { createQueryWorkbench } from "./workbench";

const request = () => ({
  identity: {
    tenantId: "acme",
    userId: "ana",
    kind: "user" as const,
    capabilities: NO_CAPABILITIES,
  },
  scopeId: "ops",
  signal: new AbortController().signal,
});

const draft: QueryPlanDraft = {
  name: "Daily trips",
  projectId: "analytics-prod",
  location: "US",
  sql: "SELECT day, trips FROM `fleet.daily` WHERE day >= @since",
  maximumBytesBilled: 100_000_000,
  parameters: [{ name: "since", type: "DATE", sample: "2026-10-01" }],
};

const dryRun = (statementType = "SELECT") => ({
  statistics: {
    totalBytesProcessed: "4200",
    query: {
      statementType,
      schema: {
        fields: [
          { name: "day", type: "DATE", mode: "NULLABLE" },
          { name: "trips", type: "INTEGER" },
        ],
      },
    },
  },
});

function authoring(token: string | null = "source-token") {
  const saved: QueryPlanContent[] = [];
  const plan = (content: QueryPlanContent): QueryPlan => ({
    ...content,
    id: "p1",
    sourceId: "warehouse",
    revision: "r1",
    updatedAt: "2026-10-27T00:00:00Z",
  });
  const value: QueryAuthoring = {
    listSources: async () => [
      {
        id: "warehouse",
        label: "Warehouse",
        kind: "BIGQUERY",
        defaultProjectId: "analytics-prod",
      },
    ],
    accessFor: vi.fn(async ({ sourceId }) =>
      token && sourceId === "warehouse" ? { accessToken: token } : null,
    ),
    plans: {
      list: async () => [],
      get: async (_tenant, _source, planId) =>
        planId === "p1" ? plan({ ...draft }) : null,
      create: async (_tenant, _source, content) => {
        saved.push(content);
        return plan(content);
      },
      update: async (_tenant, _source, _id, content) => plan(content),
      remove: async () => {},
    },
  };
  return { value, saved };
}

function setup(...responses: Response[]) {
  const fetchImpl = vi.fn<typeof fetch>();
  for (const response of responses) fetchImpl.mockResolvedValueOnce(response);
  fetchImpl.mockImplementation(async () => Response.json({}));
  const host = authoring();
  return {
    fetchImpl,
    host,
    workbench: createQueryWorkbench({ authoring: host.value, fetchImpl }),
  };
}

describe("estimate", () => {
  it("dry-runs the draft with each parameter's sample", async () => {
    const { workbench, fetchImpl } = setup(Response.json(dryRun()));
    const estimate = await workbench.estimate(request(), "warehouse", draft);
    expect(estimate).toEqual({
      ok: true,
      statementType: "SELECT",
      totalBytesProcessed: 4200,
      columns: [
        { name: "day", type: "DATE", mode: "NULLABLE" },
        { name: "trips", type: "INTEGER" },
      ],
    });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://bigquery.googleapis.com/bigquery/v2/projects/analytics-prod/jobs",
    );
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer source-token",
    );
    const body = JSON.parse(String(init?.body));
    expect(body.configuration.dryRun).toBe(true);
    expect(body.configuration.query.queryParameters).toEqual([
      {
        name: "since",
        parameterType: { type: "DATE" },
        parameterValue: { value: "2026-10-01" },
      },
    ]);
  });

  it("returns BigQuery's message and position when it refuses the query", async () => {
    const { workbench } = setup(
      Response.json(
        { error: { message: "Unrecognized name: dya at [1:8]" } },
        { status: 400 },
      ),
    );
    expect(await workbench.estimate(request(), "warehouse", draft)).toEqual({
      ok: false,
      problem: {
        message: "Unrecognized name: dya at [1:8]",
        line: 1,
        column: 8,
      },
    });
  });

  it("says that only SELECT can be saved", async () => {
    const { workbench } = setup(Response.json(dryRun("DELETE")));
    const estimate = await workbench.estimate(request(), "warehouse", draft);
    expect(estimate.ok).toBe(false);
    expect(estimate.problem?.message).toContain("DELETE");
  });

  it("refuses an invalid draft before calling BigQuery", async () => {
    const { workbench, fetchImpl } = setup();
    await expect(
      workbench.estimate(request(), "warehouse", { ...draft, projectId: "X" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      workbench.estimate(request(), "warehouse", {
        ...draft,
        maximumBytesBilled: 2_000_000_000,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("answers 404 for a source the host does not give a token for", async () => {
    const { workbench } = setup();
    await expect(
      workbench.estimate(request(), "elsewhere", draft),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("preview", () => {
  it("runs the job and shows nested columns as JSON, with a warning", async () => {
    const result = {
      jobComplete: true,
      totalRows: "1",
      totalBytesProcessed: "4200",
      cacheHit: true,
      schema: {
        fields: [
          { name: "day", type: "DATE" },
          {
            name: "stop",
            type: "RECORD",
            fields: [{ name: "city", type: "STRING" }],
          },
        ],
      },
      rows: [{ f: [{ v: "2026-10-01" }, { v: { f: [{ v: "Lima" }] } }] }],
    };
    const { workbench, fetchImpl } = setup(
      Response.json(dryRun()),
      Response.json({}),
      Response.json(result),
    );
    const preview = await workbench.preview(request(), "warehouse", draft);
    expect(preview).toMatchObject({
      ok: true,
      rows: [{ day: "2026-10-01", stop: '{"city":"Lima"}' }],
      totalRows: 1,
      truncated: false,
      totalBytesProcessed: 4200,
      cacheHit: true,
    });
    expect(preview.warnings).toEqual([
      "A dashboard refuses nested or repeated columns: stop",
    ]);
    expect(String(fetchImpl.mock.calls[2]![0])).toContain("maxResults=5001");
  });

  it("returns the problem instead of failing", async () => {
    const { workbench } = setup(
      Response.json(dryRun()),
      Response.json({ status: { errorResult: { message: "Quota exceeded" } } }),
    );
    expect(
      await workbench.preview(request(), "warehouse", draft),
    ).toMatchObject({
      ok: false,
      rows: [],
      problem: { message: "Quota exceeded" },
    });
  });

  it("refuses a query that reads more than its limit before running it", async () => {
    const { workbench, fetchImpl } = setup(Response.json(dryRun()));
    const preview = await workbench.preview(request(), "warehouse", {
      ...draft,
      maximumBytesBilled: 100,
    });
    expect(preview.problem?.message).toContain("4200 bytes");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

describe("saving", () => {
  it("saves a query BigQuery accepts, with its columns", async () => {
    const { workbench, host } = setup(Response.json(dryRun()));
    const plan = await workbench.createPlan(request(), "warehouse", draft);
    expect(plan.revision).toBe("r1");
    expect(host.saved[0]?.columns?.map((column) => column.name)).toEqual([
      "day",
      "trips",
    ]);
  });

  it("refuses to save a query BigQuery refuses", async () => {
    const { workbench, host } = setup(
      Response.json({ error: { message: "Syntax error" } }, { status: 400 }),
    );
    await expect(
      workbench.createPlan(request(), "warehouse", draft),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "BigQuery refused the query: Syntax error",
    });
    expect(host.saved).toEqual([]);
  });

  it("answers 404 for an unknown saved query", async () => {
    const { workbench } = setup();
    await expect(
      workbench.getPlan(request(), "warehouse", "missing"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      workbench.removePlan(request(), "warehouse", "missing"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("schema", () => {
  const datasets = {
    datasets: [
      { datasetReference: { datasetId: "fleet" }, location: "US" },
      { datasetReference: { datasetId: "empty" }, location: "US" },
    ],
  };
  const row = (...values: string[]) => ({ f: values.map((v) => ({ v })) });
  const columns = {
    jobComplete: true,
    rows: [
      row("fleet", "daily", "BASE TABLE", "day", "DATE"),
      row("fleet", "daily", "BASE TABLE", "stop", "STRUCT<city STRING>"),
      row("fleet", "daily", "BASE TABLE", "stop.city", "STRING"),
      row("fleet", "daily", "BASE TABLE", "tags", "ARRAY<STRING>"),
      row("fleet", "recent", "VIEW", "day", "DATE"),
    ],
  };

  it("builds datasets, tables and nested columns, and reuses them", async () => {
    const { workbench, fetchImpl } = setup(
      Response.json(datasets),
      Response.json(columns),
    );
    const schema = await workbench.schema(
      request(),
      "warehouse",
      "analytics-prod",
    );
    expect(schema).toEqual({
      projectId: "analytics-prod",
      truncated: false,
      datasets: [
        {
          name: "fleet",
          location: "US",
          tables: [
            {
              name: "daily",
              type: "TABLE",
              columns: [
                { name: "day", type: "DATE" },
                {
                  name: "stop",
                  type: "STRUCT",
                  fields: [{ name: "city", type: "STRING" }],
                },
                { name: "tags", type: "STRING", mode: "REPEATED" },
              ],
            },
            {
              name: "recent",
              type: "VIEW",
              columns: [{ name: "day", type: "DATE" }],
            },
          ],
        },
        { name: "empty", location: "US", tables: [] },
      ],
    });
    const query = JSON.parse(String(fetchImpl.mock.calls[1]![1]!.body));
    expect(query.query).toContain(
      "`analytics-prod`.`region-us`.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS",
    );
    await workbench.schema(request(), "warehouse", "analytics-prod");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("reports BigQuery's refusal as an upstream error with its message", async () => {
    const { workbench } = setup(
      Response.json(
        { error: { message: "Access Denied: Project analytics-prod" } },
        { status: 403 },
      ),
    );
    await expect(
      workbench.schema(request(), "warehouse", "analytics-prod"),
    ).rejects.toMatchObject({
      code: "UPSTREAM_ERROR",
      message: "Access Denied: Project analytics-prod",
    });
  });
});

describe("schema cache caller isolation", () => {
  it.each(["user", "scope"])(
    "does not reuse another %s's metadata for the same source",
    async (boundary) => {
      const host = authoring();
      host.value.accessFor = vi.fn(async (input) => ({
        accessToken: `${input.identity.userId}-${input.scopeId}`,
      }));
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        Response.json({ datasets: [] }),
      );
      const workbench = createQueryWorkbench({
        authoring: host.value,
        fetchImpl,
      });
      const first = request();
      const second =
        boundary === "user"
          ? { ...first, identity: { ...first.identity, userId: "demo-other" } }
          : { ...first, scopeId: "demo-other" };
      await workbench.schema(first, "warehouse", "analytics-prod");
      await workbench.schema(second, "warehouse", "analytics-prod");
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(
        new Headers(fetchImpl.mock.calls[1]?.[1]?.headers).get("authorization"),
      ).toBe(`Bearer ${second.identity.userId}-${second.scopeId}`);
    },
  );
});

describe("estimate and save deadlines", () => {
  it.each(["estimate", "createPlan"] as const)(
    "bounds a stalled %s dry run without waiting for the client to disconnect",
    async (action) => {
      const host = authoring();
      const incoming = new AbortController();
      const fetchImpl = vi.fn<typeof fetch>(
        async (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init!.signal!.addEventListener(
              "abort",
              () => reject(init!.signal!.reason),
              { once: true },
            );
          }),
      );
      const workbench = createQueryWorkbench({
        authoring: host.value,
        fetchImpl,
        timeoutMs: 10,
      });
      try {
        const pending = workbench[action](
          { ...request(), signal: incoming.signal },
          "warehouse",
          draft,
        ).then(
          (value) => ({ value }),
          (error: unknown) => ({ error }),
        );
        const result = await Promise.race([
          pending,
          new Promise<"stalled">((resolve) =>
            setTimeout(() => resolve("stalled"), 100),
          ),
        ]);
        expect(result).not.toBe("stalled");
        if (action === "estimate")
          expect(result).toMatchObject({
            value: {
              ok: false,
              problem: { message: "The estimate took more than 0.01 s" },
            },
          });
        else expect(result).toMatchObject({ error: { code: "BAD_REQUEST" } });
        expect(incoming.signal.aborted).toBe(false);
        expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
        expect(host.saved).toEqual([]);
      } finally {
        incoming.abort();
      }
    },
  );

  it("sends the original SQL text so BigQuery coordinates match the editor", async () => {
    const { workbench, fetchImpl } = setup(Response.json(dryRun()));
    const sql = "\n\n  SELECT 1\n";
    await workbench.estimate(request(), "warehouse", { ...draft, sql });
    const body = JSON.parse(String(fetchImpl.mock.calls[0]![1]!.body));
    expect(body.configuration.query.query).toBe(sql);
  });
});
