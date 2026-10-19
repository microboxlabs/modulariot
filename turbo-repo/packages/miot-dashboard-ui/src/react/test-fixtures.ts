import type { DashboardStorageSchema } from "@microboxlabs/miot-dashboard-contract/document";
export function makeDashboardStorage(
  overrides: Partial<DashboardStorageSchema> = {},
): DashboardStorageSchema {
  return {
    version: 2,
    name: "Test dashboard",
    widgets: [],
    preferences: { editMode: false },
    ...overrides,
  };
}
