import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LinkApiError,
  copyShareLink,
  createLink,
  resolveLink,
  shareLinkUrl,
} from "./share-links-api";

const fetchMock = vi.fn();
const writeText = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  writeText.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const link = {
  token: "tok_1",
  targetType: "thread",
  targetId: "t1",
  access: "org",
  createdBy: "u",
  createdAt: "2026-09-01T00:00:00Z",
  path: "/api/v1/orgs/acme/links/tok_1",
};

describe("share links client", () => {
  it("creates a link for a target", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(link)));
    await createLink("story", "s1");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/links");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      targetType: "story",
      targetId: "s1",
    });
  });

  it("pages a thread snapshot", async () => {
    fetchMock.mockResolvedValue(new Response("{}"));
    await resolveLink("tok 1", { after: 40, limit: 200 });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/links/tok%201?after=40&limit=200"
    );
  });

  it("throws with the status of a failed read", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 404 }));
    await expect(resolveLink("gone")).rejects.toEqual(new LinkApiError(404));
  });

  it("builds the app URL of a link", () => {
    expect(shareLinkUrl("https://app.example.com", "es", "tok_1")).toBe(
      "https://app.example.com/es/share/tok_1"
    );
  });

  it("copies the app URL of a thread's link", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(link)));
    const url = await copyShareLink("thread", "t1", "en");
    expect(url).toBe(`${window.location.origin}/en/share/tok_1`);
    expect(writeText).toHaveBeenCalledWith(url);
  });

  it("does not copy anything when the link cannot be made", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 404 }));
    await expect(copyShareLink("thread", "t1", "en")).rejects.toBeInstanceOf(
      LinkApiError
    );
    expect(writeText).not.toHaveBeenCalled();
  });
});
