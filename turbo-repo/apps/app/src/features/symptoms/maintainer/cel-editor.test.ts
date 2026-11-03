import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { completions } from "./cel-editor";

const FIELDS = [
  { path: "signal.trip.active", detail: "" },
  { path: "signal.frame.events", detail: "objects" },
  { path: "signal.frame.events.event_type", detail: "text" },
  { path: "signal.frame.events.severity", detail: "text" },
  { path: "signal.frame.gps.speed", detail: "km/h" },
  { path: "signal.frame.sensors.panic_button", detail: "" },
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
});
