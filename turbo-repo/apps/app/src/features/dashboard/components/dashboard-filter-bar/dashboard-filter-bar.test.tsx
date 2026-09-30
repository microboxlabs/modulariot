import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DashboardFilterBar } from "./dashboard-filter-bar";
import { DashboardFilterBadges } from "../dashboard-filters-card/dashboard-filters-card";

const state = vi.hoisted(() => ({
  filters: [] as { key: string; label: string; type: "date_range" }[],
  hostAccess: undefined as { canEdit: boolean; canManagePermissions: boolean } | undefined,
}));
vi.mock("../../context/dashboard-context", () => ({
  useDashboard: () => ({ ...state, dictionary: {} }),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboards/billing",
}));
vi.mock("./time-range-picker", () => ({ default: () => <button>Date range</button> }));
vi.mock("../dashboard-filters-card/date-filter-badge", () => ({ DateFilterBadge: () => <button>Date range</button> }));
vi.mock("../dashboard-filters-card/text-filter-badge", () => ({ TextFilterBadge: () => null }));
vi.mock("../dashboard-filters-card/select-filter-badge", () => ({ SelectFilterBadge: () => null }));
vi.mock("./tags", () => ({ default: () => null }));
vi.mock("@/features/i18n/tr.service", () => ({ tr: (key: string) => key }));
afterEach(() => {
  cleanup();
  state.filters = [];
  state.hostAccess = undefined;
});

describe.each([DashboardFilterBar, DashboardFilterBadges])("dashboard date filters (%s)", (Component) => {
  it("keeps the legacy fallback", () => {
    render(<Component />);
    expect(screen.getByRole("button", { name: "Date range" })).toBeTruthy();
  });
  it("omits an undeclared date filter for controlled dashboards", () => {
    state.hostAccess = { canEdit: false, canManagePermissions: false };
    render(<Component />);
    expect(screen.queryByRole("button", { name: "Date range" })).toBeNull();
  });
  it("renders an explicitly declared date filter for controlled dashboards", () => {
    state.hostAccess = { canEdit: true, canManagePermissions: false };
    state.filters = [{ key: "period", label: "Period", type: "date_range" }];
    render(<Component />);
    expect(screen.getAllByRole("button", { name: "Date range" })).toHaveLength(1);
  });
});
