import { describe, expect, it } from "vitest";
import { createWidgetRegistry } from "./widget-registry";

describe("instance widget catalogs", () => {
  it("isolates hosts that register different implementations of the same identifier", () => {
    const first = { meta: { id: "card" }, render: () => "first host" };
    const second = { meta: { id: "card" }, render: () => "second host" };
    const a = createWidgetRegistry([first]);
    const b = createWidgetRegistry([second]);
    expect(a.get("card")?.render()).toBe("first host");
    expect(b.get("card")?.render()).toBe("second host");
  });

  it("rejects duplicate IDs instead of silently overwriting a renderer", () => {
    expect(() =>
      createWidgetRegistry([
        { meta: { id: "card" } },
        { meta: { id: "card" } },
      ]),
    ).toThrow("Duplicate widget identifier: card");
  });

  it.each(["", "   "])("rejects empty ID %j", (id) => {
    expect(() => createWidgetRegistry([{ meta: { id } }])).toThrow(
      "Widget identifiers must not be empty",
    );
  });

  it("has no inherited IDs but permits an explicitly registered name", () => {
    const registry = createWidgetRegistry([{ meta: { id: "__proto__" } }]);
    expect(registry.get("__proto__")?.meta.id).toBe("__proto__");
    expect(registry.get("constructor")).toBeUndefined();
    expect(registry.get("toString")).toBeUndefined();
  });

  it("preserves registration order without sharing mutable lists", () => {
    const definitions = [{ meta: { id: "second" } }, { meta: { id: "first" } }];
    const registry = createWidgetRegistry(definitions);
    definitions.pop();
    registry.all().pop();
    expect(registry.all().map((entry) => entry.meta.id)).toEqual([
      "second",
      "first",
    ]);
  });
});
