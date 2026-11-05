import { describe, expect, it } from "vitest";
import {
  caseSpans,
  levelAt,
  pointLevel,
  type LevelReason,
} from "./level-reason";

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
