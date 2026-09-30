import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ServerDashboardSettings } from "./server-dashboard-settings";
const state = vi.hoisted(() => ({
  setGeneralSettings: vi.fn(() => true),
  downloadDashboard: vi.fn(),
  importDashboard: vi.fn(() => ({ success: true })),
  setFilterDefinitions: vi.fn(() => true),
}));
vi.mock("@/features/i18n/tr.service", () => ({ tr: (key: string) => key }));
vi.mock("../context/dashboard-context", () => ({
  useDashboard: () => ({
    dashboardName: "Billing",
    refreshInterval: 0,
    order: undefined,
    filters: [],
    queries: [{ id: "costs", variableName: "billing", schema: ["service"] }],
    ...state,
  }),
}));
const label = (key: string) => `dashboard.server.settings.${key}`;
it("hides settings from consumers and applies editor changes through the document controller", () => {
  const view = render(
    <ServerDashboardSettings editable={false} dictionary={{}} />
  );
  expect(screen.queryByRole("button")).toBeNull();
  view.rerender(<ServerDashboardSettings editable dictionary={{}} />);
  fireEvent.click(screen.getByRole("button", { name: label("title") }));
  fireEvent.change(screen.getByLabelText(label("name")), {
    target: { value: "Monthly billing" },
  });
  fireEvent.click(screen.getByRole("button", { name: label("apply") }));
  expect(state.setGeneralSettings).toHaveBeenCalledWith({
    name: "Monthly billing",
    refreshInterval: 0,
    order: undefined,
  });
  fireEvent.click(screen.getByRole("button", { name: label("filters.add") }));
  fireEvent.change(screen.getByLabelText(label("filters.key")), {
    target: { value: "service" },
  });
  fireEvent.change(screen.getByLabelText(label("filters.label")), {
    target: { value: "Service" },
  });
  fireEvent.click(screen.getByRole("button", { name: label("filters.apply") }));
  expect(state.setFilterDefinitions).toHaveBeenCalledWith([
    { key: "service", label: "Service", type: "text" },
  ]);
  fireEvent.change(screen.getByLabelText(label("filters.type")), {
    target: { value: "select" },
  });
  fireEvent.change(screen.getByLabelText(label("filters.source")), {
    target: { value: "billing" },
  });
  fireEvent.change(screen.getByLabelText(label("filters.valueField")), {
    target: { value: "service" },
  });
  fireEvent.click(screen.getByRole("button", { name: label("filters.apply") }));
  expect(state.setFilterDefinitions).toHaveBeenLastCalledWith([
    expect.objectContaining({
      type: "select",
      optionsSource: { variableName: "billing", valueField: "service" },
    }),
  ]);
  fireEvent.click(
    screen.getByRole("button", { name: label("transfer.export") })
  );
  expect(state.downloadDashboard).toHaveBeenCalledOnce();
  fireEvent.change(screen.getByLabelText(label("transfer.json")), {
    target: { value: "{}" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: label("transfer.replace") })
  );
  expect(state.importDashboard).toHaveBeenCalledWith("{}", { undoable: true });
});
