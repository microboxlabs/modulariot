import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/utils/streamhub-modulith-proxy", () => ({
  forwardToStreamhubModulith: vi.fn(),
}));
vi.mock("@/app/api/utils/tenant-scope", () => ({
  resolveTenantScope: vi.fn(),
}));

import { isoDate } from "./control-tower-map";

describe("isoDate", () => {
  it("reads a space between date and time as the ISO T", () => {
    expect(isoDate("2026-10-15 00:00:00")).toBe("2026-10-15T00:00:00");
    expect(isoDate(" 2026-10-15 23:59:59-03:00 ")).toBe(
      "2026-10-15T23:59:59-03:00"
    );
  });

  it("leaves ISO dates and other values unchanged", () => {
    expect(isoDate("2026-10-15T00:00:00Z")).toBe("2026-10-15T00:00:00Z");
    expect(isoDate("2026-10-15")).toBe("2026-10-15");
    expect(isoDate("yesterday")).toBe("yesterday");
  });
});
