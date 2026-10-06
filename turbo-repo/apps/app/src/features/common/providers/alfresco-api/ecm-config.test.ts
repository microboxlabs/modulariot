import { afterEach, describe, expect, it, vi } from "vitest";
import { homePath, isEcmConfigured } from "./ecm-config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ecm-config", () => {
  it("lands on the kanban with Alfresco", () => {
    vi.stubEnv("ECM_API_URL", "https://ecm.example.test");
    vi.stubEnv("APP_HOME_PATH", "");
    expect(isEcmConfigured()).toBe(true);
    expect(homePath()).toBe("/shipping");
  });

  it("lands on the control tower without Alfresco", () => {
    vi.stubEnv("ECM_API_URL", " ");
    vi.stubEnv("APP_HOME_PATH", "");
    expect(isEcmConfigured()).toBe(false);
    expect(homePath()).toBe("/symptoms");
  });

  it("APP_HOME_PATH wins", () => {
    vi.stubEnv("ECM_API_URL", "");
    vi.stubEnv("APP_HOME_PATH", "/integrations");
    expect(homePath()).toBe("/integrations");
  });
});
