import { beforeEach, describe, expect, it, vi } from "vitest";

const { forwardToQuarkus } = vi.hoisted(() => ({ forwardToQuarkus: vi.fn() }));
vi.mock("@/app/api/utils/quarkus-proxy", () => ({ forwardToQuarkus }));

import { DELETE, GET, PUT } from "./[kind]/[lang]/route";
import { POST as preview } from "./[kind]/[lang]/preview/route";

const FORWARDED = { ok: true };
const TEMPLATE = { subject: "Hola", html: "{{link}}" };

function params(kind: string, lang: string) {
  return { params: Promise.resolve({ kind, lang }) };
}

function jsonRequest(body: string): Request {
  return new Request("http://localhost/app/api/admin/platform/mail-templates", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

beforeEach(() => {
  forwardToQuarkus.mockReset();
  forwardToQuarkus.mockResolvedValue(FORWARDED);
});

describe("platform mail templates proxy", () => {
  it("forwards a read", async () => {
    await GET(new Request("http://localhost"), params("invitation", "es"));

    expect(forwardToQuarkus).toHaveBeenCalledWith(
      "/api/v1/platform/mail-templates/invitation/es"
    );
  });

  it("forwards a save with its body", async () => {
    await PUT(
      jsonRequest(JSON.stringify(TEMPLATE)),
      params("invitation", "en")
    );

    expect(forwardToQuarkus).toHaveBeenCalledWith(
      "/api/v1/platform/mail-templates/invitation/en",
      { method: "PUT", body: TEMPLATE }
    );
  });

  it("forwards a reset and a preview", async () => {
    await DELETE(new Request("http://localhost"), params("invitation", "es"));
    await preview(
      jsonRequest(JSON.stringify(TEMPLATE)),
      params("invitation", "es")
    );

    expect(forwardToQuarkus).toHaveBeenNthCalledWith(
      1,
      "/api/v1/platform/mail-templates/invitation/es",
      { method: "DELETE" }
    );
    expect(forwardToQuarkus).toHaveBeenNthCalledWith(
      2,
      "/api/v1/platform/mail-templates/invitation/es/preview",
      { method: "POST", body: TEMPLATE }
    );
  });

  it("refuses a path outside the templates and a body that is not JSON", async () => {
    const outside = await GET(
      new Request("http://localhost"),
      params("..", "es")
    );
    const notJson = await PUT(jsonRequest("{"), params("invitation", "es"));

    expect(outside.status).toBe(400);
    expect(notJson.status).toBe(400);
    expect(forwardToQuarkus).not.toHaveBeenCalled();
  });
});
