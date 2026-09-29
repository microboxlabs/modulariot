import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";
import { ServerDashboardsPage } from "./server-dashboards-page";
import { DEFAULT_STORAGE } from "../types/dashboard.types";

const state = vi.hoisted(() => ({
  userId: "test-user",
  authenticated: true,
  canEdit: false,
  orgRole: undefined as string | undefined,
  scopeFailure: false,
  missing: false,
  push: vi.fn(),
}));
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    status: state.authenticated ? "authenticated" : "unauthenticated",
    data: { user: { id: state.userId } },
  }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }) }));
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
      error: null,
    }),
  })
);
vi.mock("../context/dashboard-context", () => ({
  DashboardProvider: ({ children }: Readonly<PropsWithChildren>) => children,
}));
vi.mock("../context/saved-query-context", () => ({
  DashboardQuerySession: ({ children }: Readonly<PropsWithChildren>) =>
    children,
  SavedQueryResults: ({ children }: Readonly<PropsWithChildren>) => children,
}));
vi.mock("./dashboard-view", () => ({
  DashboardView: () => <div>Widget canvas</div>,
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
      loadError: "Dashboard unavailable",
      unsaved: "Unsaved changes",
      create: "Create dashboard",
      slug: "Dashboard identifier",
      newName: "New dashboard",
    },
  },
};
const fetcher = vi.fn<typeof fetch>();
beforeEach(() => {
  state.userId = "test-user";
  state.authenticated = true;
  state.canEdit = false;
  state.orgRole = undefined;
  state.missing = false;
  state.scopeFailure = false;
  state.push.mockReset();
  fetcher.mockReset();
  fetcher.mockImplementation(async (input, init) => {
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
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ServerDashboardsPage dictionary={dictionary} lang="en" slug={slug} />
    </SWRConfig>
  );
}

describe("parallel dashboard pages", () => {
  it("discards cached lists when the authenticated identity changes", async () => {
    const page = render(
      <ServerDashboardsPage dictionary={dictionary} lang="en" />
    );
    await screen.findByRole("link", { name: "Fleet" });
    state.userId = "another-user";
    fetcher.mockImplementation(async (input) =>
      String(input).includes("/dashboard-capabilities")
        ? Response.json({ canCreate: false })
        : Response.json({ data: [{ slug: "other", name: "Other account" }] })
    );
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

  it.each(["OWNER", "MEMBER"])(
    "uses server permission to offer creation for %s",
    async (role) => {
      state.orgRole = role;
      state.canEdit = true;
      show();
      await screen.findByRole("link", { name: "Fleet" });
      expect(
        await screen.findByRole("button", { name: "Create dashboard" })
      ).toBeEnabled();
    }
  );
  it.each(["OWNER", "MEMBER", "unknown"])(
    "respects server creation denial for %s",
    async (role) => {
      state.orgRole = role;
      show();
      await screen.findByRole("link", { name: "Fleet" });
      expect(
        screen.queryByRole("button", { name: "Create dashboard" })
      ).not.toBeInTheDocument();
    }
  );
  it("lets an authorized MEMBER create with a zero-revision precondition", async () => {
    state.orgRole = "MEMBER";
    state.canEdit = true;
    show();
    const createButton = await screen.findByRole("button", {
      name: "Create dashboard",
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: "Dashboard identifier" }),
      {
        target: { value: "demo-validation" },
      }
    );
    fireEvent.click(createButton);
    await waitFor(() =>
      expect(state.push).toHaveBeenCalledWith("/en/dashboards/demo-validation")
    );
    const write = fetcher.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(write?.[0]).toBe("/app/api/dashboards/demo-validation?org=acme");
    expect(write?.[1]?.headers).toMatchObject({ "if-match": '\"0\"' });
  });
  it("does not fall back to the application role when permission lookup fails", async () => {
    state.orgRole = "OWNER";
    state.scopeFailure = true;
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Dashboard unavailable"
    );
    expect(
      screen.queryByRole("button", { name: "Create dashboard" })
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: "Fleet" })
    ).toBeInTheDocument();
  });
  it("lists the active organization's dashboards without a legacy site", async () => {
    show();
    expect(await screen.findByRole("link", { name: "Fleet" })).toHaveAttribute(
      "href",
      "/en/dashboards/fleet"
    );
    expect(fetcher).toHaveBeenCalledWith(
      "/app/api/dashboards?org=acme",
      expect.any(Object)
    );
    expect(
      screen.queryByRole("button", { name: "Create dashboard" })
    ).not.toBeInTheDocument();
  });
  it("renders Consumers without edit or delete controls", async () => {
    show("fleet");
    expect(await screen.findByText("Widget canvas")).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Dashboard name" })
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Save" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete" })
    ).not.toBeInTheDocument();
    expect(
      fetcher.mock.calls.every(([url]) =>
        String(url).startsWith("/app/api/dashboards/fleet")
      )
    ).toBe(true);
  });
  it("saves Editor changes with the loaded revision", async () => {
    state.canEdit = true;
    show("fleet");
    await screen.findByText("Widget canvas");
    fireEvent.change(screen.getByRole("textbox", { name: "Dashboard name" }), {
      target: { value: "Changed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument()
    );
    const write = fetcher.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(write?.[0]).toBe("/app/api/dashboards/fleet?org=acme");
    expect(write?.[1]?.headers).toMatchObject({ "if-match": '"7"' });
    expect(JSON.parse(String(write?.[1]?.body)).name).toBe("Changed");
  });
  it("does not expose an editor for a missing dashboard", async () => {
    state.canEdit = true;
    state.missing = true;
    show("fleet");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Dashboard unavailable"
    );
    expect(screen.queryByText("Widget canvas")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save" })
    ).not.toBeInTheDocument();
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(
      false
    );
  });
});
