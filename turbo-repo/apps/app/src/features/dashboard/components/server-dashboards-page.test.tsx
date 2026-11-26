import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PropsWithChildren, ReactNode } from "react";
import type { DashboardSettingsHost } from "./dashboard-settings-dropdown/dashboard-settings-dropdown";
import type { DashboardStorageSchema } from "../types/dashboard.types";
import { ServerDashboardsPage } from "./server-dashboards-page";
import { DEFAULT_STORAGE } from "../types/dashboard.types";
import { resetExplorerLayout } from "./dashboard-explorer/explorer-store";

const { notify } = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock("@/features/notifications/notification", () => ({
  ShowNotification: notify,
}));
const state = vi.hoisted(() => ({
  userId: "test-user",
  authenticated: true,
  canEdit: false,
  orgRole: undefined as string | undefined,
  scopeFailure: false,
  /** The organization itself could not be read. */
  orgError: false,
  refreshOrg: vi.fn(async () => undefined),
  missing: false,
  /** The dashboard itself could not be read. */
  documentFailure: false,
  push: vi.fn(),
  host: undefined as DashboardSettingsHost | undefined,
  breadcrumbRoot: undefined as string | undefined,
  breadcrumbRootHref: undefined as string | undefined,
  breadcrumbFolders: undefined as
    | readonly { name: string; href: string }[]
    | undefined,
  storage: undefined as
    | {
        config: DashboardStorageSchema;
        onChange: (c: DashboardStorageSchema) => void;
      }
    | undefined,
}));
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    status: state.authenticated ? "authenticated" : "unauthenticated",
    data: { user: { id: state.userId } },
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: state.push }),
  useParams: () => ({ lang: "en" }),
  usePathname: () => "/en/dashboards",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock(
  "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes",
  () => ({
    useOrgScopes: () => ({
      activeOrg: {
        slug: "acme",
        role:
          state.orgRole ?? (state.canEdit ? "SITE_MANAGER" : "SITE_CONSUMER"),
      },
      isLoading: false,
      error: state.orgError ? new Error("503") : null,
      refresh: state.refreshOrg,
    }),
  })
);
vi.mock("../context/dashboard-context", () => ({
  DashboardProvider: ({
    children,
    storage,
  }: Readonly<PropsWithChildren<{ storage: typeof state.storage }>>) => {
    state.storage = storage;
    return children;
  },
  useDashboard: () => ({ queries: [], setQueries: () => true }),
}));
vi.mock("../context/saved-query-context", () => ({
  DashboardQuerySession: ({ children }: Readonly<PropsWithChildren>) =>
    children,
  SavedQueryResults: ({ children }: Readonly<PropsWithChildren>) => children,
}));
vi.mock("./dashboard-view", () => ({
  DashboardView: ({
    headerActions,
    settingsHost,
    breadcrumbRoot,
    breadcrumbRootHref,
    breadcrumbFolders,
  }: Readonly<{
    headerActions?: ReactNode;
    settingsHost?: DashboardSettingsHost;
    breadcrumbRoot?: string;
    breadcrumbRootHref?: string;
    breadcrumbFolders?: readonly { name: string; href: string }[];
  }>) => {
    state.host = settingsHost;
    state.breadcrumbRoot = breadcrumbRoot;
    state.breadcrumbRootHref = breadcrumbRootHref;
    state.breadcrumbFolders = breadcrumbFolders;
    return (
      <div>
        Widget canvas
        {headerActions}
      </div>
    );
  },
}));
const dictionary = {
  dashboard: {
    server: {
      title: "Dashboards",
      name: "Dashboard name",
      save: "Save",
      delete: "Delete",
      reload: "Reload",
      loading: "Loading",
      loadError: "Dashboards unavailable",
      loadErrorBody: "Check your connection.",
      retry: "Try again",
      openError: "Dashboard unavailable",
      openErrorBody: "Try again later.",
      missing: "Dashboard not found",
      missingBody: "It may have been deleted.",
      backToList: "Back to dashboards",
      unsaved: "Unsaved changes",
      saving: "Saving…",
      newName: "New dashboard",
      empty: "No dashboards yet",
    },
    explorer: {
      title: "Dashboards",
      description: "Organize your dashboards",
      search: "Search",
      new: "New",
      name: "Name",
      newFile: "New dashboard",
      newFolder: "New folder",
      untitledFile: "Untitled dashboard",
      untitledFolder: "Untitled folder",
      namePlaceholder: "Type a name",
      columns: {
        tags: "Tags",
        filterTags: "Filter by tag",
        clearFilter: "Clear filter",
        noTags: "No tags yet",
        starredOnly: "Show starred only",
        star: "Star",
        unstar: "Unstar",
      },
      empty: "Nothing here yet",
      noResults: "No matches",
      loading: "Loading",
      loadError: "Couldn't load",
      errors: {
        forbidden: "Not allowed",
        conflict: "Name taken",
        generic: "Could not save",
      },
    },
  },
};
const fetcher = vi.fn<typeof fetch>();
let folders: { id: string; name: string; parentId: string | null }[] = [];
let stars: string[] = [];
beforeEach(() => {
  notify.mockReset();
  resetExplorerLayout();
  folders = [];
  stars = [];
  state.userId = "test-user";
  state.authenticated = true;
  state.canEdit = false;
  state.orgRole = undefined;
  state.missing = false;
  state.documentFailure = false;
  state.orgError = false;
  state.refreshOrg.mockClear();
  state.scopeFailure = false;
  state.push.mockReset();
  state.host = undefined;
  state.storage = undefined;
  fetcher.mockReset();
  fetcher.mockImplementation(async (input, init) => {
    if (String(input).includes("/dashboard-stars"))
      return Response.json({ data: stars });
    if (String(input).includes("/dashboard-recents"))
      return Response.json({ data: [] });
    if (String(input).includes("/open?"))
      return new Response(null, { status: 204 });
    if (String(input).includes("/star?"))
      return new Response(null, { status: 204 });
    if (String(input).includes("/dashboard-folders"))
      return init?.method === "POST"
        ? Response.json({
            data: {
              id: "f9",
              parentId: null,
              ...JSON.parse(String(init.body)),
            },
          })
        : Response.json({ data: folders });
    if (init?.method === "PUT")
      return Response.json(
        { data: { revision: 8, updatedAt: "now" } },
        { headers: { ETag: '"8"' } }
      );
    if (String(input).includes("/dashboard-capabilities?"))
      return state.scopeFailure
        ? new Response(null, { status: 503 })
        : Response.json({ canCreate: state.canEdit });
    if (String(input).includes("capabilities"))
      return Response.json({
        readOnly: !state.canEdit,
        canEdit: state.canEdit,
        canManagePermissions: state.canEdit,
        canDelete: state.canEdit,
        canShare: state.canEdit,
      });
    if (String(input).includes("/fleet?") && state.documentFailure)
      return new Response(null, { status: 503 });
    if (String(input).includes("/fleet?"))
      return Response.json(
        { data: state.missing ? null : { ...DEFAULT_STORAGE, name: "Fleet" } },
        { headers: { ETag: '"7"' } }
      );
    return Response.json({ data: [{ slug: "fleet", name: "Fleet" }] });
  });
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => vi.unstubAllGlobals());
function show(slug?: string) {
  render(
    <SWRConfig
      value={{
        provider: () => new Map(),
        dedupingInterval: 0,
        focusThrottleInterval: 0,
      }}
    >
      <ServerDashboardsPage dictionary={dictionary} lang="en" slug={slug} />
    </SWRConfig>
  );
}

type User = ReturnType<typeof userEvent.setup>;

/** Opens the "New" menu; the item is enabled once the scope is known. */
async function newMenuItem(user: User, name: string) {
  await user.click(screen.getByRole("button", { name: "New" }));
  return screen.getByRole("menuitem", { name });
}

describe("parallel dashboard pages", () => {
  it("discards cached lists when the authenticated identity changes", async () => {
    const page = render(
      <ServerDashboardsPage dictionary={dictionary} lang="en" />
    );
    await screen.findByRole("link", { name: "Fleet" });
    state.userId = "another-user";
    fetcher.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/dashboard-capabilities"))
        return Response.json({ canCreate: false });
      if (
        url.includes("/dashboard-folders") ||
        url.includes("/dashboard-stars")
      )
        return Response.json({ data: [] });
      return Response.json({
        data: [{ slug: "other", name: "Other account" }],
      });
    });
    page.rerender(<ServerDashboardsPage dictionary={dictionary} lang="en" />);
    expect(
      screen.queryByRole("link", { name: "Fleet" })
    ).not.toBeInTheDocument();
    await screen.findByRole("link", { name: "Other account" });
    state.authenticated = false;
    page.rerender(<ServerDashboardsPage dictionary={dictionary} lang="en" />);
    expect(
      screen.queryByRole("link", { name: "Other account" })
    ).not.toBeInTheDocument();
  });

  it("lists the organization's dashboards and folders as a page", async () => {
    folders = [{ id: "f1", name: "Operations", parentId: null }];
    show();
    // Title, description and the "New" menu beside them, as on settings.
    expect(
      screen.getByRole("heading", { name: "Dashboards" })
    ).toBeInTheDocument();
    expect(screen.getByText("Organize your dashboards")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Fleet" })).toHaveAttribute(
      "href",
      "/en/dashboards/fleet"
    );
    expect(
      screen.getByRole("treeitem", { name: /Operations/ })
    ).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith(
      "/app/api/dashboards?org=acme",
      expect.any(Object)
    );
    expect(fetcher).toHaveBeenCalledWith(
      "/app/api/dashboard-folders?org=acme",
      expect.any(Object)
    );
  });

  it("stars a dashboard through the app's own route", async () => {
    stars = ["fleet"];
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole("button", { name: "Unstar" }));
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(([, init]) => init?.method === "DELETE")
      ).toBe(true)
    );
    const call = fetcher.mock.calls.find(
      ([, init]) => init?.method === "DELETE"
    );
    expect(call?.[0]).toBe("/app/api/dashboards/fleet/star?org=acme");
  });

  it.each(["OWNER", "MEMBER"])(
    "uses server permission to offer creation for %s",
    async (role) => {
      state.orgRole = role;
      state.canEdit = true;
      const user = userEvent.setup();
      show();
      await screen.findByRole("link", { name: "Fleet" });
      await newMenuItem(user, "New dashboard");
      await waitFor(() =>
        expect(
          screen.getByRole("menuitem", { name: "New dashboard" })
        ).toBeEnabled()
      );
    }
  );

  it.each(["OWNER", "MEMBER", "unknown"])(
    "respects server creation denial for %s",
    async (role) => {
      state.orgRole = role;
      const user = userEvent.setup();
      show();
      await screen.findByRole("link", { name: "Fleet" });
      expect(await newMenuItem(user, "New dashboard")).toBeDisabled();
      expect(
        screen.getByRole("menuitem", { name: "New folder" })
      ).toBeEnabled();
    }
  );

  it("does not fall back to the application role when permission lookup fails", async () => {
    state.orgRole = "OWNER";
    state.scopeFailure = true;
    const user = userEvent.setup();
    show();
    expect(
      await screen.findByRole("link", { name: "Fleet" })
    ).toBeInTheDocument();
    expect(await newMenuItem(user, "New dashboard")).toBeDisabled();
  });

  it("creates a dashboard with a zero-revision precondition and opens it", async () => {
    state.orgRole = "MEMBER";
    state.canEdit = true;
    const user = userEvent.setup();
    show();
    await screen.findByRole("link", { name: "Fleet" });
    const create = await newMenuItem(user, "New dashboard");
    await waitFor(() =>
      expect(
        screen.getByRole("menuitem", { name: "New dashboard" })
      ).toBeEnabled()
    );
    await user.click(create);
    await user.keyboard("Demo Validación{Enter}");
    await waitFor(() =>
      expect(state.push).toHaveBeenCalledWith("/en/dashboards/demo-validacion")
    );
    const write = fetcher.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(write?.[0]).toBe("/app/api/dashboards/demo-validacion?org=acme");
    expect(write?.[1]?.headers).toMatchObject({ "if-match": '"0"' });
    expect(JSON.parse(String(write?.[1]?.body))).toMatchObject({
      name: "Demo Validación",
      // Created into its setup; see `started` in the contract.
      started: false,
      // Kept to who its creator names until they open it up.
      visibility: "restricted",
    });
  });

  it("gives a new dashboard a free id when its name is taken", async () => {
    state.canEdit = true;
    const user = userEvent.setup();
    show();
    await screen.findByRole("link", { name: "Fleet" });
    const create = await newMenuItem(user, "New dashboard");
    await waitFor(() =>
      expect(
        screen.getByRole("menuitem", { name: "New dashboard" })
      ).toBeEnabled()
    );
    await user.click(create);
    await user.keyboard("fleet{Enter}");
    await waitFor(() => expect(state.push).toHaveBeenCalled());
    const write = fetcher.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(write?.[0]).toBe("/app/api/dashboards/fleet-1?org=acme");
  });

  it("says so when the server refuses the new dashboard", async () => {
    state.canEdit = true;
    const user = userEvent.setup();
    show();
    await screen.findByRole("link", { name: "Fleet" });
    const create = await newMenuItem(user, "New dashboard");
    await waitFor(() =>
      expect(
        screen.getByRole("menuitem", { name: "New dashboard" })
      ).toBeEnabled()
    );
    fetcher.mockImplementationOnce(
      async () => new Response(null, { status: 409 })
    );
    await user.click(create);
    await user.keyboard("Demo{Enter}");
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith({
        type: "error",
        message: "Name taken",
      })
    );
    expect(state.push).not.toHaveBeenCalled();
  });

  it("creates a folder on the server", async () => {
    const user = userEvent.setup();
    show();
    await screen.findByRole("link", { name: "Fleet" });
    await user.click(await newMenuItem(user, "New folder"));
    await user.keyboard("Reports{Enter}");
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(([, init]) => init?.method === "POST")
      ).toBe(true)
    );
    const write = fetcher.mock.calls.find(
      ([, init]) => init?.method === "POST"
    );
    expect(write?.[0]).toBe("/app/api/dashboard-folders?org=acme");
    expect(JSON.parse(String(write?.[1]?.body))).toEqual({
      name: "Reports",
      parentId: null,
    });
  });

  it("shows the shape of the dashboard while it loads", async () => {
    show("fleet");
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    // Said to screen readers only.
    expect(screen.getByText("Loading")).toHaveClass("sr-only");
    expect(await screen.findByText("Widget canvas")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it('puts the dashboard under "Dashboards" in its breadcrumb', async () => {
    show("fleet");
    await screen.findByText("Widget canvas");
    expect(state.breadcrumbRoot).toBe("dashboardServer");
    // A way back to the list, even from a new dashboard's setup.
    expect(state.breadcrumbRootHref).toMatch(/^\/[a-z]+\/dashboards$/);
  });

  it('puts the folders it is filed in between "Dashboards" and its name', async () => {
    folders = [
      { id: "ops", name: "Ops", parentId: null },
      { id: "daily", name: "Daily", parentId: "ops" },
    ];
    const answer = fetcher.getMockImplementation()!;
    fetcher.mockImplementation(async (input, init) =>
      /\/api\/dashboards\?/.test(String(input))
        ? Response.json({
            data: [{ slug: "fleet", name: "Fleet", folderId: "daily" }],
          })
        : answer(input, init)
    );
    show("fleet");
    await screen.findByText("Widget canvas");
    await waitFor(() =>
      expect(state.breadcrumbFolders?.map((folder) => folder.name)).toEqual([
        "Ops",
        "Daily",
      ])
    );
    expect(state.breadcrumbFolders?.[1]?.href).toMatch(
      /\/dashboards\?folder=daily$/
    );
  });

  it("renders Consumers without edit or delete controls", async () => {
    show("fleet");
    expect(await screen.findByText("Widget canvas")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(state.host?.onDelete).toBeUndefined();
    expect(state.host?.canManagePermissions).toBe(false);
    // Only this dashboard, and reading where it is filed for the breadcrumb.
    expect(
      fetcher.mock.calls.every(
        ([url, init]) =>
          String(url).startsWith("/app/api/dashboards/fleet") ||
          ((init?.method ?? "GET") === "GET" &&
            /^\/app\/api\/(dashboard-folders|dashboards)\?/.test(String(url)))
      )
    ).toBe(true);
  });
  it("saves Editor changes on its own with the loaded revision", async () => {
    state.canEdit = true;
    show("fleet");
    await screen.findByText("Widget canvas");
    act(() =>
      state.storage!.onChange({ ...state.storage!.config, name: "Changed" })
    );
    expect(await screen.findByText("Saving…")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save" })
    ).not.toBeInTheDocument();
    await waitFor(
      () => expect(screen.queryByText("Saving…")).not.toBeInTheDocument(),
      { timeout: 4000 }
    );
    const write = fetcher.mock.calls.find(
      ([input, init]) =>
        init?.method === "PUT" && !String(input).includes("/open")
    );
    expect(write?.[0]).toBe("/app/api/dashboards/fleet?org=acme");
    expect(write?.[1]?.headers).toMatchObject({ "if-match": '"7"' });
    expect(JSON.parse(String(write?.[1]?.body)).name).toBe("Changed");
  });
  it("deletes through the dashboard server from the settings menu", async () => {
    state.canEdit = true;
    show("fleet");
    await screen.findByText("Widget canvas");
    expect(state.host?.canManagePermissions).toBe(true);
    await act(() => state.host!.onDelete!());
    const removal = fetcher.mock.calls.find(
      ([, init]) => init?.method === "DELETE"
    );
    expect(removal?.[0]).toBe("/app/api/dashboards/fleet?org=acme");
    expect(state.push).toHaveBeenCalledWith("/en/dashboards");
  });
  it("notes the open for the caller's recents once the dashboard loads", async () => {
    show("fleet");
    await screen.findByText("Widget canvas");
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(
          ([input, init]) =>
            input === "/app/api/dashboards/fleet/open?org=acme" &&
            init?.method === "PUT"
        )
      ).toBe(true)
    );
  });
  it("does not note an open for a missing dashboard", async () => {
    state.missing = true;
    show("fleet");
    await screen.findByRole("alert");
    expect(
      fetcher.mock.calls.some(([input]) => String(input).includes("/open"))
    ).toBe(false);
  });
  it.each([200, 503])(
    "confirms visibility only after the server responds %s",
    async (status) => {
      state.canEdit = true;
      show("fleet");
      await screen.findByText("Widget canvas");
      act(() =>
        state.storage!.onChange({
          ...state.storage!.config,
          name: "Latest draft",
          started: false,
        })
      );
      const response = deferredResponse();
      fetcher.mockReturnValueOnce(response.promise);
      let saving!: Promise<boolean>;
      act(() => {
        saving = state.host!.saveDetails!({
          visibility: "restricted",
          started: true,
        });
      });
      const write = fetcher.mock.calls.find(
        ([, init]) => init?.method === "PUT"
      );
      expect(JSON.parse(String(write?.[1]?.body))).toMatchObject({
        name: "Latest draft",
        visibility: "restricted",
      });
      expect(write?.[1]?.headers).toMatchObject({ "if-match": '"7"' });
      await act(async () => {
        response.resolve(
          status === 200
            ? Response.json(
                { data: { revision: 8, updatedAt: "now" } },
                { headers: { ETag: '"8"' } }
              )
            : new Response(null, { status })
        );
        expect(await saving).toBe(status === 200);
      });
      expect(state.storage!.config.started).toBe(status === 200);
      expect(state.storage!.config.visibility).toBe(
        status === 200 ? "restricted" : undefined
      );
      if (status === 503) {
        await act(async () => {
          expect(
            await state.host!.saveDetails!({
              visibility: "restricted",
              started: true,
            })
          ).toBe(true);
        });
        expect(state.storage!.config.visibility).toBe("restricted");
      }
    }
  );
  it("does not expose an editor for a missing dashboard", async () => {
    state.canEdit = true;
    state.missing = true;
    show("fleet");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Dashboard not found");
    expect(alert).toHaveTextContent("It may have been deleted.");
    expect(
      screen.getByRole("link", { name: "Back to dashboards" })
    ).toHaveAttribute("href", "/en/dashboards");
    // Trying again would not bring it back.
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.queryByText("Widget canvas")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save" })
    ).not.toBeInTheDocument();
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(
      false
    );
  });

  it("explains a dashboard that could not be opened, and opens it on Try again", async () => {
    state.documentFailure = true;
    const user = userEvent.setup();
    show("fleet");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Dashboard unavailable");
    expect(alert).toHaveTextContent("Try again later.");
    expect(
      screen.getByRole("link", { name: "Back to dashboards" })
    ).toHaveAttribute("href", "/en/dashboards");
    state.documentFailure = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Widget canvas")).toBeInTheDocument();
  });

  it("keeps the list page's frame when the organization cannot be read", async () => {
    state.orgError = true;
    const user = userEvent.setup();
    show();
    expect(screen.getByText("Organize your dashboards")).toBeVisible();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Dashboards unavailable");
    expect(alert).toHaveTextContent("Check your connection.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(state.refreshOrg).toHaveBeenCalledTimes(1);
  });
});
