import { describe, expect, it } from "vitest";
import { base64ToBytes, downloadFor, renderForVersion } from "./story-content";
import type { StoryVersion } from "./storytelling.types";

function version(
  content: string | null,
  metadata: Record<string, unknown> | null = null
): StoryVersion {
  return {
    id: "v1",
    storyId: "s1",
    parentId: null,
    label: "v1",
    summary: null,
    contentType: null,
    content,
    metadata,
    createdAt: "2026-01-01T00:00:00Z",
    createdBy: "u",
  };
}

describe("renderForVersion", () => {
  it("renders text kinds from their content", () => {
    expect(renderForVersion("markdown", version("# Hi"))).toEqual({
      type: "markdown",
      markdown: "# Hi",
    });
    expect(renderForVersion("html", version("<p>x</p>"))).toEqual({
      type: "html",
      html: "<p>x</p>",
    });
    expect(renderForVersion("svg", version("<svg/>"))).toEqual({
      type: "svg",
      svg: "<svg/>",
    });
  });

  it("is empty without a version or content", () => {
    expect(renderForVersion("markdown", null)).toEqual({ type: "empty" });
    expect(renderForVersion("html", version(""))).toEqual({ type: "empty" });
  });

  it("reads a deck's slides from metadata, dropping unknown slides", () => {
    const render = renderForVersion(
      "deck",
      version(null, {
        slides: [
          { type: "title", title: "Q3", subtitle: "Review" },
          { type: "bullets", title: "Wins", items: ["a", 2] },
          { type: "table", title: "T", headers: ["k"], rows: [["v"]] },
          { type: "video" },
        ],
      })
    );
    expect(render).toEqual({
      type: "deck",
      deck: {
        slides: [
          { type: "title", title: "Q3", subtitle: "Review" },
          { type: "bullets", title: "Wins", items: ["a", "2"] },
          { type: "table", title: "T", headers: ["k"], rows: [["v"]] },
        ],
      },
    });
  });

  it("falls back to JSON content for a deck with no metadata", () => {
    const render = renderForVersion(
      "deck",
      version(JSON.stringify({ slides: [{ title: "Only" }] }))
    );
    expect(render).toEqual({
      type: "deck",
      deck: { slides: [{ type: "title", title: "Only" }] },
    });
  });

  it("decodes a PDF from base64 and rejects anything else", () => {
    const render = renderForVersion("pdf", version(btoa("%PDF-1.4")));
    expect(render.type).toBe("pdf");
    if (render.type === "pdf")
      expect(new TextDecoder().decode(render.data)).toBe("%PDF-1.4");
    expect(renderForVersion("pdf", version("not base64!"))).toEqual({
      type: "empty",
    });
  });

  it("keeps only known section types", () => {
    const render = renderForVersion(
      "sections",
      version(null, {
        sections: [
          { type: "heading", text: "Summary" },
          { type: "metric", label: "Trips", value: 42 },
          { type: "mystery" },
          "text",
        ],
      })
    );
    expect(render).toEqual({
      type: "sections",
      sections: [
        { type: "heading", text: "Summary" },
        { type: "metric", label: "Trips", value: 42 },
      ],
    });
  });
});

describe("base64ToBytes", () => {
  it("accepts a data URL prefix", () => {
    expect(base64ToBytes(`data:application/pdf;base64,${btoa("ab")}`)).toEqual(
      new Uint8Array([97, 98])
    );
  });
});

describe("downloadFor", () => {
  it("names the file after the story and its kind", () => {
    expect(
      downloadFor({ type: "markdown", markdown: "x" }, "Q3: report")?.filename
    ).toBe("Q3 report.md");
    expect(downloadFor({ type: "svg", svg: "<svg/>" }, "")?.filename).toBe(
      "story.svg"
    );
  });

  it("leaves decks to the pptx route", () => {
    expect(downloadFor({ type: "deck", deck: { slides: [] } }, "d")).toBeNull();
  });
});
