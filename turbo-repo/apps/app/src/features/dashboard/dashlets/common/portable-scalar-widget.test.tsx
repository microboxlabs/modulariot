import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PlannerResultsProvider } from "@microboxlabs/miot-dashboard-ui/react";
import dictionary from "@/lang/es.json";
import { Dashlet as Text } from "../text_card/dashlet";
import { Dashlet as Percentage } from "../percentage_value/dashlet";
import { Dashlet as Circular } from "../stat_circular/dashlet";
import type { Widget } from "../../types/dashboard.types";
vi.mock("../../context/dashboard-context", () => ({
  useOptionalDashboard: () => ({
    dictionary,
    hostAccess: { canEdit: false, canManagePermissions: false },
  }),
}));
vi.mock("./use-dashlet-pgrest", () => ({
  useHybridPgrestContext: () => {
    throw new Error("Legacy transport must not run for server widgets");
  },
}));
vi.mock("./use-pgrest-resolved-fields", () => ({
  usePgrestResolvedFields: () => {
    throw new Error("Legacy transport must not run for server widgets");
  },
}));
afterEach(cleanup);
const widget = (componentId: string, config: Widget["config"]): Widget => ({
  id: componentId,
  componentId,
  config,
  layout: { i: componentId, x: 0, y: 0, w: 4, h: 3 },
  createdAt: "2026-09-29",
  updatedAt: "2026-09-29",
});
it("server widget adapters use shared saved results and Spanish labels without legacy hooks", () => {
  const config = {
    dataMode: "planner",
    plannerVariableName: "costs",
    text: "Cost {{cost}}",
    value: "{{cost}}",
    max: "100",
    maxValue: "100",
    unit: "USD",
  };
  render(
    <PlannerResultsProvider
      value={{
        results: new Map([
          ["costs", { rows: [{ cost: "42" }], loading: false, error: null }],
        ]),
        definitions: [],
        schemas: new Map(),
      }}
    >
      <Text widget={widget("text_card", config)} editMode={false} />
      <Percentage
        widget={widget("percentage_value", config)}
        editMode={false}
      />
      <Circular widget={widget("stat_circular", config)} editMode={false} />
    </PlannerResultsProvider>
  );
  expect(screen.getByText("Cost 42")).toBeTruthy();
  expect(
    screen.getAllByRole("progressbar").map((e) => e.getAttribute("value"))
  ).toEqual(["42", "42"]);
  expect(screen.getByText("de 100 USD")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});
it("server legacy bindings display migration feedback without executing legacy hooks", () => {
  render(
    <>
      <Text
        widget={widget("text_card", { dataMode: "pgrest" })}
        editMode={false}
      />
      <Percentage
        widget={widget("percentage_value", { dataMode: "pgrest" })}
        editMode={false}
      />
      <Circular
        widget={widget("stat_circular", { dataMode: "pgrest" })}
        editMode={false}
      />
    </>
  );
  expect(screen.getAllByRole("alert").map((e) => e.textContent)).toEqual(
    Array(3).fill("Migra este widget a una consulta guardada.")
  );
});
