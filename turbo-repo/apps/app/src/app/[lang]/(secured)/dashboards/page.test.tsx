import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/features/i18n/i18n.service", () => ({
  getDictionary: vi.fn(async () => [{}, {}]),
}));
vi.mock("@/features/dashboard/components/server-dashboards-page", () => ({
  ServerDashboardsPage: () => null,
}));

async function loadPages() {
  vi.resetModules();
  const list = await import("./page");
  const detail = await import("./[slug]/page");
  return { list: list.default, detail: detail.default };
}

const listParams = { params: Promise.resolve({ lang: "en" }) };
const detailParams = { params: Promise.resolve({ lang: "en", slug: "sales" }) };

describe("dashboard workspace pages", () => {
  beforeEach(() => {
    notFound.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([undefined, "false", "1"])(
    "return 404 when ENABLE_DASHBOARD_SERVER is %s",
    async (value) => {
      vi.stubEnv("ENABLE_DASHBOARD_SERVER", value);
      const { list, detail } = await loadPages();

      await expect(list(listParams)).rejects.toThrow("NEXT_NOT_FOUND");
      await expect(detail(detailParams)).rejects.toThrow("NEXT_NOT_FOUND");
      expect(notFound).toHaveBeenCalledTimes(2);
    }
  );

  it("render when ENABLE_DASHBOARD_SERVER is true", async () => {
    vi.stubEnv("ENABLE_DASHBOARD_SERVER", "true");
    const { list, detail } = await loadPages();

    await expect(list(listParams)).resolves.toBeTruthy();
    await expect(detail(detailParams)).resolves.toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
  });
});
