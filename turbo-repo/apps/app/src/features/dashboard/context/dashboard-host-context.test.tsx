import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";
import { DEFAULT_STORAGE } from "../types/dashboard.types";

const { legacy } = vi.hoisted(() => ({ legacy: vi.fn(() => null) }));
vi.mock("./planner-context", () => ({ PlannerProvider: legacy }));
vi.mock("./dashboard-filters-context", () => ({
  DashboardFiltersProvider: ({ children }: Readonly<PropsWithChildren>) => children,
}));
vi.mock("@/features/layout/hooks/use-kiosk-mode", () => ({
  useKioskMode: () => false,
}));
vi.mock("../dashlets", () => ({ getDashlet: () => undefined, dashboardRegistry: { get: () => undefined, all: () => [] } }));
import { DashboardProvider, useDashboard } from "./dashboard-context";

const DataProvider = ({ children }: Readonly<PropsWithChildren>) => children;
describe("host dashboard context", () => {
  it.each([true, false])(
    "publishes host edit access for readOnly=%s without a legacy site/planner",
    (readOnly) => {
      legacy.mockClear();
      const storage = {
        config: DEFAULT_STORAGE,
        isLoaded: true,
        readOnly,
        onChange: vi.fn(),
      };
      const wrapper = ({ children }: Readonly<PropsWithChildren>) => (
        <DashboardProvider
          dictionary={{}}
          slug="host"
          siteId="legacy"
          storage={storage}
          dataProvider={DataProvider}
        >
          {children}
        </DashboardProvider>
      );
      const { result } = renderHook(useDashboard, { wrapper });
      expect(result.current.siteId).toBeNull();
      expect(result.current.hostAccess?.canEdit).toBe(!readOnly);
      expect(legacy).not.toHaveBeenCalled();
    }
  );
});
