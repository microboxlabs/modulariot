import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { freeSlug, useExplorerServer } from "./use-explorer-server";

const api = vi.hoisted(() => ({
  dashboards: [] as { slug: string; name: string; folderId?: string }[],
  stars: new Set<string>(),
  save: vi.fn(),
  remove: vi.fn(),
  file: vi.fn(),
  star: vi.fn(),
}));
vi.mock(
  "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes",
  () => ({
    useOrgScopes: () => ({ activeOrg: { slug: "acme" } }),
  })
);
vi.mock(
  "@/features/dashboard/services/dashboard-server-client",
  async (original) => ({
    ...(await original<object>()),
    createDashboardServerClient: () => ({
      scopeKey: ["capabilities", "acme"],
      scopeCapabilities: async () => ({ canCreate: true }),
      save: api.save,
      remove: api.remove,
      load: async () => ({
        config: {
          version: 2,
          name: "Report",
          widgets: [],
          preferences: { editMode: false },
        },
        etag: '"1"',
      }),
    }),
  })
);
vi.mock("@/features/dashboard/services/dashboard-folder-client", () => ({
  createDashboardFolderClient: () => ({
    key: ["dashboard-explorer", "acme"],
    listFolders: async () => [],
    listDashboards: async () => [...api.dashboards],
    listStars: async () => [...api.stars],
    listRecents: async () => [],
    setStarred: api.star,
    fileDashboard: api.file,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  api.dashboards = [
    { slug: "sales", name: "Sales" },
    { slug: "fleet", name: "Fleet" },
  ];
  api.stars = new Set();
  api.save.mockImplementation(
    async (slug: string, config: { name: string }) => {
      api.dashboards.push({ slug, name: config.name });
    }
  );
  api.remove.mockImplementation(async (slug: string) => {
    api.dashboards = api.dashboards.filter(
      (dashboard) => dashboard.slug !== slug
    );
  });
  api.file.mockResolvedValue(undefined);
  api.star.mockImplementation(async (slug: string) => {
    api.stars.add(slug);
  });
});

async function mount() {
  const cache = new Map();
  const wrapper = ({ children }: PropsWithChildren) => (
    <SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );
  const hook = renderHook(useExplorerServer, { wrapper });
  await waitFor(() => expect(hook.result.current.sources).toHaveLength(2));
  return hook;
}

describe("explorer server mutations", () => {
  it("serializes overlapping stars and retains both changes", async () => {
    const { result } = await mount();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    api.star.mockImplementationOnce(async (slug: string) => {
      await pending;
      api.stars.add(slug);
    });
    let first!: Promise<void>, second!: Promise<void>;
    act(() => {
      first = result.current.setStarred("/dashboards/sales", true);
      second = result.current.setStarred("/dashboards/fleet", true);
    });
    await waitFor(() => expect(api.star).toHaveBeenCalledTimes(1));
    await act(async () => {
      release();
      await Promise.all([first, second]);
    });
    await waitFor(() =>
      expect(result.current.sources.every((source) => source.starred)).toBe(
        true
      )
    );
  });

  it("allocates each copy from the latest snapshot in a batch", async () => {
    const { result } = await mount();
    const copy = result.current.copyDashboard;
    await act(async () => {
      await copy("/dashboards/sales", "Report", "first");
      await copy("/dashboards/fleet", "Report", "second");
    });
    expect(api.save.mock.calls.map(([slug]) => slug)).toEqual([
      "report",
      "report-1",
    ]);
  });

  it("removes a newly saved dashboard when filing it fails", async () => {
    const { result } = await mount();
    api.file.mockRejectedValueOnce(new Error("Forbidden"));
    await act(async () => {
      await expect(
        result.current.createDashboard("Report", "locked")
      ).rejects.toThrow("Forbidden");
    });
    expect(api.remove).toHaveBeenCalledWith("report");
    expect(api.dashboards).toHaveLength(2);
    expect(result.current.sources).toHaveLength(2);
  });

  it("refreshes the list if cleanup also fails", async () => {
    const { result } = await mount();
    api.file.mockRejectedValueOnce(new Error("Forbidden"));
    api.remove.mockRejectedValueOnce(new Error("Unavailable"));
    await act(async () => {
      await expect(
        result.current.createDashboard("Report", "locked")
      ).rejects.toThrow("Forbidden");
    });
    await waitFor(() => expect(result.current.sources).toHaveLength(3));
  });
});

describe("freeSlug", () => {
  it("reserves suffix space for long and colliding names", () => {
    const base = "a".repeat(80);
    const first = `${"a".repeat(78)}-1`;
    const next = freeSlug(base, new Set([base, first]));
    expect(next).toBe(`${"a".repeat(78)}-2`);
    expect(next).toHaveLength(80);
  });
});
