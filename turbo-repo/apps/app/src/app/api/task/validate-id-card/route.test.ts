import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createFetcherError } from "@/features/common/providers/fetcher";
import { FetcherErrorCode } from "@/features/common/providers/fetcher.types";

const cap = vi.hoisted(() => ({
  login: vi.fn(),
  createContent: vi.fn(),
  signIdCard: vi.fn(),
}));

vi.mock("@/features/common/providers/5cap-api/5cap-api.provider", () => cap);
vi.mock("@/utils/pdf-utils", () => ({
  readPDFAsBase64: vi.fn().mockResolvedValue("JVBERi0="),
}));
vi.mock("@/lib/logger", () => {
  const noop = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { createLogger: () => noop, logger: noop };
});

import { POST } from "./route";

function request(body: unknown) {
  return new NextRequest("http://localhost/app/api/task/validate-id-card", {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": "req-1" },
    body: JSON.stringify(body),
  });
}

const validBody = { user_rut: "11111111-1", nro_serie: "A001234567" };

describe("POST /app/api/task/validate-id-card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEC5_INSTITUTION = "INST";
    process.env.DEC5_TARGET_CONTENT_TYPE = "TYPE";
    cap.login.mockResolvedValue({ status: 200, message: "ok", session_id: "s1" });
    cap.createContent.mockResolvedValue({
      status: 200,
      message: "ok",
      result: { code: "DOC-1" },
    });
    cap.signIdCard.mockResolvedValue({ status: 200, message: "ok" });
  });

  it("returns success when the three provider calls succeed", async () => {
    const res = await POST(request(validBody));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ success: true, requestId: "req-1" });
    expect(cap.signIdCard).toHaveBeenCalledWith(
      expect.objectContaining({ nro_serie: "A001234567", code: "DOC-1", session_id: "s1" })
    );
  });

  it("answers a structured failure (not a 500) when the provider rejects with a non-2xx JSON body", async () => {
    cap.login.mockRejectedValue(
      createFetcherError("Request failed", 403, FetcherErrorCode.ACTION_ERROR, {
        responseText: '{"status":false,"error":"API key no encontrada"}',
      })
    );
    const res = await POST(request(validBody));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual({
      success: false,
      requestId: "req-1",
      step: "CAP_LOGIN",
      status: 403,
      code: "ACTION_ERROR",
      message: "API key no encontrada",
    });
  });

  it("names the step that failed when the signature is rejected in-band", async () => {
    cap.signIdCard.mockResolvedValue({ status: 400, message: "Serie no coincide" });
    const json = await (await POST(request(validBody))).json();
    expect(json).toMatchObject({
      success: false,
      step: "CAP_SIGN",
      status: 400,
      code: "CAP_SIGN_REJECTED",
      message: "Serie no coincide",
    });
  });

  it("reports a provider timeout as TIMEOUT", async () => {
    const abort = new Error("This operation was aborted");
    abort.name = "AbortError";
    cap.createContent.mockRejectedValue(abort);
    const json = await (await POST(request(validBody))).json();
    expect(json).toMatchObject({ success: false, step: "CAP_CONTENT", code: "TIMEOUT" });
  });

  it("rejects a body without the required fields", async () => {
    const json = await (await POST(request({ user_rut: "1-9" }))).json();
    expect(json).toMatchObject({ success: false, step: "PARSE", status: 400 });
    expect(cap.login).not.toHaveBeenCalled();
  });
});
