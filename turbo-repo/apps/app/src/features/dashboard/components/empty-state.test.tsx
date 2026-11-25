import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/lang/en.json";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { DashboardPermissionsOptions } from "@microboxlabs/miot-dashboard-ui/react";
import { EmptyState } from "./empty-state";

const perms = vi.hoisted(() => ({
  assignments: [] as { authorityId: string; role: string }[],
  loaded: true,
  save: vi.fn<(draft: unknown) => Promise<boolean>>(async () => true),
}));
vi.mock("@microboxlabs/miot-dashboard-ui/react", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useDashboardPermissions: () => ({
    assignments: perms.assignments,
    editorKey: "k",
    editable: true,
    loaded: perms.loaded,
    busy: false,
    error: null,
    save: perms.save,
    reload: vi.fn(),
  }),
}));
vi.mock("@/features/settings-admin/team/team-api", () => ({
  useTeam: () => ({
    data: {
      organization: "acme",
      members: [
        { userId: "u1", email: "ana@acme.io", name: "Ana Rojas" },
        { userId: "u2", email: "bo@acme.io", name: null },
      ],
    },
    isLoading: false,
  }),
  useTeams: () => ({
    data: [{ id: "t1", name: "Operaciones", members: ["u1", "u2"] }],
    isLoading: false,
  }),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(globalThis.location.search),
}));
/** Opens the page at `query`, as a reload or a shared link would. */
const openAt = (query: string) =>
  globalThis.history.replaceState(null, "", `/en/dashboards/fleet${query}`);
const { notify } = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock("@/features/notifications/notification", () => ({
  ShowNotification: notify,
}));

const dictionary = en as unknown as I18nRecord;
const PERMISSIONS = {
  client: {},
  slug: "fleet",
  sessionKey: "s",
} as unknown as DashboardPermissionsOptions;

function setup(
  canManagePermissions = true,
  started = false,
  tags: readonly string[] = []
) {
  const onAdd = vi.fn();
  const onFinishSetup = vi.fn<(tags: string[]) => void>();
  const onVisibilityChange =
    vi.fn<(visibility: "organization" | "restricted") => void>();
  const view = (isStarted: boolean) => (
    <EmptyState
      dictionary={dictionary}
      onAdd={onAdd}
      canManagePermissions={canManagePermissions}
      permissions={PERMISSIONS}
      started={isStarted}
      tags={tags}
      onFinishSetup={onFinishSetup}
      visibility="restricted"
      onVisibilityChange={onVisibilityChange}
    />
  );
  const { rerender } = render(view(started));
  return {
    user: userEvent.setup(),
    onAdd,
    onFinishSetup,
    onVisibilityChange,
    /** The dashboard as saved after `onFinishSetup`, rendered again. */
    markStarted: () => rerender(view(true)),
  };
}

const step = (name: string) => screen.getByRole("button", { name });
const search = () =>
  screen.getByPlaceholderText("Search for a member or a team…");

beforeEach(() => {
  perms.assignments = [];
  perms.loaded = true;
  perms.save.mockReset().mockResolvedValue(true);
  notify.mockReset();
  openAt("");
});

