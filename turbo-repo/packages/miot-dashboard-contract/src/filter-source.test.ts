import { expect, it } from "vitest";
import { dashboardFilterParamSchema } from "./schema";
it("preserves named result references and legacy extensions without interpreting them", () => {
  const value = {
    key: "service",
    label: "Service",
    type: "select",
    single: true,
    optionsSource: {
      variableName: "billing_costs",
      valueField: "service",
      labelField: "service",
      hostExtension: true,
    },
  };
  expect(dashboardFilterParamSchema.parse(value)).toEqual(value);
  expect(
    dashboardFilterParamSchema.safeParse({
      ...value,
      optionsSource: { variableName: 42, valueField: "service" },
    }).success,
  ).toBe(false);
});
it("retains static and unfinished legacy filter compatibility", () => {
  expect(
    dashboardFilterParamSchema.safeParse({
      key: "service",
      label: "",
      type: "select",
      optionsSource: { variableName: "", valueField: "" },
    }).success,
  ).toBe(true);
  expect(
    dashboardFilterParamSchema.parse({
      key: "service",
      label: "Service",
      type: "select",
      options: [],
    }),
  ).not.toHaveProperty("optionsSource");
});
