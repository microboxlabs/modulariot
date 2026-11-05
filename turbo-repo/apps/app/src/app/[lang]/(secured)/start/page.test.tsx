import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StartPage from "./page";

const mocks = vi.hoisted(() => ({
  currentPermissions: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/features/auth/access/server-access", () => ({
  currentPermissions: mocks.currentPermissions,
}));
vi.mock("@/features/common/providers/alfresco-api/ecm-config", () => ({
  homePath: () => "/home",
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.currentPermissions.mockResolvedValue(["dashboards:view"]);
  vi.stubEnv("BOARD_MODULE", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("sign-in landing with dashboard deployment settings", () => {
  it.each([
    ["server", "true", "/dashboards"],
    ["server", "false", "/no-access"],
    ["legacy", "true", "/home"],
    ["", "true", "/home"],
  ])(
    "%s with server=%s redirects to %s",
    async (module, enabled, destination) => {
      vi.stubEnv("DASHBOARD_MODULE", module);
      vi.stubEnv("ENABLE_DASHBOARD_SERVER", enabled);

      await expect(
        StartPage({ params: Promise.resolve({ lang: "es" }) })
      ).rejects.toThrow(`redirect:/es${destination}`);
      expect(mocks.redirect).toHaveBeenCalledWith(`/es${destination}`);
    }
  );
});
