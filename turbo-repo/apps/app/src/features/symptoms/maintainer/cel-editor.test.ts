import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { completions } from "./cel-editor";

const FIELDS = [
  { path: "signal.trip.active", detail: "" },
  { path: "signal.frame.gps.speed", detail: "km/h" },
  { path: "signal.frame.sensors.panic_button", detail: "" },
];

/** The labels offered with the cursor at the end of `doc`. */
function offered(doc: string): string[] {
  const state = EditorState.create({ doc });
  const result = completions(() => FIELDS)(
    new CompletionContext(state, doc.length, true)
  );
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
});
