import { describe, expect, it } from "vitest";
import { withLocale } from "./utils";

describe("withLocale", () => {
  it.each([
    ["/finished", "es", "/es/finished"],
    ["/finished", "en", "/en/finished"],
    ["/mytasks?status=pending", "es", "/es/mytasks?status=pending"],
    ["/shipping#lane", "en", "/en/shipping#lane"],
    ["/users/settings/team", "en", "/en/users/settings/team"],
    ["/english", "es", "/es/english"],
  ])("prefixes %s with %s", (href, lang, expected) => {
    expect(withLocale(href, lang)).toBe(expected);
  });

  it.each([
    "/es/finished",
    "/en/shipping?serviceType=CARGA",
    "/en",
    "/es?x=1",
    "/es#top",
    "#",
    "https://example.com/finished",
    "//example.com/finished",
    "mailto:someone@example.com",
    "relative/path",
  ])("leaves %s unchanged", (href) => {
    expect(withLocale(href, "en")).toBe(href);
  });

  it("leaves the href unchanged without a locale", () => {
    expect(withLocale("/finished", undefined)).toBe("/finished");
  });
});
