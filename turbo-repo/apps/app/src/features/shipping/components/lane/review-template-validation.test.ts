import { describe, it, expect } from "vitest";
import { checkTemplate } from "./review-template-validation";

/**
 * Each case mirrors a rule in the server's PayloadTemplate. If one of these starts
 * failing because the server relaxed, relax both together — the point of this
 * validator is that the drawer never shows green for a template that cannot be saved.
 */
describe("checkTemplate", () => {
  it("treats literal text with no variables as neutral", () => {
    expect(checkTemplate("just text").status).toBe("none");
    expect(checkTemplate("").status).toBe("none");
  });

  it("accepts a plain dotted path and reports what it reads", () => {
    const check = checkTemplate("{{content.mediaId}}");
    expect(check.status).toBe("valid");
    expect(check.paths).toEqual(["content.mediaId"]);
  });

  it("tolerates padding inside the braces, as the server does", () => {
    expect(checkTemplate("{{  content.mediaId  }}").status).toBe("valid");
  });

  it("accepts literals interleaved with several variables", () => {
    const check = checkTemplate("svc {{task.serviceCode}} / {{content.verdict}}");
    expect(check.status).toBe("valid");
    expect(check.paths).toEqual(["task.serviceCode", "content.verdict"]);
  });

  it("rejects blocks, partials and comments", () => {
    // The dashboard's Handlebars-backed validator calls this valid; the server does not.
    expect(checkTemplate("{{#if content.verdict}}x{{/if}}").problem?.code).toBe("notPlain");
    expect(checkTemplate("{{> partial}}").problem?.code).toBe("notPlain");
    expect(checkTemplate("{{! comment}}").problem?.code).toBe("notPlain");
  });

  it("rejects a helper call", () => {
    expect(checkTemplate("{{formatDate content.mediaId}}").problem?.code).toBe("helperCall");
  });

  it("rejects the unescaped triple-stash", () => {
    expect(checkTemplate("{{{content.mediaId}}}").problem?.code).toBe("unescaped");
  });

  it("rejects an unclosed or empty stash", () => {
    expect(checkTemplate("{{content.mediaId").problem?.code).toBe("unclosed");
    expect(checkTemplate("{{}}").problem?.code).toBe("empty");
  });

  it("rejects an unknown root and names the allowed ones", () => {
    const check = checkTemplate("{{nope.field}}");
    expect(check.problem?.code).toBe("unknownRoot");
    expect(check.problem?.params?.root).toBe("nope");
    expect(check.problem?.params?.roots).toContain("content");
  });

  it("rejects a bare root — a whole object would stringify into the payload", () => {
    const check = checkTemplate("{{task}}");
    expect(check.problem?.code).toBe("wholeObject");
    expect(check.problem?.params?.path).toBe("task");
  });

  it("rejects malformed paths and unsupported characters", () => {
    expect(checkTemplate("{{content..mediaId}}").problem?.code).toBe("badPath");
    expect(checkTemplate("{{.mediaId}}").problem?.code).toBe("badPath");
    expect(checkTemplate("{{content.}}").problem?.code).toBe("badPath");
    const dashed = checkTemplate("{{content.media-id}}");
    expect(dashed.problem?.code).toBe("badChar");
    expect(dashed.problem?.params?.char).toBe("-");
  });

  it("still allows review.* — the server accepts the root even though nothing fills it", () => {
    expect(checkTemplate("{{review.verdict}}").status).toBe("valid");
  });
});
