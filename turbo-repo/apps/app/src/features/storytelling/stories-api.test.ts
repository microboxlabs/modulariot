import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  StoriesApiError,
  getStory,
  iterateVersion,
  listStories,
  saveArtifactAsStory,
} from "./stories-api";
import type { StoryVersion } from "./storytelling.types";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return {
    url,
    init,
    body: init.body ? JSON.parse(String(init.body)) : undefined,
  };
}

describe("listStories", () => {
  it("sends only the filters it was given", async () => {
    fetchMock.mockImplementation(async () => json([]));
    await listStories({ kind: "pdf", search: "  q3 " });
    expect(lastCall().url).toBe("/api/stories?kind=pdf&search=q3");

    await listStories();
    expect(lastCall().url).toBe("/api/stories");
  });
});

describe("errors", () => {
  it("throws with the upstream status", async () => {
    fetchMock.mockImplementation(async () =>
      json({ error: "story not found" }, 404)
    );
    await expect(getStory("s1")).rejects.toMatchObject({ status: 404 });
    await expect(getStory("s1")).rejects.toBeInstanceOf(StoriesApiError);
  });
});

describe("saveArtifactAsStory", () => {
  it("stores text as the first version's content, with its source", async () => {
    fetchMock.mockResolvedValue(json({ id: "s1" }, 201));
    await saveArtifactAsStory({
      title: "Weekly",
      kind: "markdown",
      content: "# Hi",
      threadId: "t1",
      messageId: "m1",
    });
    const { url, init, body } = lastCall();
    expect(url).toBe("/api/stories");
    expect(init.method).toBe("POST");
    expect(body).toEqual({
      title: "Weekly",
      kind: "markdown",
      sourceThreadId: "t1",
      sourceMessageId: "m1",
      version: { content: "# Hi" },
    });
  });

  it("stores a structure as the version's metadata", async () => {
    fetchMock.mockResolvedValue(json({ id: "s2" }, 201));
    await saveArtifactAsStory({
      title: "Deck",
      kind: "deck",
      content: { slides: [{ type: "title", title: "Q3" }] },
    });
    expect(lastCall().body).toEqual({
      title: "Deck",
      kind: "deck",
      version: { metadata: { slides: [{ type: "title", title: "Q3" }] } },
    });
  });
});

describe("iterateVersion", () => {
  const listed: StoryVersion = {
    id: "v1",
    storyId: "s1",
    parentId: null,
    label: "v1",
    summary: null,
    contentType: "text/markdown",
    content: null,
    metadata: null,
    createdAt: "2026-01-01T00:00:00Z",
    createdBy: "u",
  };

  it("reads the parent's content when the listing left it out, then adds a child", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ ...listed, content: "# Body" }))
      .mockResolvedValueOnce(
        json({ ...listed, id: "v2", parentId: "v1" }, 201)
      );

    const created = await iterateVersion("s1", listed);

    expect(fetchMock.mock.calls[0][0]).toBe("/api/stories/s1/versions/v1");
    expect(lastCall().url).toBe("/api/stories/s1/versions");
    expect(lastCall().body).toEqual({
      parentId: "v1",
      content: "# Body",
      contentType: "text/markdown",
    });
    expect(created.id).toBe("v2");
  });
});
