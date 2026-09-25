import { describe, expect, it } from "vitest";
import type { Selectable } from "../types";
import {
  canCreate,
  filterStatic,
  optionFor,
  sections,
  underCap,
} from "./field-logic";

const communes: Selectable = {
  key: "commune",
  name: { es: "Comuna" },
  description: {},
  mode: "SINGLE",
  settings: { dependsOn: "region" },
  groups: [],
  source: { kind: "STATIC" },
  options: [
    { value: "valparaiso", label: { es: "Valparaíso" }, parent: "CL-VS" },
    {
      value: "vina",
      label: { es: "Viña del Mar", en: "Vina del Mar" },
      parent: "CL-VS",
    },
    { value: "santiago", label: { es: "Santiago" }, parent: "CL-RM" },
  ],
};

const values = (options: { value: string }[]) => options.map((o) => o.value);

describe("field logic", () => {
  it("filters by parent and by accent-free search over value and every label", () => {
    expect(values(filterStatic(communes, "", ["CL-RM"]))).toEqual(["santiago"]);
    expect(values(filterStatic(communes, "VALPARAISO", ["CL-VS"]))).toEqual([
      "valparaiso",
    ]);
    expect(values(filterStatic(communes, "vina", ["CL-VS"]))).toEqual(["vina"]);
    expect(filterStatic(communes, "", [])).toEqual([]);
  });

  it("puts ungrouped options first, then groups in the list's order, skipping empty ones", () => {
    const out = sections(
      [
        { value: "a", label: { es: "A" }, group: "late" },
        { value: "b", label: { es: "B" } },
        { value: "c", label: { es: "C" }, group: "early" },
      ],
      [
        { key: "early", label: { es: "Temprano" } },
        { key: "unused", label: { es: "Nada" } },
        { key: "late", label: { es: "Tarde" } },
      ]
    );
    expect(out.map((s) => s.group?.key ?? null)).toEqual([
      null,
      "early",
      "late",
    ]);
  });

  it("offers a new tag only when tags are on and nothing matches exactly", () => {
    const tags = { ...communes, settings: { creatable: true } };
    expect(canCreate(tags, "Frágil", [], "es")).toBe(true);
    expect(canCreate(tags, "santiago", communes.options, "es")).toBe(false);
    expect(canCreate(tags, "  ", [], "es")).toBe(false);
    expect(canCreate(communes, "Frágil", [], "es")).toBe(false);
  });

  it("caps multiple choices only", () => {
    const multi = {
      ...communes,
      mode: "MULTIPLE" as const,
      settings: { maxSelections: 2 },
    };
    expect(underCap(multi, 1)).toBe(true);
    expect(underCap(multi, 2)).toBe(false);
    expect(underCap({ ...multi, mode: "SINGLE" }, 5)).toBe(true);
  });

  it("stands in for a typed tag with its own text", () => {
    expect(optionFor("nuevo", new Map()).label).toEqual({ es: "nuevo" });
  });
});
