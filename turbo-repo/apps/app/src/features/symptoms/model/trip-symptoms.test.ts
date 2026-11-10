import { describe, expect, it } from "vitest";
import {
  DEFAULT_SYMPTOM_ICON,
  engineSymptomConditions,
  engineSymptomIcon,
  engineSymptomListHref,
  parseTripSymptoms,
  type EngineTripSymptom,
} from "./trip-symptoms";

const symptom: EngineTripSymptom = {
  definition_id: "def-1",
  symptom_key: "signal-loss",
  name: "Pérdida de señal",
  family: "signal_continuity",
  icon: "LOST SIGNAL",
  cases: 2,
  open_cases: 1,
  max_level: 3,
  max_condition: "CRITICAL CONDITION",
  trip_id: "trip-1",
  first_opened_at: "2026-01-01T08:00:00Z",
  last_opened_at: "2026-01-01T10:00:00Z",
};

describe("parseTripSymptoms", () => {
  it("reads an array as the legacy answer", () => {
    expect(parseTripSymptoms([{ a: 1 }])).toEqual({
      source: "legacy",
      rows: [{ a: 1 }],
    });
  });

  it("reads an object with symptoms as the engine answer", () => {
    expect(parseTripSymptoms({ trip: "SVC-1", symptoms: [symptom] })).toEqual({
      source: "engine",
      trip: "SVC-1",
      symptoms: [symptom],
    });
    expect(parseTripSymptoms({ trip: "", symptoms: [] })).toEqual({
      source: "engine",
      trip: "",
      symptoms: [],
    });
  });

  it("reads null or an object without symptoms as a legacy trip without rows", () => {
    expect(parseTripSymptoms(null)).toEqual({ source: "legacy", rows: [] });
    expect(parseTripSymptoms({})).toEqual({ source: "legacy", rows: [] });
  });
});

describe("engineSymptomIcon", () => {
  it("uses the definition's icon when the app has it, in any case", () => {
    expect(engineSymptomIcon(symptom)).toBe("LOST SIGNAL");
    expect(engineSymptomIcon({ ...symptom, icon: "stay risk" })).toBe(
      "STAY RISK"
    );
  });

  it("falls back to the symptom key, then the family, then the default", () => {
    expect(
      engineSymptomIcon({ icon: null, symptom_key: "eta-late", family: null })
    ).toBe("Deviation_Eta_Late");
    expect(
      engineSymptomIcon({
        icon: "unknown",
        symptom_key: "custom",
        family: "cargo",
      })
    ).toBe("NO CARGO SECURING");
    expect(
      engineSymptomIcon({
        icon: null,
        symptom_key: null,
        family: "emergencies",
      })
    ).toBe(DEFAULT_SYMPTOM_ICON);
  });
});

describe("engineSymptomConditions", () => {
  it("is the highest condition reached, none without cases", () => {
    expect(engineSymptomConditions(symptom)).toEqual(["critical condition"]);
    expect(
      engineSymptomConditions({ ...symptom, cases: 0, max_condition: null })
    ).toEqual([]);
  });
});

describe("engineSymptomListHref", () => {
  it("filters the history by trip and symptom over the cases' time", () => {
    const href = engineSymptomListHref("es", symptom)!;
    const url = new URL(href, "http://x");
    expect(url.pathname).toBe("/es/symptoms");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      trip_id: "trip-1",
      symptom_name: "Pérdida de señal",
      date_from: "2026-01-01T08:00:00Z",
      date_to: "2026-01-01T10:00:01.000Z",
    });
  });

  it("is null without cases", () => {
    expect(
      engineSymptomListHref("es", {
        ...symptom,
        cases: 0,
        trip_id: null,
        first_opened_at: null,
        last_opened_at: null,
      })
    ).toBeNull();
  });
});
