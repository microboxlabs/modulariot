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
    // The features built on this host degrade on an empty string (search and
    // chat disable themselves, telemetry no-ops), so an unconfigured
    // environment has to reach them as "" and not an exception.
    vi.stubEnv("MIOT_MODULITH_URL", "");

    expect(modulithHost()).toBe("");
    expect(isModulithConfigured()).toBe(false);
  });
});
