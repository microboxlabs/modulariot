import { beforeEach, describe, expect, it, vi } from "vitest";
import DataSourcesPage from "./page";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getUserSites: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "accept-language": "en" }),
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock(
  "@/features/common/providers/alfresco-api/alfresco-api.provider",
  () => ({
    getUserSites: mocks.getUserSites,
  })
);
vi.mock("@/features/i18n/i18n.service", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getDictionary: async () => [undefined, { pages: { userSettings: {} } }],
}));
vi.mock("@/features/auth/components/route-guard", () => ({
  RouteGuard: () => null,
}));
vi.mock("@/features/data-sources/components/data-sources-page-content", () => ({
  default: () => null,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "u1" } });
});

describe("data sources page redirects", () => {
  it.each([
    [
      "the user has no Alfresco site",
      () => mocks.getUserSites.mockResolvedValue([]),
      "/en/shipping",
    ],
    [
      "Alfresco answers 401",
      () => mocks.getUserSites.mockRejectedValue({ status: 401 }),
      "/en/sign-in",
    ],
  ])("redirects when %s", async (_case, arrange, destination) => {
    arrange();

    await expect(
      DataSourcesPage({ params: Promise.resolve({ lang: "en" }) })
    ).rejects.toThrow(`redirect:${destination}`);
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith(destination);
  });
});
