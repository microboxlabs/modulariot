import { describe, expect, it, vi } from "vitest";
import { DEFAULT_STORAGE } from "@microboxlabs/miot-dashboard-contract/document";
import {
  createDashboardServerClient,
  DashboardApiError,
} from "./dashboard-server-client";

function response(data: object | null, etag = '"1"') {
  return Response.json({ data }, { headers: { etag } });
}

describe("dashboard server browser client", () => {
  it("binds cache keys and requests to the original organization", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response([]));
    const client = createDashboardServerClient("org/a", fetcher);
    expect(client.key("sales & costs")).toBe(
      "/app/api/dashboards/sales%20%26%20costs?org=org%2Fa"
    );
    expect(client.key("sales")).not.toBe(
      createDashboardServerClient("other").key("sales")
    );
    await client.list();
    expect(fetcher).toHaveBeenCalledWith(
      "/app/api/dashboards?org=org%2Fa",
      expect.objectContaining({
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
      })
    );
  });

  it("retains the loaded revision and forwards it on save", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(DEFAULT_STORAGE, '"7"'))
      .mockResolvedValueOnce(
        response({ revision: 8, updatedAt: "2026-09-28" }, '"8"')
      );
    const client = createDashboardServerClient("org", fetcher);
    const loaded = await client.load("sales");
    expect(loaded).toEqual({ config: DEFAULT_STORAGE, etag: '"7"' });
    const saved = await client.save("sales", DEFAULT_STORAGE, loaded.etag);
    expect(saved.etag).toBe('"8"');
    expect(fetcher.mock.calls[1]?.[1]?.headers).toEqual({
      "content-type": "application/json",
      "if-match": '"7"',
    });
  });

  it.each([401, 403, 409, 500])(
    "reports %i without retrying or mutating local edits",
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response("private upstream details", { status })
        );
      const client = createDashboardServerClient("org", fetcher);
      const edits = structuredClone(DEFAULT_STORAGE);
      await expect(client.save("sales", edits, '"1"')).rejects.toMatchObject({
        status,
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(edits).toEqual(DEFAULT_STORAGE);
    }
  );

  it("refuses blind saves and responses without revisions", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: DEFAULT_STORAGE }));
    const client = createDashboardServerClient("org", fetcher);
    await expect(
      client.save("sales", DEFAULT_STORAGE, "*")
    ).rejects.toBeInstanceOf(DashboardApiError);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(client.load("sales")).rejects.toMatchObject({ status: 502 });
  });

  it("distinguishes an absent document from an invalid document", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(null, '"0"'))
      .mockResolvedValueOnce(response({ preferences: {} }))
      .mockResolvedValueOnce(
        new Response("not JSON", { headers: { etag: '"1"' } })
      );
    const client = createDashboardServerClient("org", fetcher);
    expect(await client.load("new")).toEqual({ config: null, etag: '"0"' });
    await expect(client.load("bad")).rejects.toMatchObject({ status: 502 });
    await expect(client.load("bad-json")).rejects.toMatchObject({
      status: 502,
    });
  });

  it("uses the capabilities and permissions wire envelopes", async () => {
    const assignments = [{ authorityId: "user:1", role: "Editor" as const }];
    const capabilities = {
      readOnly: false,
      canEdit: true,
      canShare: false,
      canManagePermissions: false,
      canDelete: false,
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(capabilities))
      .mockResolvedValueOnce(Response.json({ assignments }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createDashboardServerClient("org", fetcher);
    expect(await client.capabilities("sales")).toEqual(capabilities);
    expect(await client.permissions("sales")).toEqual({ assignments });
    await client.setPermissions("sales", assignments);
    expect(fetcher.mock.calls[2]?.[1]?.body).toBe(
      JSON.stringify({ assignments })
    );
    await client.remove("sales");
    expect(fetcher.mock.calls[3]?.[1]?.method).toBe("DELETE");
  });

  it("normalizes transport failures but preserves caller cancellation", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("network details"));
    const client = createDashboardServerClient("org", fetcher);
    await expect(client.list()).rejects.toMatchObject({ status: 502 });
    const controller = new AbortController();
    controller.abort();
    const aborted = new DOMException("Cancelled", "AbortError");
    fetcher.mockRejectedValueOnce(aborted);
    await expect(client.list(controller.signal)).rejects.toBe(aborted);
  });

  it("rejects dot path segments and forwards cancellation", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response([]));
    const client = createDashboardServerClient("org", fetcher);
    await expect(client.load("..")).rejects.toMatchObject({ status: 400 });
    expect(fetcher).not.toHaveBeenCalled();
    const controller = new AbortController();
    await client.list(controller.signal);
    expect(fetcher.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });
});

it("executes a saved query with filters and an abort signal", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(response({ rows: [{ cost: 3, service: "storage" }] }));
  const client = createDashboardServerClient("acme", fetcher);
  const controller = new AbortController();
  expect(
    await client.query(
      "fleet",
      "costs & usage",
      { days: 30 },
      controller.signal
    )
  ).toEqual([{ cost: 3, service: "storage" }]);
  expect(fetcher).toHaveBeenCalledWith(
    "/app/api/dashboards/fleet/queries/costs%20%26%20usage?org=acme",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ filters: { days: 30 } }),
      signal: controller.signal,
    })
  );
});
it("refuses malformed query rows", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(response({ rows: [{ nested: { private: true } }] }));
  await expect(
    createDashboardServerClient("acme", fetcher).query("fleet", "costs")
  ).rejects.toMatchObject({ status: 502 });
});

it("refuses query rows exceeding the field limit", async () => {
  const row = Object.fromEntries(
    Array.from({ length: 101 }, (_, i) => [`field${i}`, i])
  );
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(response({ rows: [row] }));
  await expect(
    createDashboardServerClient("acme", fetcher).query("fleet", "costs")
  ).rejects.toMatchObject({ status: 502 });
});
