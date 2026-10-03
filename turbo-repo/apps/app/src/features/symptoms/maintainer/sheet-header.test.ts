import { describe, expect, it } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { errorCount } from "./draft-bar";
import type {
  PublishPlan,
  SymptomDefinition,
  SymptomFamily,
  SymptomSpec,
} from "./maintainer-api";
import { draftState, familyOptions, originText } from "./sheet-header";
import { canonicalFamily, familyLabel } from "./symptom-labels";

const d = {
  originTemplate: "Desde la plantilla {name}",
  originFork: "Copia de otro síntoma",
  originEngine: "Importado del motor (regla {id})",
  originBlank: "Creado en blanco",
} as unknown as I18nRecord;

const def = (over: Partial<SymptomDefinition> = {}): SymptomDefinition =>
  ({
    id: "1",
    tenantCode: "t",
    key: "k",
    name: "n",
    family: "driving_safety",
    icon: null,
    description: null,
    sourceKey: "gps_signal",
    engineRuleId: null,
    templateKey: null,
    forkedFromVersionId: null,
    state: "ACTIVE",
    currentVersion: "1.0.0",
    ...over,
  }) as SymptomDefinition;

const spec = (over: Partial<SymptomSpec> = {}): SymptomSpec => ({
  source: "gps_signal",
  activation: "true",
  measure: null,
  levels: [],
  lifecycle: null,
  recurrence: null,
  ...over,
});

const families: SymptomFamily[] = [
  {
    value: "driving_safety",
    label: { es: "Seguridad de conducción", en: "Driving safety" },
    disabled: false,
  },
  { value: "cargo", label: { es: "Carga", en: "Cargo" }, disabled: true },
];

describe("originText", () => {
  it("names the template, a copy, an engine rule or a blank start", () => {
    const templates = [
      { key: "speeding", name: "Exceso de velocidad" },
    ] as never;
    expect(originText(def({ templateKey: "speeding" }), templates, d)).toBe(
      "Desde la plantilla Exceso de velocidad"
    );
    expect(originText(def({ templateKey: "gone" }), templates, d)).toBe(
      "Desde la plantilla gone"
    );
    expect(originText(def({ forkedFromVersionId: "v" }), [], d)).toBe(
      "Copia de otro síntoma"
    );
    expect(originText(def({ engineRuleId: 9 }), [], d)).toBe(
      "Importado del motor (regla 9)"
    );
    expect(originText(def(), undefined, d)).toBe("Creado en blanco");
  });
});

describe("draftState", () => {
  it("takes the draft's state, else the symptom's, and a first version starts in test", () => {
    expect(draftState(def(), spec({ state: "OFF" }))).toBe("OFF");
    expect(draftState(def(), spec())).toBe("ACTIVE");
    expect(
      draftState(def({ currentVersion: null, state: "OFF" }), spec())
    ).toBe("TEST");
    expect(draftState(def(), null)).toBe("ACTIVE");
  });
});

describe("families", () => {
  it("labels by language and falls back to the stored value", () => {
    expect(familyLabel("driving_safety", families, "en")).toBe(
      "Driving safety"
    );
    expect(familyLabel("driving_safety", families, "pt")).toBe(
      "Seguridad de conducción"
    );
    expect(familyLabel("old_free_text", families, "es")).toBe("Old free text");
    expect(familyLabel(null, families)).toBe("");
  });

  it("reads a stored label as its family", () => {
    expect(canonicalFamily("Seguridad de conducción", families)).toBe(
      "driving_safety"
    );
    expect(canonicalFamily("Driving safety", families)).toBe("driving_safety");
    expect(canonicalFamily("legacy", families)).toBe("legacy");
    expect(canonicalFamily(null, families)).toBeNull();
    expect(familyLabel("Seguridad de conducción", families, "en")).toBe(
      "Driving safety"
    );
  });

  it("offers enabled families plus the stored one, and a blank when none is set", () => {
    expect(
      familyOptions(families, "driving_safety", "es").map((o) => o.value)
    ).toEqual(["driving_safety"]);
    expect(familyOptions(families, "cargo", "es").map((o) => o.value)).toEqual([
      "driving_safety",
      "cargo",
    ]);
    expect(familyOptions(families, "legacy", "es").map((o) => o.value)).toEqual(
      ["legacy", "driving_safety"]
    );
    expect(familyOptions(families, null, "es").map((o) => o.value)).toEqual([
      "",
      "driving_safety",
    ]);
  });
});

describe("errorCount", () => {
  const finding = (severity: "ERROR" | "WARNING") => ({
    section: "activation",
    severity,
    message: "x",
    position: -1,
  });

  it("counts errors of the latest check, else of the plan", () => {
    const plan = {
      report: {
        findings: [finding("ERROR")],
        publishable: false,
        needsTestOnly: false,
      },
    } as PublishPlan;
    expect(errorCount(null, plan)).toBe(1);
    expect(
      errorCount(
        {
          findings: [finding("WARNING")],
          publishable: true,
          needsTestOnly: false,
        },
        plan
      )
    ).toBe(0);
    expect(errorCount(null, undefined)).toBe(0);
  });
});
