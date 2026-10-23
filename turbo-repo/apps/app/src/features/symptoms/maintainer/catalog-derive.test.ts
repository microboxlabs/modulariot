import { describe, expect, it } from "vitest";
import {
  channelGroups,
  formatAmount,
  lastPublished,
  operatorLevels,
  reachableLevels,
  shortThreshold,
  whoActsKind,
} from "./catalog-derive";
import type { Level, SymptomSpec, SymptomSummary } from "./maintainer-api";

const level = (icu: number, when: string | null, applies = true): Level => ({
  icu,
  applies,
  when,
  response: null,
});

describe("shortThreshold", () => {
  it("reads the speeding ladder", () => {
    expect(shortThreshold(level(1, "measure > 0 && measure < 5"), "km/h")).toBe(
      "< 5 km/h"
    );
    expect(
      shortThreshold(level(2, "measure >= 5 && measure < 11"), "km/h")
    ).toBe("≥ 5 km/h");
    expect(
      shortThreshold(level(4, "measure >= 21 && held_s >= 60"), "km/h")
    ).toBe("≥ 21 km/h · 1 min");
    expect(shortThreshold(level(4, "measure > 21"), "km/h")).toBe("> 21 km/h");
  });

  it("writes minutes as the prototype does", () => {
    expect(
      shortThreshold(level(2, "measure >= 90 && measure < 120"), "min")
    ).toBe("≥ 90 min");
    expect(
      shortThreshold(level(3, "measure >= 120 && measure < 180"), "min")
    ).toBe("≥ 2 h");
    expect(shortThreshold(level(3, "measure >= 330"), "min")).toBe("≥ 5 h 30");
  });

  it("keeps an inclusive upper bound inclusive", () => {
    expect(shortThreshold(level(1, "measure <= 5"), "km/h")).toBe("≤ 5 km/h");
    expect(shortThreshold(level(1, "measure < 5"), "km/h")).toBe("< 5 km/h");
  });

  it("marks fixed, custom and missing levels", () => {
    expect(shortThreshold(level(3, "true"), null)).toBe("fixed");
    expect(shortThreshold(level(3, "measure * 2 > 3"), null)).toBe("custom");
    expect(shortThreshold(level(1, null), null)).toBeNull();
    expect(shortThreshold(level(1, "measure < 5", false), null)).toBeNull();
    expect(shortThreshold(undefined, null)).toBeNull();
  });
});

describe("formatAmount", () => {
  it("keeps other units as they are", () => {
    expect(formatAmount(28000, "kg")).toBe("28000 kg");
    expect(formatAmount(3, null)).toBe("3");
    expect(formatAmount(45, "s")).toBe("45 s");
  });
});

describe("levels, operators and channels", () => {
  const spec = {
    levels: [
      level(1, "measure > 0 && measure < 5"),
      level(2, "x", false),
      {
        ...level(3, "measure >= 11"),
        response: {
          operator: true,
          slaMinutes: 5,
          steps: [],
          notices: [
            {
              when: "open",
              channel: "whatsapp",
              channelId: null,
              recipient: null,
            },
            {
              when: "open",
              channel: "teams",
              channelId: null,
              recipient: null,
            },
          ],
          evidence: [],
          ignorable: false,
        },
      },
      {
        ...level(4, "measure >= 21"),
        response: {
          operator: false,
          slaMinutes: null,
          steps: [],
          notices: [
            {
              when: "close",
              channel: "email",
              channelId: null,
              recipient: null,
            },
          ],
          evidence: [],
          ignorable: false,
        },
      },
    ],
  } as unknown as SymptomSpec;

  it("derives what the card shows", () => {
    expect(operatorLevels(spec)).toEqual([false, false, true, false]);
    expect(channelGroups(spec)).toEqual(["chat", "email"]);
    expect(reachableLevels(spec)).toEqual([1, 3, 4]);
    expect(operatorLevels(null)).toEqual([false, false, false, false]);
  });
});

describe("lastPublished", () => {
  const summary = (name: string, publishedAt: string | null) =>
    ({
      definition: { id: name, name },
      hasDraft: false,
      current: publishedAt
        ? {
            version: "1.0.0",
            publishedAt,
            publishedBy: "owner@example.com",
            reason: "Primera",
          }
        : null,
    }) as unknown as SymptomSummary;

  it("picks the newest version in force, whatever the offset", () => {
    const last = lastPublished([
      summary("a", "2026-09-29T10:00:00Z"),
      summary("b", "2026-09-29T08:00:00-03:00"),
      summary("c", null),
    ]);
    expect(last?.name).toBe("b");
    expect(last?.reason).toBe("Primera");
  });

  it("is null before anything is published", () => {
    expect(lastPublished([summary("c", null)])).toBeNull();
  });
});

describe("whoActsKind", () => {
  const spec = (levels: Level[]): SymptomSpec => ({
    source: "gps_signal",
    activation: "true",
    measure: null,
    levels,
    lifecycle: null,
    recurrence: null,
  });
  const response = (operator: boolean, channels: string[]) => ({
    operator,
    slaMinutes: null,
    steps: [],
    notices: channels.map((channel) => ({
      when: "open",
      channel,
      channelId: null,
      recipient: null,
    })),
    evidence: [],
    ignorable: false,
  });

  it("tells operator, notices only and no response apart", () => {
    expect(
      whoActsKind(
        spec([
          { icu: 4, applies: true, when: "true", response: response(true, []) },
        ])
      )
    ).toBe("operator");
    expect(
      whoActsKind(
        spec([
          {
            icu: 4,
            applies: true,
            when: "true",
            response: response(false, ["email"]),
          },
        ])
      )
    ).toBe("notices");
    expect(
      whoActsKind(
        spec([
          {
            icu: 4,
            applies: true,
            when: "true",
            response: response(false, []),
          },
        ])
      )
    ).toBe("none");
    expect(whoActsKind(null)).toBe("none");
  });
});
