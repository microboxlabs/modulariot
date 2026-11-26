import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import DashboardSettingsDropdown, {
  type DashboardSettingsHost,
} from "./dashboard-settings-dropdown";

const state = vi.hoisted(() => ({
  importDashboard: vi.fn(() => ({ success: true })),
  deleteLegacy: vi.fn(),
  setDetails: vi.fn(),
  saveDetails: vi.fn(async () => true),
  notify: vi.fn(),
}));
vi.mock("@/features/i18n/tr.service", () => ({
  tr: (key: string) => key,
  trDynamic: (key: string) => key,
}));
vi.mock("@/features/notifications/notification", () => ({
  ShowNotification: state.notify,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ lang: "en", slug: "fleet" }),
}));
vi.mock("@/features/common/providers/client-api.provider", () => ({
  deleteDashboardConfigClient: state.deleteLegacy,
}));
vi.mock("../planner-manager/planner-manager", () => ({
  PlannerManagerForm: () => <div>Legacy planner</div>,
}));
vi.mock("../dashboard-permissions-modal", () => ({
  DashboardPermissionsModal: () => null,
}));
const perms = vi.hoisted(() => ({
  dirty: false,
  save: vi.fn(async () => true),
}));
vi.mock("../dashboard-setup/use-setup-permissions", () => ({
  useSetupPermissions: () => ({
    assignments: [{ authorityId: "ana@acme.io", role: "Consumer" }],
    onChange: vi.fn(),
    save: perms.save,
    dirty: perms.dirty,
    busy: false,
    canManage: true,
    loading: false,
    error: null,
    retry: vi.fn(),
  }),
}));
vi.mock(
  "../dashboard-setup/use-principal-directory",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    usePrincipalDirectory: () => ({ principals: [], isLoading: false }),
  })
);
const PERMISSIONS = {
  client: {},
  slug: "fleet",
  sessionKey: "s",
} as unknown as NonNullable<DashboardSettingsHost["permissions"]>;

vi.mock("../../context/planner-context", () => ({
  useOptionalPlannerContext: () => ({ schemas: new Map() }),
}));
vi.mock("../../context/dashboard-context", () => ({
  useDashboard: () => ({
    dashboardName: "Fleet",
    filters: [
      {
        key: "service",
        label: "Service",
        type: "select",
        optionsSource: { variableName: "billing", valueField: "service" },
      },
    ],
    setFilters: vi.fn(),
    setFilterDefinitions: vi.fn(() => true),
    queries: [
      { id: "costs", variableName: "billing", schema: ["service", "total"] },
    ],
    plannerDefinitions: [],
    exportDashboard: () => "{}",
    importDashboard: state.importDashboard,
    downloadDashboard: vi.fn(),
    refreshInterval: 0,
    setRefreshInterval: vi.fn(),
    order: undefined,
    setOrder: vi.fn(),
    dictionary: {},
    siteId: null,
    tags: ["night"],
    visibility: "organization",
    setDetails: state.setDetails,
  }),
}));

function host(overrides: Partial<DashboardSettingsHost> = {}) {
  return {
    queries: <div>Saved queries</div>,
    canManagePermissions: true,
    onManagePermissions: vi.fn(),
    onDelete: vi.fn().mockResolvedValue(undefined),
    saveDetails: state.saveDetails,
    ...overrides,
  };
}

function open(settings: DashboardSettingsHost) {
  render(<DashboardSettingsDropdown canManagePermissions host={settings} />);
  fireEvent.click(screen.getByTitle("Dashboard settings"));
}

beforeEach(() => {
  vi.clearAllMocks();
  perms.dirty = false;
});

it("replaces the legacy planner with saved queries, which also feed select filters", () => {
  open(host());
  fireEvent.click(
    screen.getByRole("button", { name: /dashboard\.settings\.filterBarTitle/ })
  );
  fireEvent.click(screen.getByText("Service"));
  const source = screen.getByLabelText("dashboard.settings.optionsSourceLabel");
  expect(
    within(source).getByRole("option", { name: "billing" })
  ).toBeInTheDocument();
  expect(
    within(
      screen.getByLabelText("dashboard.settings.optionsSourceValueField")
    ).getByRole("option", { name: "total" })
  ).toBeInTheDocument();
  expect(
    screen.getByLabelText("dashboard.settings.filterSingle")
  ).toBeInTheDocument();
  expect(screen.queryByText("Legacy planner")).not.toBeInTheDocument();
  expect(screen.queryByText("Saved queries")).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: /dashboard\.server\.queries\.title/ })
  );
  expect(screen.getByText("Saved queries")).toBeInTheDocument();
});

it("routes permissions, delete and import to the host", async () => {
  const settings = host();
  open(settings);
  fireEvent.click(
    screen.getByRole("button", { name: "dashboard.permissions.manageButton" })
  );
  expect(settings.onManagePermissions).toHaveBeenCalledOnce();

  fireEvent.click(screen.getByTitle("Dashboard settings"));
  fireEvent.click(
    screen.getByRole("button", {
      name: "dashboard.landing.delete_confirm_title",
    })
  );
  const confirm = screen.getAllByRole("button", {
    name: "dashboard.landing.delete_confirm_title",
  });
  fireEvent.click(confirm.at(-1)!);
  await waitFor(() => expect(settings.onDelete).toHaveBeenCalledOnce());
  expect(state.deleteLegacy).not.toHaveBeenCalled();
});

it("hides delete when the host does not allow it", () => {
  open(host({ onDelete: undefined }));
  expect(
    screen.queryByRole("button", {
      name: "dashboard.landing.delete_confirm_title",
    })
  ).not.toBeInTheDocument();
});

