import { describe, it, expect } from "vitest";
import Handlebars from "handlebars";
import {
  formatNumberHelper,
  extractNumberHelper,
  toFixedHelper,
  roundHelper,
  multiplyHelper,
  divideHelper,
  formatDateHelper,
  datePartHelper,
  timeAgoHelper,
} from "./register-handlebars-helpers";

// ============================================================================
// Helpers to build a mock Handlebars options object
// ============================================================================

function opts(hash: Record<string, unknown> = {}): Handlebars.HelperOptions {
  return { hash } as Handlebars.HelperOptions;
}

// ============================================================================
// Number helpers — unit tests
// ============================================================================

describe("formatNumberHelper", () => {
  it("formats a number with default locale", () => {
    const result = formatNumberHelper.call({}, 1234.5, opts());
    expect(result).toContain("1");
  });

  it("formats with decimals option", () => {
    const result = formatNumberHelper.call({}, 25.678, opts({ decimals: 2 }));
    // es-CL uses comma as decimal separator
    expect(result).toMatch(/25[,.]68/);
  });

  it("adds prefix and suffix", () => {
    const result = formatNumberHelper.call(
      {},
      100,
      opts({ prefix: "$", suffix: " USD" })
    );
    expect(result).toMatch(/^\$.*100.* USD$/);
  });

  it("returns fallback for null", () => {
    expect(formatNumberHelper.call({}, null, opts())).toBe("-");
  });

  it("returns fallback for undefined", () => {
    expect(formatNumberHelper.call({}, undefined, opts())).toBe("-");
  });

  it("returns fallback for non-numeric string", () => {
    expect(formatNumberHelper.call({}, "abc", opts())).toBe("-");
  });

  it("formats string number", () => {
    const result = formatNumberHelper.call({}, "42.5", opts({ decimals: 1 }));
    expect(result).toMatch(/42[,.]5/);
  });
});

describe("extractNumberHelper", () => {
  it('extracts number from "25.5 kg"', () => {
    expect(extractNumberHelper("25.5 kg")).toBe("25.5");
  });

  it('extracts negative number from "-10 C"', () => {
    expect(extractNumberHelper("-10 C")).toBe("-10");
  });

  it('extracts number with comma from "1,5 bar"', () => {
    expect(extractNumberHelper("1,5 bar")).toBe("1,5");
  });

  it("returns fallback for text without numbers", () => {
    expect(extractNumberHelper("no numbers")).toBe("-");
  });

  it("returns fallback for null", () => {
    expect(extractNumberHelper(null)).toBe("-");
  });

  it("returns fallback for undefined", () => {
    expect(extractNumberHelper(undefined)).toBe("-");
  });
});

describe("toFixedHelper", () => {
  it("formats to 2 decimal places", () => {
    expect(toFixedHelper(25.678, 2)).toBe("25.68");
  });

  it("formats to 0 decimal places by default", () => {
    expect(toFixedHelper(25.678, undefined)).toBe("26");
  });

  it("returns fallback for null", () => {
    expect(toFixedHelper(null, 2)).toBe("-");
  });
});

describe("roundHelper", () => {
  it("rounds up", () => {
    expect(roundHelper(25.6)).toBe("26");
  });

  it("rounds down", () => {
    expect(roundHelper(25.4)).toBe("25");
  });

  it("returns fallback for null", () => {
    expect(roundHelper(null)).toBe("-");
  });
});

describe("multiplyHelper", () => {
  it("multiplies two numbers", () => {
    expect(Number(multiplyHelper(0.678, 100))).toBeCloseTo(67.8);
  });

  it("returns fallback when value is null", () => {
    expect(multiplyHelper(null, 100)).toBe("-");
  });

  it("returns fallback when factor is null", () => {
    expect(multiplyHelper(10, null)).toBe("-");
  });
});

describe("divideHelper", () => {
  it("divides two numbers", () => {
    expect(divideHelper(1024, 1024)).toBe("1");
  });

  it("returns fallback for zero divisor", () => {
    expect(divideHelper(10, 0)).toBe("-");
  });

  it("returns fallback for null", () => {
    expect(divideHelper(null, 10)).toBe("-");
  });
});

// ============================================================================
// Date helpers — unit tests
// ============================================================================

