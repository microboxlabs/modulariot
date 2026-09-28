import { describe, expect, it } from "vitest";
import { shareLinkOf, storyTitlesOf } from "./show-share-link-args";

function completed(tool: string, result: unknown, extra = {}) {
  return { tool: "mcp_call", ok: true, preview: { tool, result }, ...extra };
}

const LINK = {
  url: "https://app.example.com/app/share/tok_1",
  targetType: "story",
  targetId: "s1",
  access: "org",
};

describe("shareLinkOf", () => {
  it("reads the link a *_link call returned, with a known title", () => {
    expect(
      shareLinkOf(completed("stories_link", LINK), new Map([["s1", "Top"]]))
    ).toEqual({
      url: LINK.url,
      targetType: "story",
      targetId: "s1",
      title: "Top",
    });
  });

  it("ignores other tools, failed calls and results without a share URL", () => {
    expect(shareLinkOf(completed("stories_get", LINK))).toBeNull();
    expect(
      shareLinkOf(completed("stories_link", LINK, { ok: false }))
    ).toBeNull();
    expect(
      shareLinkOf(
        completed("stories_link", {
          ...LINK,
          url: "/api/v1/orgs/acme/links/tok_1",
        })
      )
    ).toBeNull();
    expect(
      shareLinkOf(
        completed("stories_link", {
          ...LINK,
          url: "javascript:alert(1)//share/",
        })
      )
    ).toBeNull();
    expect(shareLinkOf({ tool: "sql_query", preview: LINK })).toBeNull();
  });
});

describe("storyTitlesOf", () => {
  it("reads one story or a list of stories", () => {
    expect(
      storyTitlesOf(completed("stories_create", { id: "s1", title: "A" }))
    ).toEqual([["s1", "A"]]);
    expect(
      storyTitlesOf(
        completed("stories_list", {
          stories: [{ id: "s1", title: "A" }, { id: "s2" }],
        })
      )
    ).toEqual([["s1", "A"]]);
  });
});
