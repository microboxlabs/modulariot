import { describe, expect, it } from "vitest";

import {
  checkHomeUrl,
  checkLogoFile,
  MAX_LOGO_BYTES,
  readLogoDataUrl,
} from "./domain-branding-form";

describe("checkLogoFile", () => {
  it.each(["image/svg+xml", "image/png", "image/jpeg", "image/webp"])(
    "accepts %s, matching LogoImage.ALLOWED_MIMES",
    (type) => {
      expect(checkLogoFile({ type, size: 1024 })).toBeNull();
    },
  );

  it("ignores the case and surrounding space a browser may report", () => {
    expect(checkLogoFile({ type: " IMAGE/PNG ", size: 10 })).toBeNull();
  });

  it.each([
    ["application/pdf", 1024, "type"],
    ["", 1024, "type"],
    ["image/png", 0, "empty"],
    ["image/png", MAX_LOGO_BYTES + 1, "size"],
  ])("rejects %s of %i bytes as %s", (type, size, expected) => {
    expect(checkLogoFile({ type, size })).toBe(expected);
  });

  it("accepts a file of exactly the cap", () => {
    expect(checkLogoFile({ type: "image/png", size: MAX_LOGO_BYTES })).toBeNull();
  });
});

describe("checkHomeUrl", () => {
  it.each(["", "   "])("accepts a blank value (%s), leaving the logo unlinked", (value) => {
    expect(checkHomeUrl(value)).toBeNull();
  });

  it.each(["https://www.example.com/", "http://example.test/home?x=1"])(
    "accepts %s",
    (value) => {
      expect(checkHomeUrl(value)).toBeNull();
    },
  );

  it("rejects a javascript: URL, which would run on the sign-in page", () => {
    expect(checkHomeUrl("javascript:alert(1)")).toBe("scheme");
  });

  it("rejects embedded credentials, which disguise the real host", () => {
    expect(checkHomeUrl("https://www.trusted.example@evil.example")).toBe(
      "userInfo",
    );
  });

  it("rejects a value that is not a URL at all", () => {
    expect(checkHomeUrl("www.example.com")).toBe("malformed");
  });

  it("rejects a value over HomeUrl.MAX_LENGTH", () => {
    expect(checkHomeUrl(`https://example.test/${"a".repeat(2048)}`)).toBe(
      "length",
    );
  });
});

describe("readLogoDataUrl", () => {
  it("produces the base64 data: URL LogoImage.fromDataUrl accepts", async () => {
    const blob = new Blob(["<svg/>"], { type: "image/svg+xml" });

    const dataUrl = await readLogoDataUrl(blob);

    expect(dataUrl).toBe(
      `data:image/svg+xml;base64,${btoa("<svg/>")}`,
    );
  });
});
