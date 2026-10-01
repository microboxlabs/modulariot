import { describe, expect, it } from "vitest";
import {
  channelGroups,
  formatAmount,
  operatorLevels,
  reachableLevels,
  shortThreshold,
} from "./catalog-derive";
import type { Level, SymptomSpec } from "./maintainer-api";

const level = (icu: number, when: string | null, applies = true): Level => ({
  icu,
  applies,
  when,
  response: null,
});

describe("shortThreshold", () => {
  it("reads the speeding ladder", () => {
    expect(shortThreshold(level(1, "medida > 0 && medida < 5"), "km/h")).toBe(
      "< 5 km/h"
    );
    expect(shortThreshold(level(2, "medida >= 5 && medida < 11"), "km/h")).toBe(
      "≥ 5 km/h"
    );
    expect(
      shortThreshold(level(4, "medida >= 21 && sostenido_s >= 60"), "km/h")
    ).toBe("≥ 21 km/h · 1 min");
    expect(shortThreshold(level(4, "medida > 21"), "km/h")).toBe("> 21 km/h");
  });

  it("writes minutes as the prototype does", () => {
    expect(
      shortThreshold(level(2, "medida >= 90 && medida < 120"), "min")
    ).toBe("≥ 90 min");
    expect(
      shortThreshold(level(3, "medida >= 120 && medida < 180"), "min")
    ).toBe("≥ 2 h");
    expect(shortThreshold(level(3, "medida >= 330"), "min")).toBe("≥ 5 h 30");
  });

  it("marks fixed, custom and missing levels", () => {
    expect(shortThreshold(level(3, "true"), null)).toBe("fixed");
    expect(shortThreshold(level(3, "medida * 2 > 3"), null)).toBe("custom");
    expect(shortThreshold(level(1, null), null)).toBeNull();
    expect(shortThreshold(level(1, "medida < 5", false), null)).toBeNull();
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
      level(1, "medida > 0 && medida < 5"),
      level(2, "x", false),
      {
        ...level(3, "medida >= 11"),
        response: {
          operator: true,
          slaMinutes: 5,
          steps: [],
          notices: [
            {
              when: "open",
              channel: "whatsapp",
              connectionId: null,
              templateId: null,
              recipient: null,
            },
            {
              when: "open",
              channel: "teams",
              connectionId: null,
              templateId: null,
              recipient: null,
            },
          ],
          evidence: [],
          ignorable: false,
        },
      },
      {
        ...level(4, "medida >= 21"),
        response: {
          operator: false,
          slaMinutes: null,
          steps: [],
          notices: [
            {
              when: "close",
              channel: "email",
              connectionId: null,
              templateId: null,
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