describe("EmptyState setup steps", () => {
  it("opens each step only after the one before it", async () => {
    const { user } = setup();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "1");
    expect(step("1 Permissions")).toHaveAttribute("aria-current", "step");
    expect(step("2 Tags")).toBeDisabled();
    expect(step("3 First dashlet")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(step("2 Tags")).toHaveAttribute("aria-current", "step");
    expect(step("3 First dashlet")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(step("3 First dashlet")).toHaveAttribute("aria-current", "step");
    expect(
      screen.queryByRole("button", { name: "Continue" })
    ).not.toBeInTheDocument();

    // A finished step can be opened again, and keeps what was entered.
    await user.click(screen.getByRole("button", { name: /Permissions/ }));
    expect(screen.getByText("Who can use this dashboard?")).toBeVisible();
  });

  it("keeps the open step in the URL, without navigating", async () => {
    openAt("?view=grid");
    const replaceState = vi.spyOn(globalThis.history, "replaceState");
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(globalThis.location.pathname).toBe("/en/dashboards/fleet");
    expect(globalThis.location.search).toBe("?view=grid&step=tags");
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(globalThis.location.search).toBe("?view=grid&step=permissions");
    // The URL is replaced in place: no new history entries.
    expect(replaceState).toHaveBeenCalledTimes(2);
    replaceState.mockRestore();
  });

  it("opens the step the URL names, with the ones before it done", async () => {
    openAt("?step=tags");
    const { user } = setup();
    expect(step("2 Tags")).toHaveAttribute("aria-current", "step");
    await user.click(step("Permissions"));
    expect(screen.getByText("Who can use this dashboard?")).toBeVisible();
  });

  it("opens the first step for an unknown one in the URL", () => {
    openAt("?step=nope");
    setup();
    expect(step("1 Permissions")).toHaveAttribute("aria-current", "step");
  });

  it("lists every member and team that matches, under their headers", async () => {
    const { user } = setup();
    await user.type(search(), "acme");
    // Both members match by email, listed one by one under their header.
    expect(await screen.findByText("Members")).toBeInTheDocument();
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "Ana Rojasana@acme.io",
      "bo@acme.io",
    ]);
    await user.clear(search());
    await user.type(search(), "oper");
    expect(await screen.findByText("Teams")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Operaciones/ })
    ).toHaveTextContent("2 members");
    // A search box, not a form: no browser autofill over the results.
    expect(search()).toHaveAttribute("autocomplete", "off");
  });

  it("shows some members and teams on a click, before anything is typed", async () => {
    const { user } = setup();
    await user.click(search());
    expect(screen.getByText("Members")).toBeInTheDocument();
    expect(screen.getByText("Teams")).toBeInTheDocument();
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Ana Rojasana@acme.io",
      "bo@acme.io",
      "Operaciones2 members",
    ]);
    await user.click(screen.getByRole("option", { name: /Operaciones/ }));
    expect(
      screen.getByRole("combobox", { name: "Access for Operaciones" })
    ).toHaveValue("Consumer");
    // The search's results close; only the role dropdown's options remain.
    expect(screen.queryByRole("option", { name: /Ana Rojas/ })).toBeNull();
  });

  it("gives access with a role and saves it when the step is left", async () => {
    const { user } = setup();
    await user.type(search(), "oper");
    await user.click(
      await screen.findByRole("option", { name: /Operaciones/ })
    );
    await user.type(search(), "ana");
    await user.click(await screen.findByRole("option", { name: /Ana Rojas/ }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Access for Ana Rojas" }),
      "Administrator"
    );
    // Each kind under its own header, not a badge on every row.
    expect(
      screen.getByRole("region", { name: "Members (1)" })
    ).toHaveTextContent("Ana Rojas");
    expect(screen.getByRole("region", { name: "Teams (1)" })).toHaveTextContent(
      "Operaciones"
    );
    // Already given access: no longer offered.
    await user.type(search(), "oper");
    expect(
      await screen.findByText("No members or teams match.")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() =>
      expect(perms.save).toHaveBeenCalledWith([
        { authorityId: "team:t1", role: "Consumer" },
        { authorityId: "ana@acme.io", role: "Coordinator" },
      ])
    );
    expect(step("2 Tags")).toHaveAttribute("aria-current", "step");
  });

  it("shows who already has access, and stays on the step when saving fails", async () => {
    perms.assignments = [{ authorityId: "team:t1", role: "Editor" }];
    perms.save.mockResolvedValue(false);
    const { user } = setup();
    expect(
      await screen.findByRole("combobox", { name: "Access for Operaciones" })
    ).toHaveValue("Editor");
    await user.click(
      screen.getByRole("button", { name: "Remove Operaciones" })
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith({
        type: "error",
        message: "The permissions could not be saved. Try again.",
      })
    );
    expect(step("1 Permissions")).toHaveAttribute("aria-current", "step");
  });

  it("offers the dashboard's four roles and keeps a Contributor as one", async () => {
    perms.assignments = [{ authorityId: "team:t1", role: "Contributor" }];
    const { user } = setup();
    const access = await screen.findByRole("combobox", {
      name: "Access for Operaciones",
    });
    expect(
      within(access)
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual(["Reader", "Contributor", "Editor", "Administrator"]);
    expect(access).toHaveValue("Contributor");
    await user.selectOptions(access, "Editor");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() =>
      expect(perms.save).toHaveBeenCalledWith([
        { authorityId: "team:t1", role: "Editor" },
      ])
    );
  });

  it("shows the step's shape, not a refusal, while access is still loading", () => {
    perms.loaded = false;
    setup();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText(/Only an administrator/)).toBeNull();
  });

  it("explains, without the controls, when access is not the caller's to set", () => {
    setup(false);
    expect(
      screen.getByText(/Only an administrator of this dashboard/)
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "New group" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("writes tags, and adds suggested ones", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.type(
      screen.getByRole("textbox", { name: "Type a tag and press Enter" }),
      "night{Enter}"
    );
    await user.click(screen.getByRole("button", { name: "Fleet" }));
    expect(screen.getByText("night")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Remove Fleet" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Fleet" })
    ).not.toBeInTheDocument();
  });

  it("adds the first dashlet, and shows templates as coming soon", async () => {
    const { user, onAdd } = setup();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    // From the option card, and from the footer's main button.
    const adds = screen.getAllByRole("button", { name: /Add a dashlet/ });
    expect(adds).toHaveLength(2);
    for (const add of adds) await user.click(add);
    expect(onAdd).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("button", { name: /Use a template/ })
    ).toBeDisabled();
    expect(screen.getByText("Coming soon")).toBeVisible();
  });

  it("saves the tags and starts the dashboard on leaving the tags step", async () => {
    const { user, onFinishSetup, markStarted } = setup(true, false, ["fleet"]);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("button", { name: "Remove fleet" })).toBeVisible();
    await user.type(
      screen.getByRole("textbox", { name: "Type a tag and press Enter" }),
      "night{Enter}"
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onFinishSetup).toHaveBeenCalledWith(["fleet", "night"]);
    // Saved as started, the steps stay on screen on their last one.
    markStarted();
    expect(step("3 First dashlet")).toHaveAttribute("aria-current", "step");
  });

  it("saves who sees the dashboard on leaving the permissions step", async () => {
    const { user, onVisibilityChange } = setup();
    expect(
      screen.getByRole("radio", { name: /Only people with access/ })
    ).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("radio", { name: /Whole organization/ }));
    expect(onVisibilityChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onVisibilityChange).toHaveBeenCalledWith("organization");
  });

  it("explains each choice of who sees it on hover, under one note", async () => {
    const { user } = setup();
    await user.hover(
      screen.getByRole("radio", { name: /Only people with access/ })
    );
    expect(
      await screen.findByText(
        "Only who is on the list, whoever created it and the organization owners see it."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "People and teams you add get the role you pick on this dashboard."
      )
    ).toBeVisible();
  });

  it("leaves who sees the dashboard alone when it was not changed", async () => {
    const { user, onVisibilityChange } = setup();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onVisibilityChange).not.toHaveBeenCalled();
  });

  it("offers no choice of who sees it to whoever cannot manage access", () => {
    setup(false);
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("does not save tags or start the dashboard on leaving permissions", async () => {
    const { user, onFinishSetup } = setup();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onFinishSetup).not.toHaveBeenCalled();
  });

  it("opens a started dashboard on its first dashlet alone, without steps", async () => {
    const { user, onAdd } = setup(true, true);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Permissions/ })
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Add a dashlet/ }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("counts a dashboard saved before the setup existed as started", () => {
    render(
      <EmptyState
        dictionary={dictionary}
        onAdd={vi.fn()}
        permissions={PERMISSIONS}
      />
    );
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add a dashlet/ })).toBeVisible();
  });

  it("shows only that the dashboard is empty to someone who cannot edit it", () => {
    render(<EmptyState dictionary={dictionary} />);
    expect(screen.getByText("This dashboard is still empty")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
