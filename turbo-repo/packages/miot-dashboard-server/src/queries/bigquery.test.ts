import { describe, expect, it, vi } from "vitest";
import { NO_CAPABILITIES } from "../seams/identity";
import type { DashboardOperationRequest } from "../seams/operations";
import {
  createBigQueryOperationExecutor,
  type ResolvedBigQueryOperation,
} from "./bigquery";

const request = (): DashboardOperationRequest => ({
  identity: {
    tenantId: "acme",
    userId: "viewer",
    kind: "user",
    capabilities: NO_CAPABILITIES,
  },
  ref: { tenantId: "acme", scopeId: "ops", slug: "costs" },
  connectionId: "billing",
  operationId: "costs",
  parameters: { days: 30 },
  signal: new AbortController().signal,
  limits: { maxRows: 5, maxBytes: 4096 },
});
const operation = (): ResolvedBigQueryOperation => ({
  plan: {
    projectId: "billing-project",
    location: "us-central1",
    sql: "SELECT @days AS days",
    maximumBytesBilled: 1000,
    parameterTypes: { days: "INT64" },
  },
  parameters: { days: 30 },
  accessToken: "private-token",
});
const dryRun = {
  statistics: {
    totalBytesProcessed: "500",
    query: { statementType: "SELECT" },
  },
};
const result = {
  jobComplete: true,
  totalRows: "1",
  schema: { fields: [{ name: "days", type: "INTEGER" }] },
  rows: [{ f: [{ v: "30" }] }],
};
function setup(resolved = operation(), response: object = result) {
  const resolve = vi.fn(async () => resolved);
  const fetchImpl = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(dryRun))
    .mockResolvedValueOnce(Response.json({}))
    .mockResolvedValueOnce(Response.json(response))
    .mockImplementation(async () => Response.json({}));
  return {
    resolve,
    fetchImpl,
    executor: createBigQueryOperationExecutor({ resolve, fetchImpl }),
  };
}

describe("portable BigQuery execution", () => {
  it("uses Google directly, binds parameters, dry runs and enforces the job budget", async () => {
    const { executor, fetchImpl } = setup();
    expect(await executor.execute(request())).toEqual({
      rows: [{ days: "30" }],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    for (const [url, init] of fetchImpl.mock.calls) {
      expect(new URL(String(url)).origin).toBe(
        "https://bigquery.googleapis.com",
      );
      expect(init?.redirect).toBe("error");
    }
    const dry = JSON.parse(String(fetchImpl.mock.calls[0]![1]!.body));
    const job = JSON.parse(String(fetchImpl.mock.calls[1]![1]!.body));
    expect(dry.configuration.dryRun).toBe(true);
    expect(job.configuration).toMatchObject({
      dryRun: false,
      jobTimeoutMs: "20000",
      query: {
        maximumBytesBilled: "1000",
        useLegacySql: false,
        queryParameters: [
          {
            name: "days",
            parameterType: { type: "INT64" },
            parameterValue: { value: "30" },
          },
        ],
      },
    });
    expect(job.jobReference.jobId).toMatch(/^dashboard_/);
  });

  it.each([
    {
      statistics: {
        totalBytesProcessed: "1001",
        query: { statementType: "SELECT" },
      },
    },
    {
      statistics: {
        totalBytesProcessed: "1",
        query: { statementType: "DELETE" },
      },
    },
    { statistics: { query: { statementType: "SELECT" } } },
  ])(
    "refuses an unsafe dry run before creating a billable job",
    async (dry) => {
      const { executor, fetchImpl } = setup();
      fetchImpl.mockReset().mockResolvedValue(Response.json(dry));
      await expect(executor.execute(request())).rejects.toMatchObject({
        code: "UPSTREAM_ERROR",
      });
      expect(fetchImpl).toHaveBeenCalledOnce();
    },
  );

  it.each([
    { ...result, pageToken: "next" },
    { ...result, totalRows: "2" },
    { ...result, schema: { fields: [{ name: "nested", type: "RECORD" }] } },
    {
      ...result,
      schema: { fields: [{ name: "days", type: "INTEGER", mode: "REPEATED" }] },
    },
  ])("rejects partial/nested results and cancels the job", async (response) => {
    const { executor, fetchImpl } = setup(operation(), response);
    await expect(executor.execute(request())).rejects.toMatchObject({
      code: "UPSTREAM_ERROR",
    });
    expect(String(fetchImpl.mock.calls.at(-1)![0])).toContain(
      "/cancel?location=us-central1",
    );
  });

  it("refuses tenant mismatch and pre-cancellation before resolving credentials", async () => {
    const { executor, resolve } = setup();
    await expect(
      executor.execute({
        ...request(),
        ref: { ...request().ref, tenantId: "other" },
      }),
    ).rejects.toThrow();
    await expect(
      executor.execute({ ...request(), signal: AbortSignal.abort() }),
    ).rejects.toThrow();
    expect(resolve).not.toHaveBeenCalled();
  });

  it("rejects undeclared parameters and excessive template budgets without network requests", async () => {
    const resolved = operation();
    resolved.parameters.extra = "untrusted";
    const { executor, fetchImpl } = setup(resolved);
    await expect(executor.execute(request())).rejects.toThrow();
    delete resolved.parameters.extra;
    resolved.plan.maximumBytesBilled = 1_000_000_001;
    await expect(executor.execute(request())).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("bounds streamed response bytes and does not expose upstream diagnostics", async () => {
    const { executor, fetchImpl } = setup();
    fetchImpl
      .mockReset()
      .mockResolvedValue(Response.json({ private: "x".repeat(5000) }));
    await expect(executor.execute(request())).rejects.toMatchObject({
      message: "Dashboard query could not be completed",
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("cancels a submitted job on caller cancellation", async () => {
    const controller = new AbortController();
    const { executor, fetchImpl } = setup();
    fetchImpl
      .mockReset()
      .mockResolvedValueOnce(Response.json(dryRun))
      .mockImplementationOnce(async () => {
        controller.abort();
        return Response.json({});
      })
      .mockResolvedValue(Response.json({}));
    await expect(
      executor.execute({ ...request(), signal: controller.signal }),
    ).rejects.toThrow();
    expect(String(fetchImpl.mock.calls.at(-1)![0])).toContain("/cancel?");
    expect(fetchImpl.mock.calls.at(-1)![1]!.signal!.aborted).toBe(false);
  });
  it("stops polling at the deadline and attempts cancellation", async () => {
    const { resolve, fetchImpl } = setup();
    fetchImpl.mockReset().mockResolvedValueOnce(Response.json(dryRun)).mockImplementation(async () => Response.json({ jobComplete: false }));
    const executor = createBigQueryOperationExecutor({ resolve, fetchImpl, timeoutMs: 20 });
    await expect(executor.execute(request())).rejects.toThrow();
    expect(String(fetchImpl.mock.calls.at(-1)![0])).toContain("/cancel?");
  });

  it("rejects invalid result limits before catalog resolution", async () => {
    const { executor, resolve } = setup();
    await expect(executor.execute({ ...request(), limits: { maxRows: Infinity, maxBytes: 4096 } })).rejects.toThrow();
    expect(resolve).not.toHaveBeenCalled();
  });

});
