import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const forwardMock = vi.fn();

vi.mock("@/app/api/utils/streamhub-modulith-proxy", () => ({
  forwardToStreamhubModulith: (...args: unknown[]) => forwardMock(...args),
}));

import { DELETE, GET, POST, PUT } from "./route";

const ctx = (path?: string[]) => ({ params: Promise.resolve({ path }) });
const BASE = "/api/v1/platform/symptom-templates";

describe("/api/admin/platform/symptom-templates/[[...path]]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    forwardMock.mockResolvedValue(NextResponse.json({ ok: true }));
  });

  it("lists the templates at the root with the user's session", async () => {
    await GET(new Request("http://x"), ctx());
    expect(forwardMock).toHaveBeenCalledWith(BASE, { sessionOnly: true });
  });

  it("keeps the query of a compare", async () => {
    await GET(
      new Request("http://x/c?from=1.0.0&to=1.1.0"),
      ctx(["t1", "compare"])
    );
    expect(forwardMock).toHaveBeenCalledWith(
      `${BASE}/t1/compare?from=1.0.0&to=1.1.0`,
      { sessionOnly: true }
    );
  });

  it("forwards a draft save and a discard", async () => {
    const spec = { source: "gps_signal" };
    await PUT(
      new Request("http://x", { method: "PUT", body: JSON.stringify(spec) }),
      ctx(["t1", "draft"])
    );
    await DELETE(new Request("http://x"), ctx(["t1", "draft"]));
    expect(forwardMock).toHaveBeenNthCalledWith(1, `${BASE}/t1/draft`, {
      method: "PUT",
      body: spec,
      sessionOnly: true,
    });
    expect(forwardMock).toHaveBeenNthCalledWith(2, `${BASE}/t1/draft`, {
      method: "DELETE",
      sessionOnly: true,
    });
  });

  it("refuses paths that could leave the templates API", async () => {
    for (const path of [[".."], ["t1", "a/b"], ["t1?x=1"]]) {
      const res = await GET(new Request("http://x"), ctx(path));
      expect(res.status).toBe(400);
    }
    expect(forwardMock).not.toHaveBeenCalled();
  });

  it("refuses a body that is not JSON", async () => {
    const res = await POST(
      new Request("http://x", { method: "POST", body: "{nope" }),
      ctx(["t1", "publish"])
    );
    expect(res.status).toBe(400);
  });
});
