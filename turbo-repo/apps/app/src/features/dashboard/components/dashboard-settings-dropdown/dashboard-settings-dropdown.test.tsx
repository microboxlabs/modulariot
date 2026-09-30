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
}));
vi.mock("@/features/i18n/tr.service", () => ({ tr: (key: string) => key }));
vi.mock("@/features/notifications/notification", () => ({
  ShowNotification: vi.fn(),
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
    queries: [{ id: "costs", variableName: "billing", schema: ["service", "total"] }],
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
  }),
}));

function host(overrides: Partial<DashboardSettingsHost> = {}) {
  return {
    queries: <div>Saved queries</div>,
    canManagePermissions: true,
    onManagePermissions: vi.fn(),
    onDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function open(settings: DashboardSettingsHost) {
  render(<DashboardSettingsDropdown canManagePermissions host={settings} />);
  fireEvent.click(screen.getByTitle("Dashboard settings"));
}

beforeEach(() => vi.clearAllMocks());

it("replaces the legacy planner with saved queries, which also feed select filters", () => {
  open(host());
  fireEvent.click(screen.getByRole("button", { name: /dashboard\.settings\.filterBarTitle/ }));
  fireEvent.click(screen.getByText("Service"));
  const source = screen.getByLabelText("dashboard.settings.optionsSourceLabel");
  expect(within(source).getByRole("option", { name: "billing" })).toBeInTheDocument();
  expect(
    within(screen.getByLabelText("dashboard.settings.optionsSourceValueField")).getByRole(
      "option",
      { name: "total" },
    ),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("dashboard.settings.filterSingle")).toBeInTheDocument();
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
    screen.getByRole("button", { name: "dashboard.landing.delete_confirm_title" })
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
