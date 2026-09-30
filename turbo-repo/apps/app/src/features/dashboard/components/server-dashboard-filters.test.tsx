import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ServerDashboardFilters } from "./server-dashboard-filters";
const state = vi.hoisted(() => ({
  setFilterDefinitions: vi.fn(() => true),
}));
vi.mock("@/features/i18n/tr.service", () => ({ tr: (key: string) => key }));
vi.mock("../context/dashboard-context", () => ({
  useDashboard: () => ({
    filters: [],
    queries: [{ id: "costs", variableName: "billing", schema: ["service"] }],
    ...state,
  }),
}));
const label = (key: string) => `dashboard.server.settings.${key}`;
it("applies filter definitions, including saved-query options, through the document controller", () => {
  render(<ServerDashboardFilters dictionary={{}} />);
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
});
