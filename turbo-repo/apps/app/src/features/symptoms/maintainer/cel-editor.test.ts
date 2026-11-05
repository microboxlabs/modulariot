import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { type CelField, completions, fieldAt, fieldDetail } from "./cel-editor";

const FIELDS: CelField[] = [
  { path: "signal.trip.active", type: "bool" },
  {
    path: "signal.trip.age_min",
    type: "number",
    unit: "min",
    description: "Tiempo en viaje",
    detail: "calculado",
  },
  { path: "signal.frame.events", type: "objects" },
  { path: "signal.frame.events.event_type", type: "text" },
  { path: "signal.frame.events.severity", type: "text" },
  { path: "signal.frame.gps.speed", type: "number", unit: "km/h" },
  { path: "signal.frame.sensors.panic_button" },
  {
    path: "case.closed_on_trip_s",
    type: "number",
    unit: "s",
    description: "segundos desde el cierre; -1 sin cierre en el viaje",
  },
];

const VALUES = {
  "signal.frame.events.event_type": [
    { value: "main_power_disconnect", detail: "12" },
    { value: "gps_jamming", detail: "3" },
  ],
};

/** The labels offered with the cursor at the end of `doc`. */
function offered(doc: string): string[] {
  const state = EditorState.create({ doc });
  const result = completions(
    () => FIELDS,
    () => VALUES
  )(new CompletionContext(state, doc.length, true));
  if (!result || result instanceof Promise) return [];
  return result.options.map((o) => o.label);
}

describe("CEL completions", () => {
  it("escapes event codes when inserting them into a CEL literal", () => {
    const doc = 'signal.frame.events.exists(e, e.event_type == "';
    const state = EditorState.create({ doc });
    const value = 'vendor\\new"code';
    const result = completions(
      () => FIELDS,
      () => ({
        "signal.frame.events.event_type": [{ value }],
      })
    )(new CompletionContext(state, doc.length, true));
    expect(result?.options[0]?.label).toBe(value);
    expect(result?.options[0]?.apply).toBe('vendor\\\\new\\"code');
  });

  it("completes fields after a .? read", () => {
    expect(offered("signal.frame.?se")).toContain("sensors");
  });

  it("offers orValue and hasValue only after a .? read", () => {
    expect(offered("signal.frame.?gps.?speed.orV")).toContain("orValue");
    expect(offered("signal.frame.?gps.?speed.orV")).toContain("hasValue");
    expect(offered("signal.frame.gps.")).not.toContain("orValue");
    expect(offered("orV")).not.toContain("orValue");
  });

  it("ends the word at a ternary's ?", () => {
    expect(offered("signal.trip.active?signal.frame.gp")).toContain("gps");
  });

  it("completes the fields of a list inside its macro", () => {
    expect(offered("signal.frame.events.exists(e, e.ev")).toContain(
      "event_type"
    );
    expect(offered("signal.frame.?events.all(x, x.")).toEqual([
      "event_type",
      "severity",
    ]);
    expect(offered("signal.frame.events.exists(e, ")).toEqual([]);
    expect(offered("signal.frame.events.exists(ev, e")).toContain("ev");
  });

  it("suggests the received event types inside the quotes", () => {
    expect(offered('signal.frame.events.exists(e, e.event_type == "')).toEqual([
      "main_power_disconnect",
      "gps_jamming",
    ]);
    expect(
      offered(
        'signal.frame.events.exists(e, e.event_type in ["gps_jamming", "ma'
      )
    ).toEqual(["main_power_disconnect", "gps_jamming"]);
    expect(offered('signal.frame.events.exists(e, e.severity == "')).toEqual(
      []
    );
    expect(
      offered('signal.frame.events.exists(e, e.event_type == "x") && a')
    ).not.toContain("gps_jamming");
  });

  it("shows each field's type, unit and meaning", () => {
    const doc = "signal.trip.";
    const state = EditorState.create({ doc });
    const result = completions(() => FIELDS)(
      new CompletionContext(state, doc.length, true)
    );
    const age = result?.options.find((o) => o.label === "age_min");
    expect(age?.detail).toBe("number · min · calculado");
    expect(age).toMatchObject({ description: "Tiempo en viaje" });
    const active = result?.options.find((o) => o.label === "active");
    expect(active?.detail).toBe("bool");
    expect(active).toMatchObject({ description: undefined });
  });

  it("leaves the detail out when a field has nothing to show", () => {
    const doc = "signal.frame.sensors.";
    const state = EditorState.create({ doc });
    const result = completions(() => FIELDS)(
      new CompletionContext(state, doc.length, true)
    );
    expect(result?.options[0]).toMatchObject({
      label: "panic_button",
      detail: undefined,
    });
  });
});

describe("fieldDetail", () => {
  it("joins type, unit and note", () => {
    expect(fieldDetail({ path: "x", type: "number", unit: "s" })).toBe(
      "number · s"
    );
    expect(fieldDetail({ path: "x" })).toBe("");
  });
});

describe("fieldAt", () => {
  const text = "case.closed_on_trip_s > 60 && signal.trip.age_min >= 10";

  it("finds the field under the pointer", () => {
    const found = fieldAt(text, 8, FIELDS);
    expect(found?.field.path).toBe("case.closed_on_trip_s");
    expect(text.slice(found?.from, found?.to)).toBe("case.closed_on_trip_s");
    expect(fieldAt(text, text.indexOf("age_min") + 2, FIELDS)?.field.path).toBe(
      "signal.trip.age_min"
    );
  });

  it("finds nothing on a root, a number or a field without anything to show", () => {
    expect(fieldAt(text, 1, FIELDS)).toBeNull();
    expect(fieldAt(text, text.indexOf("60"), FIELDS)).toBeNull();
    expect(fieldAt("signal.frame.sensors.panic_button", 25, FIELDS)).toBeNull();
  });

  it("reads a macro variable as its list's field", () => {
    const rule = 'signal.frame.events.exists(e, e.event_type == "x")';
    expect(
      fieldAt(rule, rule.indexOf("event_type") + 1, FIELDS)?.field.path
    ).toBe("signal.frame.events.event_type");
  });

  it("reads a .? path as the plain one", () => {
    const rule = "signal.frame.?gps.?speed.orValue(0.0) > 90";
    expect(fieldAt(rule, rule.indexOf("speed"), FIELDS)?.field.path).toBe(
      "signal.frame.gps.speed"
    );
  });
});
