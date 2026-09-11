import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/logger", () => ({ createLogger: () => log, logger: log }));

import { POST } from "./route";

function post(body: string) {
  return POST(
    new NextRequest("http://localhost/app/api/totem/diagnostics", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "kiosk" },
      body,
    })
  );
}

const base = {
  sessionId: "abc123",
  deviceId: "unknown",
  deviceLocation: "SCL",
  at: "2026-09-08T12:00:00.000Z",
};

describe("POST /app/api/totem/diagnostics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("logs failures at warn with the device context", async () => {
    const res = await post(
      JSON.stringify({ ...base, event: "idcard.error", status: 504, code: "TIMEOUT", rut: "****1234" })
    );
    expect(res.status).toBe(204);
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "idcard.error",
        deviceLocation: "SCL",
        status: 504,
        code: "TIMEOUT",
        rut: "****1234",
        source: "browser",
        userAgent: "kiosk",
      }),
      "totem idcard.error"
    );
    expect(log.info).not.toHaveBeenCalled();
  });

  it("logs non-failures at info", async () => {
    await post(JSON.stringify({ ...base, event: "fingerprint.ok", durationMs: 1200 }));
    expect(log.info).toHaveBeenCalledOnce();
  });

  it("rejects unknown events and oversized fields", async () => {
    expect((await post(JSON.stringify({ ...base, event: "shell.exec" }))).status).toBe(400);
    expect(
      (await post(JSON.stringify({ ...base, event: "idcard.error", message: "x".repeat(301) }))).status
    ).toBe(400);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("rejects bodies that are not JSON or too large", async () => {
    expect((await post("not json")).status).toBe(400);
    expect((await post("x".repeat(5000))).status).toBe(413);
  });
});
