import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SymptomSpec, SymptomStats } from "./maintainer-api";

const api = vi.hoisted(() => ({ useSymptomStats: vi.fn() }));
vi.mock("./maintainer-api", () => api);
vi.mock("./ui/level-icon", () => ({ LevelIcon: () => <span /> }));

import ImpactPanel, {
  activationChanged,
  casesPerShift,
  levelMarks,
} from "./impact-panel";

const response = (operator: boolean) => ({
  operator,
  slaMinutes: null,
  steps: [],
  notices: [],
  evidence: [],
  ignorable: false,
});

const spec = (levels: [number, boolean, string, boolean][]) =>
  ({
    levels: levels.map(([icu, applies, when, operator]) => ({
      icu,
      applies,
      when,
      response: response(operator),
    })),
  }) as unknown as SymptomSpec;

const PUBLISHED = spec([
  [1, true, "medida > 0", false],
  [2, true, "medida >= 5", false],
  [3, true, "medida >= 11", true],
  [4, true, "medida >= 21", true],
]);

const DRAFT = spec([
  [1, true, "medida  >  0", false],
  [2, false, "", false],
  [3, true, "medida >= 12", true],
  [4, true, 'medida >= 21 && x == "a  b"', true],
]);

describe("levelMarks", () => {
  it("tells same, changed and off apart, ignoring spacing outside quotes", () => {
    const marks = levelMarks(DRAFT, PUBLISHED);
    expect([1, 2, 3, 4].map((icu) => marks.get(icu))).toEqual([
      "same",
      "off",
      "changed",
      "changed",
    ]);
  });

  it("marks every level that applies as the same before the first publish", () => {
    expect(levelMarks(PUBLISHED, null).get(3)).toBe("same");
  });
});

describe("activationChanged", () => {
  it("is true when the source or the activation differ beyond spacing", () => {
    const base = { source: "gps", activation: "a && b" } as SymptomSpec;
    expect(activationChanged({ ...base, activation: "a\n&& b" }, base)).toBe(
      false
    );
    expect(activationChanged({ ...base, activation: "a" }, base)).toBe(true);
    expect(activationChanged({ ...base, source: "trip" }, base)).toBe(true);
    expect(activationChanged(base, null)).toBe(false);
  });
});

describe("casesPerShift", () => {
  it("adds the weekly cases of the operator levels and divides by the shifts of a week", () => {
    expect(casesPerShift(PUBLISHED, [947, 1866, 1265, 444], 12)).toBe(122);
    expect(casesPerShift(DRAFT, [947, 1866, 1265, 444], 8)).toBe(81);
    expect(casesPerShift(DRAFT, [], 0)).toBe(0);
  });
});

describe("ImpactPanel", () => {
  const d = {
    impactTitle: "Cómo afecta",
    impactWindow: "Casos por semana",
    impactPerShift: "casos por turno",
    impactNote: "Estimado",
    impactNoEngine: "Sin datos del motor.",
    impactLoading: "Cargando",
    impactSame: "mismo",
    impactChanged: "cambiado",
    impactOff: "apagado",
    levelName1: "Bajo observación",
    levelName2: "Comprometida",
    levelName3: "Crítica",
    levelName4: "Código negro",
  };
  const stats = {
    engineAvailable: true,
    windowDays: 90,
    symptoms: [
      {
        definitionId: "s1",
        weekByLevel: [947, 1866, 1265, 444],
        week: 4522,
        operatorWeek: 1709,
      },
    ],
    operators: { shiftHours: 8 },
  } as unknown as SymptomStats;

  it("lists each level's weekly cases with its mark and the cases per shift", () => {
    api.useSymptomStats.mockReturnValue({ data: stats });
    render(
      <ImpactPanel definitionId="s1" spec={DRAFT} published={PUBLISHED} d={d} />
    );
    expect(screen.getByText("1.866")).toBeTruthy();
    expect(screen.getByText("81")).toBeTruthy();
    expect(screen.getAllByText("cambiado")).toHaveLength(2);
    expect(screen.getAllByText("apagado")).toHaveLength(1);
  });

  it("says so when the engine has no data", () => {
    api.useSymptomStats.mockReturnValue({
      data: { ...stats, engineAvailable: false },
    });
    render(
      <ImpactPanel definitionId="s1" spec={DRAFT} published={null} d={d} />
    );
    expect(screen.getByText("Sin datos del motor.")).toBeTruthy();
  });
});
