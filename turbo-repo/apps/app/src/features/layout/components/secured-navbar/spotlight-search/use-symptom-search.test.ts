import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SymptomDefinition } from "@/features/symptoms/maintainer/maintainer-api";
import type { SpotlightItem } from "./types";

const api = vi.hoisted(() => ({ useSymptomDefinitions: vi.fn() }));
vi.mock("@/features/symptoms/maintainer/maintainer-api", () => api);

import {
  SYMPTOM_CATALOG_ITEM,
  isSymptomItem,
  matchSymptoms,
  useSymptomSearch,
} from "./use-symptom-search";

const symptom = (id: string, name: string, key = id) =>
  ({ id, name, key }) as SymptomDefinition;

const SYMPTOMS = [
  symptom("1", "Detención no planificada", "unplanned_stop"),
  symptom("2", "Exceso de velocidad", "speeding"),
  symptom("3", "Velocidad en zona urbana", "urban_speed"),
  symptom("4", "Puerta abierta en ruta", "door_open"),
];

const CATALOG: SpotlightItem = {
  id: SYMPTOM_CATALOG_ITEM,
  label: "Catálogo de síntomas",
  kind: "navigate",
  keywords: [],
  onSelect: () => {},
};

describe("matchSymptoms", () => {
  it("ignores case and accents and puts names that start with the query first", () => {
    expect(matchSymptoms(SYMPTOMS, "VELOCIDAD").map((s) => s.id)).toEqual([
      "3",
      "2",
    ]);
    expect(matchSymptoms(SYMPTOMS, "detencion").map((s) => s.id)).toEqual([
      "1",
    ]);
    expect(matchSymptoms(SYMPTOMS, "door").map((s) => s.id)).toEqual(["4"]);
  });

  it("returns nothing for a blank query and caps the list", () => {
    expect(matchSymptoms(SYMPTOMS, "  ")).toEqual([]);
    expect(matchSymptoms(SYMPTOMS, "e", 2)).toHaveLength(2);
  });
});

describe("useSymptomSearch", () => {
  beforeEach(() => {
    api.useSymptomDefinitions.mockReset();
    api.useSymptomDefinitions.mockReturnValue({
      data: SYMPTOMS.map((definition) => ({ definition, hasDraft: false })),
    });
  });

  it("gives a header and rows that open the symptom's sheet", () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() =>
      useSymptomSearch("exceso", true, [CATALOG], onNavigate)
    );
    const [header, row] = result.current;
    expect(header).toMatchObject({
      label: "Catálogo de síntomas",
      isGroupHeader: true,
    });
    expect(row).toMatchObject({
      label: "Exceso de velocidad",
      sublabel: "Catálogo de síntomas",
    });
    expect(isSymptomItem(row!)).toBe(true);
    expect(isSymptomItem(CATALOG)).toBe(false);
    row!.onSelect();
    expect(onNavigate).toHaveBeenCalledWith("/users/settings/symptoms/2");
    expect(api.useSymptomDefinitions).toHaveBeenCalledWith(true);
  });

  it("fetches nothing while closed or for users who cannot open the catalog", () => {
    const { result, rerender } = renderHook(
      ({ open, items }) => useSymptomSearch("exceso", open, items, vi.fn()),
      { initialProps: { open: false, items: [CATALOG] } }
    );
    expect(api.useSymptomDefinitions).toHaveBeenLastCalledWith(false);
    rerender({ open: true, items: [] });
    expect(api.useSymptomDefinitions).toHaveBeenLastCalledWith(false);
    expect(result.current).toEqual([]);
  });

  it("has no header when nothing matches", () => {
    const { result } = renderHook(() =>
      useSymptomSearch("zzz", true, [CATALOG], vi.fn())
    );
    expect(result.current).toEqual([]);
  });
});
