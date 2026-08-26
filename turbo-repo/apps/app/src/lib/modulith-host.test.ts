import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));

import { logger } from "@/lib/logger";

/**
 * The helper warns only once per process, so each test imports a fresh copy
 * of the module rather than sharing that latched flag.
 */
async function freshModule() {
  vi.resetModules();
  return import("./modulith-host");
}

describe("modulithHost", () => {
  beforeEach(() => {
    vi.mocked(logger.warn).mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns MIOT_MODULITH_URL when set", async () => {
    vi.stubEnv("MIOT_MODULITH_URL", "http://modulith:8180");
    const { modulithHost } = await freshModule();

    expect(modulithHost()).toBe("http://modulith:8180");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("falls back to the deprecated MIOT_HARNESS_URL so unmigrated environments keep working", async () => {
    vi.stubEnv("MIOT_MODULITH_URL", "");
    vi.stubEnv("MIOT_HARNESS_URL", "http://legacy:8180");
    const { modulithHost } = await freshModule();

    expect(modulithHost()).toBe("http://legacy:8180");
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it("prefers the current name when both are set", async () => {
    vi.stubEnv("MIOT_MODULITH_URL", "http://modulith:8180");
    vi.stubEnv("MIOT_HARNESS_URL", "http://legacy:8180");
    const { modulithHost } = await freshModule();

    expect(modulithHost()).toBe("http://modulith:8180");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("warns once, not on every call", async () => {
    vi.stubEnv("MIOT_MODULITH_URL", "");
    vi.stubEnv("MIOT_HARNESS_URL", "http://legacy:8180");
    const { modulithHost } = await freshModule();

    modulithHost();
    modulithHost();
    modulithHost();

    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it("returns empty when neither is set, rather than throwing", async () => {
    vi.stubEnv("MIOT_MODULITH_URL", "");
    vi.stubEnv("MIOT_HARNESS_URL", "");
    const { modulithHost, isModulithConfigured } = await freshModule();

    expect(modulithHost()).toBe("");
    expect(isModulithConfigured()).toBe(false);
  });

  it("reports configured for either name", async () => {
    vi.stubEnv("MIOT_MODULITH_URL", "");
    vi.stubEnv("MIOT_HARNESS_URL", "http://legacy:8180");
    const { isModulithConfigured } = await freshModule();

    expect(isModulithConfigured()).toBe(true);
  });
});
