import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs/promises")>()),
  readFile: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.4 fixture")),
}));

import { GET } from "./route";

describe("GET /api/storytelling/pdf-preview", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    authMock.mockResolvedValue({ user: { email: "u@example.com" } });
    process.env.ENABLE_STORYTELLING = "true";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it("404s when the feature flag is off, before auth runs", async () => {
    delete process.env.ENABLE_STORYTELLING;
    const res = await GET();
    expect(res.status).toBe(404);
    expect(authMock).not.toHaveBeenCalled();
  });

  it("401s an unauthenticated caller when the flag is on", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("serves the fixture PDF when flag is on and authenticated", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/pdf");
  });
});
