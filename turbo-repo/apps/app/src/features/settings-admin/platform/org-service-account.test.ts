import { afterEach, expect, it, vi } from "vitest";
import { connectManagedBigQuery } from "./org-service-account";

afterEach(() => vi.unstubAllGlobals());

it("validates the managed connection response", async () => {
  const response = {
    connectionId: "demo-connection",
    name: "Demo",
    status: "ACTIVE",
    tested: true,
    testMessage: null,
  };
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(response)));
  vi.stubGlobal("fetch", fetcher);
  await expect(connectManagedBigQuery("demo/org")).resolves.toEqual(response);
  expect(fetcher).toHaveBeenCalledWith(
    "/app/api/admin/platform/orgs/demo%2Forg/service-account/bigquery-connection",
    expect.objectContaining({ method: "POST" })
  );
});

it("rejects a truthy string that cannot represent a successful connection test", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          connectionId: "demo",
          name: "Demo",
          status: "DRAFT",
          tested: "false",
          testMessage: null,
        })
      )
    )
  );
  await expect(connectManagedBigQuery("demo")).rejects.toThrow();
});
