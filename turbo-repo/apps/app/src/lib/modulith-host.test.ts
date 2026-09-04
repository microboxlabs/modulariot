import { afterEach, describe, expect, it, vi } from "vitest";
import { isModulithConfigured, modulithHost } from "./modulith-host";

describe("modulithHost", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns MIOT_MODULITH_URL when set", () => {
    vi.stubEnv("MIOT_MODULITH_URL", "http://modulith:8180");

    expect(modulithHost()).toBe("http://modulith:8180");
    expect(isModulithConfigured()).toBe(true);
  });

  it("returns empty when unset, rather than throwing", () => {
    vi.stubEnv("MIOT_MODULITH_URL", "");

    expect(modulithHost()).toBe("");
    expect(isModulithConfigured()).toBe(false);
  });
});
