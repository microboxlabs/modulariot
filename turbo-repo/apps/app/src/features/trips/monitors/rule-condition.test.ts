import { describe, expect, it } from "vitest";
import {
  compileConditions,
  parseConditions,
} from "@/features/symptoms/maintainer/condition-form";
import { formFields } from "./rule-condition";

const schema = [
  { path: "trip.status", type: "text" },
  { path: "trip.plannedStart", type: "time" },
  { path: "signal.kind", type: "text" },
  { path: "stages.transit.type", type: "text" },
  { path: "trip.origin.type", type: "text" },
  { path: "mandates[].status", type: "text" },
  { path: "params.lateMinutes", type: "number" },
];

describe("formFields", () => {
  it("offers text, numbers and yes/no outside lists, with the known values listed", () => {
    const fields = formFields(schema, {});
    expect(fields.map((f) => f.path)).toEqual([
      "trip.status",
      "signal.kind",
      "stages.transit.type",
      "trip.origin.type",
      "params.lateMinutes",
    ]);
    const byPath = new Map(fields.map((f) => [f.path, f]));
    expect(byPath.get("signal.kind")?.values?.[0]?.value).toBe(
      "entered_origin"
    );
    expect(byPath.get("stages.transit.type")?.values?.length).toBe(6);
    expect(byPath.get("trip.origin.type")?.values).toBeNull();
  });

  it("reads a monitor condition into the form and writes it back", () => {
    const fields = formFields(schema, {});
    const rule =
      'signal.kind == "entered_destination" && params.lateMinutes > 10';
    const form = parseConditions(rule, fields);
    expect(form?.rows).toHaveLength(2);
    expect(compileConditions(form!)).toBe(
      'signal.kind == "entered_destination"\n&& params.lateMinutes > 10'
    );
  });

  it("leaves a condition on times to the expression", () => {
    const fields = formFields(schema, {});
    expect(parseConditions("trip.plannedStart < now", fields)).toBeNull();
  });
});
