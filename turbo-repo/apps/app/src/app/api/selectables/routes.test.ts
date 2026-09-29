import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const scopeMock = vi.fn();
const forwardMock = vi.fn();

vi.mock("@/app/api/utils/tenant-scope", () => ({
  resolveTenantScope: () => scopeMock(),
}));
vi.mock("@/app/api/utils/quarkus-proxy", () => ({
  forwardToQuarkus: (...args: unknown[]) => forwardMock(...args),
}));

import { GET as list } from "./route";
import { POST as reset } from "./reset/route";
import { PUT as putBindings } from "./bindings/route";
import { DELETE as remove, PUT as replace } from "./[key]/route";
import { GET as options } from "./[key]/options/route";

const key = (k: string) => ({ params: Promise.resolve({ key: k }) });

describe("/api/selectables routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeMock.mockResolvedValue({
      resolved: true,
      scope: { activeOrg: { slug: "acme" } },
    });
    forwardMock.mockResolvedValue(NextResponse.json([]));
  });

  it("forwards to the active organization's selectables", async () => {
    await list();
    await reset();

    expect(forwardMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/orgs/acme/selectables",
      undefined
    );
    expect(forwardMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/orgs/acme/selectables/reset",
      { method: "POST", body: {} }
    );
  });

  it("sends the body of a replace and encodes the key", async () => {
    const body = { name: { es: "Prioridad" }, mode: "SINGLE" };
    await replace(
      new Request("http://x/app/api/selectables/a%2Fb", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
      key("a/b")
    );
    await remove(new Request("http://x"), key("priority"));

    expect(forwardMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/orgs/acme/selectables/a%2Fb",
      { method: "PUT", body }
    );
    expect(forwardMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/orgs/acme/selectables/priority",
      { method: "DELETE" }
    );
  });

  it("passes the options query through", async () => {
    await options(
      new Request(
        "http://x/app/api/selectables/commune/options?q=vi&parent=CL-VS&limit=5"
      ),
      key("commune")
    );

    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/selectables/commune/options?q=vi&parent=CL-VS&limit=5",
      undefined
    );
  });

  it("sends a body that is not JSON on as null, for the modulith to refuse", async () => {
    await putBindings(
      new Request("http://x", { method: "PUT", body: "not json" })
    );

    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/selectables/bindings",
      { method: "PUT", body: null }
    );
  });

  it("answers for the scope when there is no active organization", async () => {
    scopeMock.mockResolvedValue({
      resolved: false,
      response: NextResponse.json({ error: "no org" }, { status: 403 }),
    });

    const res = await list();

    expect(res.status).toBe(403);
    expect(forwardMock).not.toHaveBeenCalled();
  });
});
