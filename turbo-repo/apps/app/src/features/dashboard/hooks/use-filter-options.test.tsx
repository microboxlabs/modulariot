import { renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import type { PropsWithChildren } from "react";
import { PlannerResultsProvider } from "../context/planner-context";
import { useFilterOptions } from "./use-filter-options";
it("reads shared saved-query-compatible results through the Next provider", () => {
  const value = {
    results: new Map([
      [
        "billing",
        { rows: [{ service: "Storage" }], loading: false, error: null },
      ],
    ]),
    definitions: [],
    schemas: new Map(),
  };
  function Wrapper({ children }: Readonly<PropsWithChildren>) {
    return (
      <PlannerResultsProvider value={value}>{children}</PlannerResultsProvider>
    );
  }
  const view = renderHook(
    () =>
      useFilterOptions({
        key: "service",
        label: "Service",
        type: "select",
        single: true,
        optionsSource: { variableName: "billing", valueField: "service" },
      }),
    { wrapper: Wrapper }
  );
  expect(view.result.current.options).toEqual([
    { label: "Storage", value: "Storage" },
  ]);
});
