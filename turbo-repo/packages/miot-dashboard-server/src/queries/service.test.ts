import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_STORAGE } from "@microboxlabs/miot-dashboard-contract/document";
import {
  identityFromRequest,
  memoryStore,
  user,
  embed,
  type TestRequest,
} from "../test/fixtures";
import {
  createMemoryScopeAuthority,
  createMemoryTenantAuthority,
} from "../testing";
import type {
  DashboardOperationExecutor,
  DashboardQueryResult,
} from "../seams/operations";
import {
  createDashboardQueryService,
  type DashboardQueryOptions,
} from "./service";

const ref = { tenantId: "acme", scopeId: "ops", slug: "costs" };
const query = {
  id: "costs",
  variableName: "costs",
  connectionId: "billing",
  operationId: "summary",
  parameters: {
    days: { kind: "literal", value: 30 },
    service: { kind: "filter", key: "service", defaultValue: null },
  },
};
const document = { ...DEFAULT_STORAGE, queries: [query] };
function setup(
  overrides: Partial<DashboardQueryOptions<TestRequest>> = {},
  config: object = document,
) {
  const memberships = { acme: { ops: { viewer: "Consumer" as const } } };
  const execute = vi
    .fn<DashboardOperationExecutor["execute"]>()
    .mockResolvedValue({ rows: [{ cost: 12 }] });
  const store = memoryStore([{ ref, record: { config } }]);
  const options = {
    store,
    identity: identityFromRequest,
    tenants: createMemoryTenantAuthority(memberships),
    scopes: createMemoryScopeAuthority(memberships),
    operations: { execute },
    ...overrides,
  };
  return { service: createDashboardQueryService(options), execute, store };
}
const viewer = user("viewer", "acme");
afterEach(() => vi.useRealTimers());

