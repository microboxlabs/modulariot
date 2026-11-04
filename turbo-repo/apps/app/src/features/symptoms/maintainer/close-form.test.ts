import { describe, expect, it } from "vitest";
import {
  closeFields,
  compileCloseRows,
  compileNoteRows,
  parseCloseRows,
  parseNoteRows,
} from "./close-form";

const FIELDS = closeFields([
  "case.level",
  "signal.trip.active",
  "signal.frame.events",
  "signal.frame.events.event_type",
]);

describe("closeFields", () => {
  it("finds the source's event list and trip-active flag", () => {
    expect(FIELDS).toEqual({
      events: "signal.frame.events",
      tripActive: "signal.trip.active",
    });
    expect(closeFields(["case.level"])).toEqual({
      events: null,
      tripActive: null,
    });
  });
});

describe("close rows", () => {
  it("reads the lost-signal rule as two rows and writes it back the same", () => {
    const rule =
      "case.closed_by_operator || (case.level <= 3 && case.normal_s >= 0)";
    const rows = parseCloseRows(rule, FIELDS);
    expect(rows).toEqual([
      { when: { kind: "operator" }, maxLevel: null },
      { when: { kind: "normal", minutes: 0 }, maxLevel: 3 },
    ]);
    expect(compileCloseRows(rows!)).toBe(
      "case.closed_by_operator || (case.normal_s >= 0 && case.level <= 3)"
    );
    expect(parseCloseRows(compileCloseRows(rows!), FIELDS)).toEqual(rows);
  });

  it("reads every kind", () => {
    const rule = [
      "case.normal_s >= 300",
      "case.age_h >= 12",
      "!signal.trip.active",
      'signal.frame.events.exists(e, e.event_type == "trip_end")',
    ].join(" || ");
    expect(parseCloseRows(rule, FIELDS)).toEqual([
      { when: { kind: "normal", minutes: 5 }, maxLevel: null },
      { when: { kind: "age", hours: 12 }, maxLevel: null },
      {
        when: { kind: "tripEnded", path: "signal.trip.active" },
        maxLevel: null,
      },
      {
        when: {
          kind: "event",
          path: "signal.frame.events",
          eventType: "trip_end",
        },
        maxLevel: null,
      },
    ]);
    expect(parseCloseRows("signal.trip.active == false", FIELDS)).toEqual([
      {
        when: { kind: "tripEnded", path: "signal.trip.active" },
        maxLevel: null,
      },
    ]);
  });

  it("writes one row with a level without parentheses", () => {
    expect(
      compileCloseRows([{ when: { kind: "age", hours: 2 }, maxLevel: 2 }])
    ).toBe("case.age_h >= 2 && case.level <= 2");
  });

  it("keeps unknown conjuncts in CEL instead of dropping them", () => {
    for (const rule of [
      "signal.custom && case.closed_by_operator",
      "signal.custom && case.normal_s >= 0",
      "signal.custom && case.level <= 3",
      "case.closed_by_operator && signal.custom",
      "signal.custom && case.closed_by_operator || case.age_h >= 12",
    ])
      expect(parseCloseRows(rule, FIELDS)).toBeNull();
  });

  it("is null for what the rows cannot say, and empty for no rule", () => {
    expect(
      parseCloseRows("case.normal_s >= 0 && case.age_h >= 1", FIELDS)
    ).toBeNull();
    expect(parseCloseRows("case.level > 2", FIELDS)).toBeNull();
    expect(parseCloseRows("(case.closed_by_operator", FIELDS)).toBeNull();
    expect(parseCloseRows("!other.flag", FIELDS)).toBeNull();
    expect(parseCloseRows("  ", FIELDS)).toEqual([]);
  });
});

describe("note rows", () => {
  it("reads one event per row, and a list of types as one row each", () => {
    const rule =
      'signal.frame.events.exists(e, e.event_type == "main_power_reconnect") || ' +
      'signal.frame.events.exists(e, e.event_type in ["gps_jamming", "door_open"])';
    const rows = parseNoteRows(rule);
    expect(rows?.map((r) => r.eventType)).toEqual([
      "main_power_reconnect",
      "gps_jamming",
      "door_open",
    ]);
    expect(parseNoteRows(compileNoteRows(rows!))).toEqual(rows);
  });

  it("is null for other conditions and empty for no rule", () => {
    expect(parseNoteRows("case.level <= 2")).toBeNull();
    expect(parseNoteRows("")).toEqual([]);
  });
});
