import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PropsWithChildren, ReactNode } from "react";
import type { DashboardSettingsHost } from "./dashboard-settings-dropdown/dashboard-settings-dropdown";
import type { DashboardStorageSchema } from "../types/dashboard.types";
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
  host: undefined as DashboardSettingsHost | undefined,
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
      error: null,
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
  }: Readonly<{
    headerActions?: ReactNode;
    settingsHost?: DashboardSettingsHost;
  }>) => {
    state.host = settingsHost;
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
      loadError: "Dashboard unavailable",
      unsaved: "Unsaved changes",
      saving: "Saving…",
      newName: "New dashboard",
      empty: "No dashboards yet",
    },
    landing: { title: "Dashboards", cta: "Create dashboard" },
    create: {
      title: "New dashboard",
      nameLabel: "Name",
      submit: "Create",
      nameRequired: "Name is required",
      nameInvalid: "Name needs letters or digits",
      duplicateSlug: "Name already taken",
      errorNotification: "Could not create",
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
  state.host = undefined;
  state.storage = undefined;
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

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
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
    fireEvent.click(createButton);
    fireEvent.change(await screen.findByRole("textbox", { name: "Name" }), {
      target: { value: "Demo Validación" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(state.push).toHaveBeenCalledWith("/en/dashboards/demo-validacion")
    );
    const write = fetcher.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(write?.[0]).toBe("/app/api/dashboards/demo-validacion?org=acme");
    expect(write?.[1]?.headers).toMatchObject({ "if-match": '"0"' });
  });
  it("refuses a name whose id is already listed, without writing", async () => {
    state.canEdit = true;
    show();
    fireEvent.click(
      await screen.findByRole("button", { name: "Create dashboard" })
    );
    fireEvent.change(await screen.findByRole("textbox", { name: "Name" }), {
      target: { value: "Fleet" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Name already taken"
    );
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(
      false
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Another dashboard" },
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it.each([
    { status: 409, message: "Name already taken" },
    { status: 412, message: "Name already taken" },
    { status: 503, message: "Could not create" },
  ])(
    "allows correction and retry after a $status response",
    async ({ status, message }) => {
      state.canEdit = true;
      show();
      fireEvent.click(
        await screen.findByRole("button", { name: "Create dashboard" })
      );
      const input = await screen.findByRole("textbox", { name: "Name" });
      fireEvent.change(input, { target: { value: "Demo dashboard" } });
      fetcher.mockResolvedValueOnce(new Response(null, { status }));
      fireEvent.click(screen.getByRole("button", { name: "Create" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      fireEvent.change(input, { target: { value: "Another dashboard" } });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Create" }));
      await waitFor(() =>
        expect(state.push).toHaveBeenCalledWith(
          "/en/dashboards/another-dashboard"
        )
      );
    }
  );
  it.each([
    ["   ", "Name is required"],
    ["¡¿?!", "Name needs letters or digits"],
  ])("does not write an invalid name %s", async (name, message) => {
    state.canEdit = true;
    show();
    fireEvent.click(
      await screen.findByRole("button", { name: "Create dashboard" })
    );
    fireEvent.change(await screen.findByRole("textbox", { name: "Name" }), {
      target: { value: name },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(
      false
    );
  });
  it("ignores Escape while a dashboard is being saved", async () => {
    state.canEdit = true;
    show();
    fireEvent.click(
      await screen.findByRole("button", { name: "Create dashboard" })
    );
    fireEvent.change(await screen.findByRole("textbox", { name: "Name" }), {
      target: { value: "Pending dashboard" },
    });
    const save = deferredResponse();
    fetcher.mockReturnValueOnce(save.promise);
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create" })).toBeDisabled()
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue(
      "Pending dashboard"
    );
    await act(async () => {
      save.resolve(
        Response.json(
          { data: { revision: 1, updatedAt: "now" } },
          { headers: { ETag: '"1"' } }
        )
      );
    });
    await waitFor(() =>
      expect(state.push).toHaveBeenCalledWith(
        "/en/dashboards/pending-dashboard"
      )
    );
  });
  it.each([false, true])(
    "preserves the draft and pending state across permission refresh (saving: %s)",
    async (saving) => {
      state.canEdit = true;
      show();
      fireEvent.click(
        await screen.findByRole("button", { name: "Create dashboard" })
      );
      fireEvent.change(await screen.findByRole("textbox", { name: "Name" }), {
        target: { value: "Pending dashboard" },
      });
      const save = deferredResponse();
      if (saving) {
        fetcher.mockReturnValueOnce(save.promise);
        fireEvent.click(screen.getByRole("button", { name: "Create" }));
        await waitFor(() =>
          expect(screen.getByRole("button", { name: "Create" })).toBeDisabled()
        );
      }
      const permissions = deferredResponse();
      const previousFetch = fetcher.getMockImplementation()!;
      const revalidate = vi.fn(() => permissions.promise);
      fetcher.mockImplementation((input, init) =>
        String(input).includes("/dashboard-capabilities?")
          ? revalidate()
          : previousFetch(input, init)
      );
      fireEvent.focus(window);
      await waitFor(() => expect(revalidate).toHaveBeenCalled());
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      );
      await act(async () => {
        permissions.resolve(Response.json({ canCreate: true }));
      });
      expect(await screen.findByRole("textbox", { name: "Name" })).toHaveValue(
        "Pending dashboard"
      );
      expect(
        screen.getByRole("button", { name: "Create" }).hasAttribute("disabled")
      ).toBe(saving);
      if (saving) {
        await act(async () => {
          save.resolve(
            Response.json(
              { data: { revision: 1, updatedAt: "now" } },
              { headers: { ETag: '"1"' } }
            )
          );
        });
        await waitFor(() =>
          expect(state.push).toHaveBeenCalledWith(
            "/en/dashboards/pending-dashboard"
          )
        );
      }
    }
  );
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
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(state.host?.onDelete).toBeUndefined();
    expect(state.host?.canManagePermissions).toBe(false);
    expect(
      fetcher.mock.calls.every(([url]) =>
        String(url).startsWith("/app/api/dashboards/fleet")
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
    const write = fetcher.mock.calls.find(([, init]) => init?.method === "PUT");
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
