import { describe, expect, it } from "vitest";
import es from "@/lang/es.json";
import en from "@/lang/en.json";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import {
  caseSpans,
  levelAt,
  pointLevel,
  summarizeReason,
  type LevelReason,
} from "./level-reason";

const dict = es as unknown as I18nRecord;

const lowCoverage: LevelReason = {
  icu_code: 1,
  icu_condition: "UNDER OBSERVATION",
  rule: "check.loss.silence_s < 1800 || check.loss.low_coverage_zone",
  lost_since: "2026-01-01T00:00:00Z",
  context: {
    check: {
      signal_lost_minutes: 12.5,
      loss: {
        silence_s: 750,
        expected_s: 300,
        ratio: 2.5,
        low_coverage_zone: true,
        cohort_outage: false,
        returned: false,
        backfill: false,
        nearby_reporting: 3,
        last: { at: "2026-01-01T00:00:00Z", lat: 1, lon: 2 },
      },
    },
  },
};

describe("summarizeReason", () => {
  it("states the silence, the rule and the true flags", () => {
    const s = summarizeReason(lowCoverage, dict)!;
    expect(s.silenceMinutes).toBe(13);
    expect(s.rule).toBe(lowCoverage.rule);
    expect(s.flags.map((f) => f.label)).toEqual(["Zona de baja cobertura"]);
    expect(s.flags[0].value).toBe("");
  });

  it("labels the known values and leaves positions out", () => {
    const s = summarizeReason(lowCoverage, dict)!;
    const labels = Object.fromEntries(s.details.map((d) => [d.label, d.value]));
    expect(labels["Silencio sobre lo esperado"]).toBe("2.5×");
    expect(labels["Intervalo esperado"]).toBe("300 s");
    expect(labels["Vehículos reportando cerca"]).toBe("3");
    expect(labels["Última señal antes del silencio"]).toBe(
      "2026-01-01T00:00:00Z"
    );
    expect(s.details.some((d) => d.key.endsWith(".lat"))).toBe(false);
  });

  it("adds the coverage share and source only when present", () => {
    const withCoverage: LevelReason = {
      ...lowCoverage,
      context: {
        check: {
          loss: {
            silence_s: 600,
            low_coverage_zone: true,
            coverage_share: 0.42,
            coverage_source: "shadow-map",
          },
        },
      },
    };
    const flag = summarizeReason(withCoverage, en as unknown as I18nRecord)!
      .flags[0];
    expect(flag.label).toBe("Low-coverage zone");
    expect(flag.value).toBe("Coverage: 42 % · Source: shadow-map");
  });

  it("shows unknown keys of another template by their path", () => {
    const s = summarizeReason(
      { icu_code: 2, context: { signal: { speed: 95, zone: "A" } } },
      dict
    )!;
    expect(s.silenceMinutes).toBeNull();
    expect(s.details).toEqual([
      { key: "signal.speed", label: "signal.speed", value: "95" },
      { key: "signal.zone", label: "signal.zone", value: "A" },
    ]);
  });

  it("answers a case without a kept context", () => {
    const s = summarizeReason({ icu_code: 4, context: null }, dict)!;
    expect(s).toEqual({
      silenceMinutes: null,
      rule: null,
      flags: [],
      details: [],
    });
    expect(summarizeReason(null, dict)).toBeNull();
  });
});

describe("levelAt", () => {
  const steps = [
    { at: "2026-01-01T00:30:00Z", icu_code: 1 },
    { at: "2026-01-01T01:00:00Z", icu_code: 2 },
  ];
  const start = "2026-01-01T00:00:00Z";
  const end = "2026-01-01T02:00:00Z";

  it("follows the case's changes", () => {
    expect(levelAt("2026-01-01T00:00:00Z", start, end, steps, 2)).toBe(1);
    expect(levelAt("2026-01-01T00:45:00Z", start, end, steps, 2)).toBe(1);
    expect(levelAt("2026-01-01T01:30:00Z", start, end, steps, 2)).toBe(2);
  });

  it("is null outside the case", () => {
    expect(levelAt("2025-12-31T23:59:00Z", start, end, steps, 2)).toBeNull();
    expect(levelAt("2026-01-01T02:01:00Z", start, end, steps, 2)).toBeNull();
  });

  it("uses the interval's level without changes", () => {
    expect(levelAt("2026-01-01T01:00:00Z", start, end, [], 3)).toBe(3);
  });
});

describe("caseSpans and pointLevel", () => {
  const header = {
    symptom_info: { id: -12, name: "Pérdida de señal" },
    timeline: [
      {
        conditions_agg: [
          {
            symptom_id: -12,
            start: "2026-01-01T00:00:00Z",
            end: "2026-01-01T01:00:00Z",
            icu_code: "2",
            type: "Pérdida de señal",
          },
          {
            symptom_id: 99,
            start: "2026-01-01T00:00:00Z",
            end: "2026-01-01T05:00:00Z",
            icu_code: "4",
          },
        ],
      },
    ],
    level_reason: lowCoverage,
  };

  it("keeps the page's symptom only", () => {
    const spans = caseSpans(header);
    expect(spans).toHaveLength(1);
    expect(spans[0].level).toBe(2);
    expect(spans[0].name).toBe("Pérdida de señal");
  });

  it("colors a frame in the case and leaves the others", () => {
    const spans = caseSpans(header);
    expect(pointLevel("2026-01-01T00:10:00Z", spans)).toEqual({
      level: 2,
      name: "Pérdida de señal",
    });
    expect(pointLevel("2026-01-01T03:00:00Z", spans)).toBeNull();
    expect(pointLevel(null, spans)).toBeNull();
    expect(caseSpans(null)).toEqual([]);
  });
});