describe("saved dashboard query service", () => {
  it("binds only stored operations and preserves null, false and zero filters", async () => {
    const { service, execute } = setup();
    for (const value of [null, false, 0, "storage"]) {
      expect(
        await service.execute(viewer, ref, "costs", { service: value }),
      ).toEqual({ rows: [{ cost: 12 }] });
      expect(execute).toHaveBeenLastCalledWith(
        expect.objectContaining({
          identity: expect.objectContaining({
            tenantId: "acme",
            userId: "viewer",
          }),
          ref,
          connectionId: "billing",
          operationId: "summary",
          parameters: { days: 30, service: value },
          limits: { maxRows: 5000, maxBytes: 2097152 },
        }),
      );
    }
    await service.execute(viewer, ref, "costs");
    expect(execute.mock.lastCall?.[0].parameters).toEqual({
      days: 30,
      service: null,
    });
  });

  it("denies anonymous and cross-tenant callers before reading storage", async () => {
    const { service, store, execute } = setup();
    await expect(service.execute(null, ref, "costs")).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      service.execute(viewer, { ...ref, tenantId: "other" }, "costs"),
    ).rejects.toMatchObject({ status: 403 });
    expect(store.touched()).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it("does not decode a deferred body until dashboard access is authorized", async () => {
    const { service, execute } = setup();
    const read = vi.fn().mockResolvedValue({ service: "storage" });
    await expect(
      service.execute(null, ref, "costs", read),
    ).rejects.toMatchObject({ status: 401 });
    expect(read).not.toHaveBeenCalled();
    await service.execute(viewer, ref, "costs", read);
    expect(read).toHaveBeenCalledTimes(1);
    expect(execute.mock.lastCall?.[0].parameters.service).toBe("storage");
  });

  it("enforces the embed dashboard boundary", async () => {
    const { service, execute } = setup();
    const token = embed("acme", "ops", "costs");
    await service.execute(token, ref, "costs");
    await expect(
      service.execute(token, { ...ref, slug: "other" }, "costs"),
    ).rejects.toMatchObject({ status: 403 });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it.each([
    { days: 365 },
    { sql: "select secret" },
    { service: {} },
    { service: Array(101).fill(1) },
    [],
  ])("rejects caller-controlled operation parameters %j", async (filters) => {
    const { service, execute } = setup();
    await expect(
      service.execute(viewer, ref, "costs", filters),
    ).rejects.toMatchObject({ status: 400 });
    expect(execute).not.toHaveBeenCalled();
  });

  it("refuses missing, ambiguous and invalid stored queries", async () => {
    const { service, execute } = setup();
    await expect(service.execute(viewer, ref, "missing")).rejects.toMatchObject(
      { status: 404 },
    );
    await expect(
      service.execute(viewer, { ...ref, slug: "missing" }, "costs"),
    ).rejects.toMatchObject({ status: 404 });
    const duplicated = setup({}, { ...document, queries: [query, query] });
    await expect(
      duplicated.service.execute(viewer, ref, "costs"),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      setup({}, {}).service.execute(viewer, ref, "costs"),
    ).rejects.toMatchObject({ status: 500 });
    expect(execute).not.toHaveBeenCalled();
  });

  it("requires filters without defaults and bounds parameter counts", async () => {
    const required = {
      ...query,
      parameters: { service: { kind: "filter", key: "service" } },
    };
    await expect(
      setup({}, { ...document, queries: [required] }).service.execute(
        viewer,
        ref,
        "costs",
      ),
    ).rejects.toMatchObject({ status: 400 });
    const parameters = Object.fromEntries(
      Array.from({ length: 101 }, (_, i) => [
        `p${i}`,
        { kind: "literal", value: 1 },
      ]),
    );
    await expect(
      setup(
        {},
        { ...document, queries: [{ ...query, parameters }] },
      ).service.execute(viewer, ref, "costs"),
    ).rejects.toMatchObject({ status: 400 });
  });

  it.each([
    { rows: [{ text: "a".repeat(2049) }] },
    { rows: [null] },
    { rows: [{ value: Number.POSITIVE_INFINITY }] },
    { rows: [{ nested: {} }] },
    { rows: [{ a: 1 }, { b: 2 }] },
  ])("bounds and validates upstream rows", async (result) => {
    const { service, execute } = setup({ maxRows: 1 });
    execute.mockResolvedValueOnce(result as DashboardQueryResult);
    await expect(service.execute(viewer, ref, "costs")).rejects.toMatchObject({
      code: "UPSTREAM_ERROR",
    });
  });

  it("bounds UTF-8 response bytes and hides upstream errors", async () => {
    const { service, execute } = setup({ maxBytes: 15 });
    await expect(service.execute(viewer, ref, "costs")).rejects.toMatchObject({
      status: 502,
    });
    execute.mockRejectedValueOnce(new Error("private credential details"));
    await expect(service.execute(viewer, ref, "costs")).rejects.toThrow(
      "Dashboard query could not be completed",
    );
  });

  it("times out, signals cancellation, and retains the slot until the adapter settles", async () => {
    vi.useFakeTimers();
    const { service, execute } = setup({ timeoutMs: 10, maxConcurrent: 1 });
    let release!: (result: DashboardQueryResult) => void;
    execute.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const pending = expect(
      service.execute(viewer, ref, "costs"),
    ).rejects.toMatchObject({ status: 502 });
    await vi.advanceTimersByTimeAsync(10);
    await pending;
    expect(execute.mock.calls[0]?.[0].signal.aborted).toBe(true);
    await expect(service.execute(viewer, ref, "costs")).rejects.toMatchObject({
      status: 502,
    });
    expect(execute).toHaveBeenCalledTimes(1);
    release({ rows: [] });
    await Promise.resolve();
    await service.execute(viewer, ref, "costs");
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("refuses pre-cancelled requests and cancels running operations", async () => {
    const { service, execute } = setup();
    const controller = new AbortController();
    controller.abort();
    await expect(
      service.execute(viewer, ref, "costs", {}, controller.signal),
    ).rejects.toMatchObject({ status: 502 });
    expect(execute).not.toHaveBeenCalled();
    const running = new AbortController();
    execute.mockImplementationOnce(async ({ signal }) => {
      running.abort();
      expect(signal.aborted).toBe(true);
      return { rows: [] };
    });
    await expect(
      service.execute(viewer, ref, "costs", {}, running.signal),
    ).rejects.toMatchObject({ status: 502 });
  });

  it.each([
    { timeoutMs: 0 },
    { timeoutMs: 2147483648 },
    { maxRows: -1 },
    { maxBytes: 1.5 },
    { maxConcurrent: Number.NaN },
  ])("rejects invalid limits %j", (options) => {
    expect(() => setup(options)).toThrow(TypeError);
  });
});