it("edits the dashboard's tags in its settings, with the setup's tags step", async () => {
  open(host());
  fireEvent.click(
    screen.getByRole("button", { name: /dashboard\.settings\.tagsTitle/ })
  );
  const save = screen.getByRole("button", {
    name: "dashboard.explorer.tagsDialog.save",
  });
  expect(save).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "dashboard.setup.tags.remove" })
  );
  fireEvent.click(save);
  await waitFor(() =>
    expect(state.saveDetails).toHaveBeenCalledWith({ tags: [] })
  );
});

it("retains tag edits and a retry when persistence fails", async () => {
  state.saveDetails.mockResolvedValueOnce(false);
  open(host());
  fireEvent.click(
    screen.getByRole("button", { name: /dashboard\.settings\.tagsTitle/ })
  );
  fireEvent.click(
    screen.getByRole("button", { name: "dashboard.setup.tags.remove" })
  );
  const save = screen.getByRole("button", {
    name: "dashboard.explorer.tagsDialog.save",
  });
  fireEvent.click(save);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "dashboard.server.saveError"
  );
  expect(save).toBeEnabled();
  fireEvent.click(save);
  await waitFor(() =>
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  );
  expect(state.saveDetails).toHaveBeenCalledTimes(2);
});

it("edits who may use the dashboard in its settings, with the setup's permissions step", async () => {
  open(host({ permissions: PERMISSIONS }));
  fireEvent.click(
    screen.getByRole("button", {
      name: /dashboard\.settings\.accessControlTitle/,
    })
  );
  expect(
    screen.queryByRole("button", { name: "dashboard.permissions.manageButton" })
  ).not.toBeInTheDocument();
  expect(screen.getByText("ana@acme.io")).toBeInTheDocument();
  // Nothing changed yet: nothing to save.
  expect(
    screen.getByRole("button", {
      name: "dashboard.permissions.saveAssignments",
    })
  ).toBeDisabled();
});

it("saves the permissions edited in the settings", async () => {
  perms.dirty = true;
  open(host({ permissions: PERMISSIONS }));
  fireEvent.click(
    screen.getByRole("button", {
      name: /dashboard\.settings\.accessControlTitle/,
    })
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "dashboard.permissions.saveAssignments",
    })
  );
  await waitFor(() => expect(perms.save).toHaveBeenCalledOnce());
  expect(state.saveDetails).not.toHaveBeenCalled();
});

it("leaves tags to the legacy store's own pages", () => {
  render(<DashboardSettingsDropdown canManagePermissions={false} />);
  fireEvent.click(screen.getByTitle("Dashboard settings"));
  expect(
    screen.queryByRole("button", { name: /dashboard\.settings\.tagsTitle/ })
  ).not.toBeInTheDocument();
});

it("keeps the dashboard to who it names from its settings", async () => {
  open(host({ permissions: PERMISSIONS }));
  fireEvent.click(
    screen.getByRole("button", {
      name: /dashboard\.settings\.accessControlTitle/,
    })
  );
  fireEvent.click(
    screen.getByRole("radio", {
      name: "dashboard.setup.permissions.visibility.restricted",
    })
  );
  fireEvent.click(
    screen.getByRole("button", { name: "dashboard.permissions.saveVisibility" })
  );
  await waitFor(() =>
    expect(state.saveDetails).toHaveBeenCalledWith({ visibility: "restricted" })
  );
});

it("reports failed visibility persistence and keeps a retry available", async () => {
  state.saveDetails.mockResolvedValueOnce(false);
  open(host({ permissions: PERMISSIONS }));
  fireEvent.click(
    screen.getByRole("button", {
      name: /dashboard\.settings\.accessControlTitle/,
    })
  );
  fireEvent.click(
    screen.getByRole("radio", {
      name: "dashboard.setup.permissions.visibility.restricted",
    })
  );
  fireEvent.click(
    screen.getByRole("button", { name: "dashboard.permissions.saveVisibility" })
  );
  await waitFor(() =>
    expect(state.notify).toHaveBeenCalledWith({
      type: "error",
      message: "dashboard.permissions.visibilitySaveError",
    })
  );
  const retry = screen.getByRole("button", {
    name: "dashboard.permissions.saveVisibility",
  });
  expect(retry).toBeEnabled();
  fireEvent.click(retry);
  await waitFor(() =>
    expect(state.notify).toHaveBeenCalledWith({
      type: "success",
      message: "dashboard.permissions.visibilitySaveSuccess",
    })
  );
});

it("confirms assignments and visibility through separate save actions", async () => {
  perms.dirty = true;
  open(host({ permissions: PERMISSIONS }));
  fireEvent.click(
    screen.getByRole("button", {
      name: /dashboard\.settings\.accessControlTitle/,
    })
  );
  fireEvent.click(
    screen.getByRole("radio", {
      name: "dashboard.setup.permissions.visibility.restricted",
    })
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "dashboard.permissions.saveAssignments",
    })
  );
  await waitFor(() => expect(perms.save).toHaveBeenCalledOnce());
  expect(state.saveDetails).not.toHaveBeenCalled();
  const visibilitySave = screen.getByRole("button", {
    name: "dashboard.permissions.saveVisibility",
  });
  await waitFor(() => expect(visibilitySave).toBeEnabled());
  fireEvent.click(visibilitySave);
  await waitFor(() =>
    expect(state.saveDetails).toHaveBeenCalledWith({ visibility: "restricted" })
  );
  expect(perms.save).toHaveBeenCalledOnce();
});
