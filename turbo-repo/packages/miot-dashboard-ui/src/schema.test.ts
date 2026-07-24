import { describe, expect, it } from "vitest";
import {
  CURRENT_DASHBOARD_CONFIG_VERSION,
  DashboardConfigMigrationError,
  dashboardConfigSchema,
  migrateDashboardConfig,
  validateDashboardConfig,
  widgetSchema,
} from "./schema";
import { DEFAULT_STORAGE, type Widget } from "./types/dashboard";

const widget = (overrides: Partial<Widget> = {}): Widget => ({
  id: "w1",
  componentId: "stat_icon",
  layout: { i: "w1", x: 0, y: 0, w: 6, h: 4 },
  config: { title: "KPI" },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("dashboardConfigSchema", () => {
  it("accepts the default storage state", () => {
    expect(dashboardConfigSchema.safeParse(DEFAULT_STORAGE).success).toBe(true);
  });

  it("accepts a config with nested widgets, planner, and filters", () => {
    const config = {
      ...DEFAULT_STORAGE,
      widgets: [
        widget({
          componentId: "container",
          children: [widget({ id: "w2", layout: { i: "w2", x: 0, y: 0, w: 3, h: 2 } })],
        }),
      ],
      requestPlanner: [
        {
          id: "r1",
          variableName: "fleet_stats",
          pgrestFunctionName: "rpc/fn_stats",
          pgrestHttpMethod: "POST",
          pgrestParams: [{ key: "p_scope", value: "all" }],
        },
      ],
      filters: [{ key: "asset_id", label: "Asset", type: "text" }],
      refreshInterval: 30,
      allowedGroups: ["GROUP_OPS"],
    };
    expect(validateDashboardConfig(config).success).toBe(true);
  });

  it("preserves unknown keys (lenient round-trip)", () => {
    const parsed = dashboardConfigSchema.parse({
      ...DEFAULT_STORAGE,
      futureField: "kept",
    });
    expect((parsed as Record<string, unknown>).futureField).toBe("kept");
  });

  it("rejects a config missing required fields", () => {
    expect(validateDashboardConfig({ version: 2, name: "x" }).success).toBe(false);
  });

  it("rejects a widget without componentId", () => {
    const rest: Record<string, unknown> = { ...widget() };
    delete rest.componentId;
    expect(widgetSchema.safeParse(rest).success).toBe(false);
  });
});

describe("migrateDashboardConfig", () => {
  it("returns a fresh default for null/undefined", () => {
    const migrated = migrateDashboardConfig(null);
    expect(migrated).toEqual(DEFAULT_STORAGE);
    expect(migrated).not.toBe(DEFAULT_STORAGE); // must be a clone
  });

  it("passes a valid v2 config through", () => {
    const config = { ...DEFAULT_STORAGE, name: "Ops", widgets: [widget()] };
    expect(migrateDashboardConfig(config)).toEqual(config);
  });

  it("coerces an unversioned legacy blob onto v2 defaults", () => {
    const migrated = migrateDashboardConfig({
      name: "Legacy",
      widgets: [widget()],
      junk: true,
    });
    expect(migrated.version).toBe(CURRENT_DASHBOARD_CONFIG_VERSION);
    expect(migrated.name).toBe("Legacy");
    expect(migrated.widgets).toHaveLength(1);
    expect(migrated.preferences).toEqual({ editMode: false });
  });

  it("drops unrecognizable legacy widgets rather than failing", () => {
    const migrated = migrateDashboardConfig({ name: "Legacy", widgets: "corrupt" });
    expect(migrated.widgets).toEqual([]);
  });

  it("throws on structurally invalid v2", () => {
    expect(() =>
      migrateDashboardConfig({ version: 2, name: 42, widgets: [], preferences: {} })
    ).toThrow(DashboardConfigMigrationError);
  });

  it("refuses to downgrade a future version", () => {
    expect(() => migrateDashboardConfig({ version: 3, name: "x" })).toThrow(
      /newer than this library supports/
    );
  });

  it("throws on non-object input", () => {
    expect(() => migrateDashboardConfig("nope")).toThrow(DashboardConfigMigrationError);
  });
});
