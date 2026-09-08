import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const buildPptxMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

vi.mock("@/features/storytelling/build-pptx", () => ({
  buildPptx: (...args: unknown[]) => buildPptxMock(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { POST } from "./route";

function post(body: unknown): Request {
  return new Request("http://localhost/api/storytelling/generate-pptx", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validDeck = {
  slides: [
    { type: "title", title: "Q3", subtitle: "Ops review" },
    { type: "bullets", title: "Highlights", items: ["a", "b"] },
    { type: "table", title: "Numbers", headers: ["k", "v"], rows: [["x", "1"]] },
  ],
};

describe("POST /api/storytelling/generate-pptx", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    authMock.mockResolvedValue({ user: { email: "u@example.com" } });
    buildPptxMock.mockResolvedValue(Buffer.from("pptx-bytes"));
    process.env.ENABLE_STORYTELLING = "true";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it("404s when the feature flag is off, before auth runs", async () => {
    delete process.env.ENABLE_STORYTELLING;
    const res = await POST(post(validDeck));
    expect(res.status).toBe(404);
    expect(authMock).not.toHaveBeenCalled();
  });

  it("401s an unauthenticated caller", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(post(validDeck));
    expect(res.status).toBe(401);
    expect(buildPptxMock).not.toHaveBeenCalled();
  });

  it("400s a malformed JSON body", async () => {
    const res = await POST(post("{not json"));
    expect(res.status).toBe(400);
  });

  it("400s a bullets slide missing its items array", async () => {
    const res = await POST(post({ slides: [{ type: "bullets", title: "x" }] }));
    expect(res.status).toBe(400);
    expect(buildPptxMock).not.toHaveBeenCalled();
  });

  it("400s an unknown slide type", async () => {
    const res = await POST(post({ slides: [{ type: "video", title: "x" }] }));
    expect(res.status).toBe(400);
  });

  it("400s a deck over the slide ceiling", async () => {
    const slides = Array.from({ length: 201 }, () => ({
      type: "bullets",
      title: "x",
      items: ["a"],
    }));
    const res = await POST(post({ slides }));
    expect(res.status).toBe(400);
  });

  it("builds a .pptx for a well-formed deck", async () => {
    const res = await POST(post(validDeck));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("presentationml.presentation");
    expect(buildPptxMock).toHaveBeenCalledWith(validDeck);
  });

  it("500s (not throws) when buildPptx fails", async () => {
    buildPptxMock.mockRejectedValue(new Error("pptxgen boom"));
    const res = await POST(post(validDeck));
    expect(res.status).toBe(500);
  });
});