describe("formatDateHelper", () => {
  const iso = "2025-06-15T14:30:00Z";

  it("formats as date", () => {
    const result = formatDateHelper.call({}, iso, opts({ format: "date" }));
    expect(result).toContain("15");
    expect(result).toContain("2025");
  });

  it("formats as time", () => {
    const result = formatDateHelper.call({}, iso, opts({ format: "time" }));
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it("formats as datetime (default)", () => {
    const result = formatDateHelper.call({}, iso, opts());
    expect(result).toContain("2025");
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it("formats as relative for recent date", () => {
    const recent = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const result = formatDateHelper.call({}, recent, opts({ format: "relative" }));
    expect(result).toBe("3h");
  });

  it("returns fallback for null", () => {
    expect(formatDateHelper.call({}, null, opts())).toBe("-");
  });

  it("returns fallback for invalid date", () => {
    expect(formatDateHelper.call({}, "not-a-date", opts())).toBe("-");
  });
});

describe("datePartHelper", () => {
  const iso = "2025-06-15T14:30:00Z";

  it("extracts year", () => {
    expect(datePartHelper(iso, "year")).toBe("2025");
  });

  it("extracts month", () => {
    expect(datePartHelper(iso, "month")).toMatch(/^0?6$/);
  });

  it("extracts day", () => {
    expect(datePartHelper(iso, "day")).toMatch(/^1[45]$/);
  });

  it("extracts weekday", () => {
    const result = datePartHelper(iso, "weekday");
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe("-");
  });

  it("returns fallback for unknown part", () => {
    expect(datePartHelper(iso, "unknown")).toBe("-");
  });

  it("returns fallback for null value", () => {
    expect(datePartHelper(null, "year")).toBe("-");
  });
});

describe("timeAgoHelper", () => {
  it("returns 'just now' for current time", () => {
    expect(timeAgoHelper(new Date().toISOString())).toBe("just now");
  });

  it("returns minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(timeAgoHelper(fiveMinAgo)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(timeAgoHelper(twoHoursAgo)).toBe("2h ago");
  });

  it("returns days ago", () => {
    const threeDaysAgo = new Date(
      Date.now() - 3 * 24 * 60 * 60 * 1000
    ).toISOString();
    expect(timeAgoHelper(threeDaysAgo)).toBe("3d ago");
  });

  it("returns fallback for null", () => {
    expect(timeAgoHelper(null)).toBe("-");
  });
});

// ============================================================================
// Integration tests — compile + resolve templates with helpers
// ============================================================================

describe("Handlebars integration", () => {
  it("formatNumber in template", () => {
    const tpl = Handlebars.compile(
      "Temp: {{formatNumber row.temperature decimals=1}}"
    );
    const result = tpl({ row: { temperature: 25.678 } });
    expect(result).toMatch(/Temp: 25[,.]7/);
  });

  it("extractNumber in template", () => {
    const tpl = Handlebars.compile("{{extractNumber row.reading}}");
    expect(tpl({ row: { reading: "120 rpm" } })).toBe("120");
  });

  it("toFixed in template", () => {
    const tpl = Handlebars.compile("{{toFixed row.value 2}}");
    expect(tpl({ row: { value: 3.14159 } })).toBe("3.14");
  });

  it("round in template", () => {
    const tpl = Handlebars.compile("{{round row.value}}");
    expect(tpl({ row: { value: 3.7 } })).toBe("4");
  });

  it("multiply in template", () => {
    const tpl = Handlebars.compile("{{multiply row.ratio 100}}%");
    expect(tpl({ row: { ratio: 0.85 } })).toBe("85%");
  });

  it("divide in template", () => {
    const tpl = Handlebars.compile("{{divide row.bytes 1024}} KB");
    expect(tpl({ row: { bytes: 2048 } })).toBe("2 KB");
  });

  it("formatDate in template", () => {
    const tpl = Handlebars.compile(
      '{{formatDate row.created_at format="date"}}'
    );
    const result = tpl({ row: { created_at: "2025-06-15T14:30:00Z" } });
    expect(result).toContain("15");
    expect(result).toContain("2025");
  });

  it("datePart in template", () => {
    const tpl = Handlebars.compile('{{datePart row.created_at "year"}}');
    expect(tpl({ row: { created_at: "2025-06-15T14:30:00Z" } })).toBe("2025");
  });

  it("timeAgo in template", () => {
    const recent = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const tpl = Handlebars.compile("{{timeAgo row.ts}}");
    expect(tpl({ row: { ts: recent } })).toBe("5m ago");
  });

  it("handles missing value gracefully", () => {
    const tpl = Handlebars.compile("{{formatNumber row.missing decimals=2}}");
    expect(tpl({ row: {} })).toBe("-");
  });

  it("combines multiple helpers", () => {
    const tpl = Handlebars.compile(
      '{{formatNumber row.temp decimals=1}}°C at {{formatDate row.ts format="time"}}'
    );
    const result = tpl({
      row: { temp: 25.678, ts: "2025-06-15T14:30:00Z" },
    });
    expect(result).toMatch(/25[,.]7°C at \d{2}:\d{2}/);
  });
});
