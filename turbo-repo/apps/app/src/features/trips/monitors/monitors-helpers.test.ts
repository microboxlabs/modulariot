import { describe, expect, it } from "vitest";
import { editorFields } from "./expression-field";
import { keyFromName } from "../key-from-name";
import { newRule } from "./monitors-api";

describe("trip monitor helpers", () => {
  it("offers a list at its root only", () => {
    expect(
      editorFields([
        { path: "trip.status", type: "text" },
        { path: "mandates[].status", type: "text" },
        { path: "mandates[].orderRef", type: "text" },
      ])
    ).toEqual([
      { path: "trip.status", detail: "text" },
      { path: "mandates", detail: "list" },
    ]);
  });

  it("derives a key from a name", () => {
    expect(keyFromName("Servicio directo · Perú")).toBe(
      "servicio-directo-peru"
    );
    expect(keyFromName("  --Reparto 2--  ")).toBe("reparto-2");
  });

  it("gives a new rule an unused key, and a timer its time", () => {
    expect(newRule("signal", ["rule-1", "rule-2"]).key).toBe("rule-3");
    expect(newRule("signal", ["rule-2"]).key).toBe("rule-3");
    expect(newRule("timer", []).at).toBe("trip.plannedStart");
    expect(newRule("plan", []).at).toBeNull();
  });
});
