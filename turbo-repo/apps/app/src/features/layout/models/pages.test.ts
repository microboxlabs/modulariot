import { describe, expect, it } from "vitest";

import { filterSettings, pages, visiblePages, DEV_PAGE_LABEL } from "./pages";

function settingsHrefs(input: ReturnType<typeof visiblePages>): string[] {
  const settings = input.find((page) => page.label === "settings");
  return (settings?.items ?? []).map((item) => item.href ?? "");
}

describe("visiblePages", () => {
  it("hides the Dev section unless dev tools are on", () => {
    expect(visiblePages(false).some((p) => p.label === DEV_PAGE_LABEL)).toBe(
      false,
    );
    expect(visiblePages(true).some((p) => p.label === DEV_PAGE_LABEL)).toBe(
      true,
    );
  });
});

describe("filterSettings", () => {
  it("hides Platform from anyone who does not hold PLATFORM_OWNER", () => {
    const filtered = filterSettings(pages, {
      harness: true,
      platformOwner: false,
    });

    expect(settingsHrefs(filtered)).not.toContain("/users/settings/platform");
    expect(settingsHrefs(filtered)).toContain("/users/settings/harness");
  });

  it("hides Harness when its deployment flag is off", () => {
    const filtered = filterSettings(pages, {
      harness: false,
      platformOwner: true,
    });

    expect(settingsHrefs(filtered)).not.toContain("/users/settings/harness");
    expect(settingsHrefs(filtered)).toContain("/users/settings/platform");
  });

  it("hides both when neither gate is open", () => {
    const filtered = filterSettings(pages, {
      harness: false,
      platformOwner: false,
    });

    expect(settingsHrefs(filtered)).toEqual([
      "/users/settings/organizations",
      "/users/settings/data-sources",
      "/users/settings/credentials",
      "/users/settings/connections",
    ]);
  });

  it("puts Platform above Organizations", () => {
    const hrefs = settingsHrefs(pages);

    expect(hrefs.indexOf("/users/settings/platform")).toBe(0);
    expect(hrefs.indexOf("/users/settings/platform")).toBeLessThan(
      hrefs.indexOf("/users/settings/organizations")
    );
  });

  it("leaves every entry in place when both gates are open", () => {
    const filtered = filterSettings(pages, {
      harness: true,
      platformOwner: true,
    });

    expect(settingsHrefs(filtered)).toEqual(settingsHrefs(pages));
  });

  it("touches no page outside Settings", () => {
    const filtered = filterSettings(pages, {
      harness: false,
      platformOwner: false,
    });

    expect(filtered.map((page) => page.label)).toEqual(
      pages.map((page) => page.label),
    );
  });
});
