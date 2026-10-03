import { describe, expect, it } from "vitest";
import {
  type ConditionForm,
  compileConditions,
  decimalText,
  exactNumber,
  formatRule,
  moveRow,
  newCondition,
  opsFor,
  parseConditions,
  squashSpaces,
} from "./condition-form";
import type { SourceField } from "./maintainer-api";

const field = (
  path: string,
  type: string,
  values?: { value: string; label: string }[]
): SourceField => ({
  path,
  label: path,
  type,
  unit: null,
  origin: null,
  engineSupported: true,
  values,
});

const FIELDS = [
  field("signal.trip.active", "bool"),
  field("signal.trip.double_driver", "bool"),
  field("signal.gps.moving", "bool"),
  field("signal.geo.authorized_zone", "bool"),
  field("signal.road.maxspeed_osm", "number"),
  field("signal.road.maxspeed_custom", "number"),
  field("signal.local_hour", "number"),
  field("signal.gps.speed_kmh", "number"),
  field("signal.geo.zone", "zone"),
  field("signal.vehicle.weight_category", "list", [
    { value: "HEAVY", label: "Pesado" },
    { value: "LIGHT", label: "Liviano" },
  ]),
  field("event.type", "text"),
  field("check.trip.active", "bool"),
  field("check.trip.double_driver", "bool"),
];

/** Strips the generated ids so forms compare by content. */
function shape(form: ConditionForm | null) {
  if (!form) return null;
  const rows = (rs: ConditionForm["rows"]) =>
    rs.map(({ path, op, value }) => ({ path, op, value }));
  return {
    match: form.match,
    rows: rows(form.rows),
    groups: form.groups.map((g) => ({ match: g.match, rows: rows(g.rows) })),
  };
}

/** The rule read into the form and written back, compared without its line breaks. */
function roundTrip(rule: string) {
  const form = parseConditions(rule, FIELDS);
  expect(form, rule).not.toBeNull();
  return squashSpaces(compileConditions(form as ConditionForm));
}

describe("parseConditions", () => {
  it("reads every platform template activation and writes it back unchanged", () => {
    for (const rule of [
      "signal.trip.active && signal.road.maxspeed_osm > 0",
      "signal.trip.active && signal.road.maxspeed_custom > 0",
      "signal.trip.active && !signal.gps.moving && !signal.geo.authorized_zone && (signal.local_hour >= 21 || signal.local_hour < 6)",
      "signal.trip.active && signal.gps.moving && !signal.trip.double_driver && signal.local_hour >= 2 && signal.local_hour < 6",
      "check.trip.active && !check.trip.double_driver",
      "check.trip.active",
      'event.type == "SOS"',
    ]) {
      expect(roundTrip(rule)).toBe(rule);
    }
  });

  it("shows yes/no fields, numbers and list values as typed rows", () => {
    expect(
      shape(
        parseConditions(
          'signal.trip.active && !signal.gps.moving && signal.gps.speed_kmh >= 90.5 && signal.vehicle.weight_category != "LIGHT"',
          FIELDS
        )
      )
    ).toEqual({
      match: "all",
      rows: [
        { path: "signal.trip.active", op: "is_true", value: null },
        { path: "signal.gps.moving", op: "is_false", value: null },
        { path: "signal.gps.speed_kmh", op: ">=", value: 90.5 },
        { path: "signal.vehicle.weight_category", op: "!=", value: "LIGHT" },
      ],
      groups: [],
    });
  });

  it("reads == true and != true on yes/no fields", () => {
    expect(
      shape(parseConditions("signal.trip.active == true", FIELDS))?.rows[0]?.op
    ).toBe("is_true");
    expect(
      shape(parseConditions("signal.trip.active != true", FIELDS))?.rows[0]?.op
    ).toBe("is_false");
    expect(
      shape(parseConditions("signal.trip.active == false", FIELDS))?.rows[0]?.op
    ).toBe("is_false");
  });

  it("reads groups: any, all and an exception", () => {
    expect(
      shape(
        parseConditions(
          'signal.trip.active && (signal.geo.zone == "A" || signal.geo.zone == "B") && !(signal.gps.moving || signal.local_hour < 6)',
          FIELDS
        )
      )?.groups.map((g) => g.match)
    ).toEqual(["any", "none"]);
  });

  it("reads an any group next to plain conditions as a group", () => {
    const form = parseConditions(
      '(signal.geo.zone == "A" || signal.geo.zone == "B") && signal.trip.active',
      FIELDS
    );
    expect(shape(form)).toEqual({
      match: "all",
      rows: [{ path: "signal.trip.active", op: "is_true", value: null }],
      groups: [
        {
          match: "any",
          rows: [
            { path: "signal.geo.zone", op: "==", value: "A" },
            { path: "signal.geo.zone", op: "==", value: "B" },
          ],
        },
      ],
    });
    expect(compileConditions(form as ConditionForm)).toBe(
      'signal.trip.active\n&& (signal.geo.zone == "A" || signal.geo.zone == "B")'
    );
  });

  it("reads a rule that is only an any group and exceptions as an any list", () => {
    expect(
      shape(
        parseConditions(
          '(signal.geo.zone == "A" || signal.geo.zone == "B") && !(signal.gps.moving)',
          FIELDS
        )
      )
    ).toMatchObject({ match: "any", groups: [{ match: "none" }] });
  });

  it("reads a rule of conditions joined by o", () => {
    expect(
      shape(
        parseConditions('event.type == "SOS" || event.type == "AAS"', FIELDS)
      )?.match
    ).toBe("any");
    expect(roundTrip('event.type == "SOS" || event.type == "AAS"')).toBe(
      'event.type == "SOS" || event.type == "AAS"'
    );
  });

  it("reads an empty rule or true as no conditions", () => {
    expect(shape(parseConditions("", FIELDS))).toEqual({
      match: "all",
      rows: [],
      groups: [],
    });
    expect(shape(parseConditions("true", FIELDS))).toEqual({
      match: "all",
      rows: [],
      groups: [],
    });
  });

  it("keeps spaces inside values and accepts line breaks between conditions", () => {
    expect(
      roundTrip('signal.trip.active\n&& signal.geo.zone == "Faena  Norte"')
    ).toBe('signal.trip.active && signal.geo.zone == "Faena  Norte"');
  });

  it("reads quotes, backslashes and parentheses inside values", () => {
    for (const rule of [
      'signal.geo.zone == "say \\"hi\\""',
      'signal.geo.zone == "a\\\\b" && signal.trip.active',
      'signal.geo.zone == "Faena (Norte) && Sur" && signal.trip.active',
      '!(signal.geo.zone == "x\\")y")',
    ]) {
      expect(roundTrip(rule)).toBe(rule);
    }
    expect(
      shape(parseConditions('signal.geo.zone == "say \\"hi\\""', FIELDS))
        ?.rows[0]?.value
    ).toBe('say "hi"');
  });

  it("returns null for logic the form cannot show", () => {
    for (const rule of [
      "signal.trip.active && signal.gps.speed_kmh > signal.road.maxspeed_osm", // field against field
      "signal.gps.speed_kmh - signal.road.maxspeed_osm > 10", // calculation
      "signal.unknown.field > 3", // not in the source
      "signal.trip.active || signal.gps.moving && signal.local_hour < 6", // mixed at the top
      "signal.trip.active || (signal.gps.moving && signal.local_hour < 6)", // group under o
      "signal.trip.active && ((signal.gps.moving || signal.local_hour < 6) && signal.trip.double_driver)", // nested
      "signal.trip.active && !(signal.gps.moving && signal.local_hour < 6)", // not all
      "signal.gps.speed_kmh > 1e3", // number syntax the form does not write
      "signal.gps.speed_kmh > 9007199254740993", // more digits than a number keeps
      "signal.gps.speed_kmh > 0.1000000000000000055511151231257827", // the same
      "signal.gps.speed_kmh > 007", // leading zeros
      'signal.gps.speed_kmh > "90"', // text on a number field
      'signal.geo.zone > "A"', // order on text
      "signal.geo.zone == 'A'", // single quotes
      'signal.geo.zone == "\\x41"', // an escape the form does not write
      "signal.trip.active == 1", // number on a yes/no field
      "signal.trip.active && (signal.gps.moving", // unbalanced
      "signal.local_hour in [1, 2]", // list membership
    ]) {
      expect(parseConditions(rule, FIELDS), rule).toBeNull();
    }
  });
});

describe("numbers and durations", () => {
  it("keeps numbers exactly, dropping only trailing zeros", () => {
    expect(roundTrip("signal.gps.speed_kmh > 90.5")).toBe(
      "signal.gps.speed_kmh > 90.5"
    );
    expect(roundTrip("signal.gps.speed_kmh > 90.50")).toBe(
      "signal.gps.speed_kmh > 90.5"
    );
    expect(roundTrip("signal.gps.speed_kmh > 90.0")).toBe(
      "signal.gps.speed_kmh > 90"
    );
    expect(roundTrip("signal.gps.speed_kmh >= -0.0")).toBe(
      "signal.gps.speed_kmh >= 0"
    );
    expect(roundTrip("signal.gps.speed_kmh < 9007199254740991")).toBe(
      "signal.gps.speed_kmh < 9007199254740991"
    );
  });

  it("writes numbers as plain decimals that read back the same", () => {
    expect(decimalText(1e-7)).toBe("0.0000001");
    expect(decimalText(1.5e-7)).toBe("0.00000015");
    expect(decimalText(-2.5e-8)).toBe("-0.000000025");
    expect(decimalText(1e21)).toBe("1000000000000000000000");
    expect(decimalText(123.25)).toBe("123.25");
    for (const n of [1e-7, 0.1, 2.5e-12, 90, -0.5]) {
      const rule = compileConditions({
        match: "all",
        rows: [{ id: "r", path: "signal.gps.speed_kmh", op: ">", value: n }],
        groups: [],
      });
      expect(shape(parseConditions(rule, FIELDS))?.rows[0]?.value, rule).toBe(
        n
      );
    }
    expect(exactNumber(" 0.0000001 ")).toBe(1e-7);
    expect(exactNumber("1e-7")).toBeNull();
    expect(exactNumber("1,5")).toBeNull();
    expect(exactNumber("-")).toBeNull();
  });

  it("treats durations as numbers", () => {
    const fields = [...FIELDS, field("check.stopped_s", "duration")];
    const form = parseConditions("check.stopped_s >= 600", fields);
    expect(shape(form)?.rows).toEqual([
      { path: "check.stopped_s", op: ">=", value: 600 },
    ]);
    expect(opsFor("duration")).toEqual(opsFor("number"));
    expect(newCondition(fields.at(-1) as SourceField)).toMatchObject({
      op: ">",
      value: 0,
    });
  });
});

describe("compileConditions", () => {
  it("puts each top-level condition on its own line, starting with &&", () => {
    const form = parseConditions(
      'signal.trip.active && signal.gps.speed_kmh > 90 && (signal.geo.zone == "A" || signal.geo.zone == "B")',
      FIELDS
    ) as ConditionForm;
    expect(compileConditions(form)).toBe(
      'signal.trip.active\n&& signal.gps.speed_kmh > 90\n&& (signal.geo.zone == "A" || signal.geo.zone == "B")'
    );
  });

  it("writes true for an empty form", () => {
    expect(compileConditions({ match: "all", rows: [], groups: [] })).toBe(
      "true"
    );
  });

  it("skips empty groups and wraps an any list that is followed by groups", () => {
    const form = parseConditions(
      "signal.trip.active || signal.gps.moving",
      FIELDS
    ) as ConditionForm;
    form.groups.push({ id: "g1", match: "none", rows: [] });
    expect(compileConditions(form)).toBe(
      "signal.trip.active || signal.gps.moving"
    );
    form.groups.push({
      id: "g2",
      match: "none",
      rows: [{ id: "r", path: "signal.geo.zone", op: "==", value: "Puerto" }],
    });
    expect(compileConditions(form)).toBe(
      '(signal.trip.active || signal.gps.moving)\n&& !(signal.geo.zone == "Puerto")'
    );
    expect(shape(parseConditions(compileConditions(form), FIELDS))?.match).toBe(
      "any"
    );
  });

  it("escapes quotes in text values", () => {
    expect(
      compileConditions({
        match: "all",
        rows: [{ id: "r", path: "event.type", op: "==", value: 'a"b' }],
        groups: [],
      })
    ).toBe('event.type == "a\\"b"');
  });
});

describe("newCondition and opsFor", () => {
  it("starts each type with an operator and a value it accepts", () => {
    const bool = FIELDS[0] as SourceField;
    const list = FIELDS.find((f) => f.type === "list") as SourceField;
    const num = FIELDS.find((f) => f.type === "number") as SourceField;
    expect(newCondition(bool)).toMatchObject({ op: "is_true", value: null });
    expect(newCondition(list)).toMatchObject({ op: "==", value: "HEAVY" });
    expect(newCondition(num)).toMatchObject({ op: ">", value: 0 });
    expect(opsFor("zone")).toEqual(["==", "!="]);
    expect(newCondition(bool).id).not.toBe(newCondition(bool).id);
  });
});

describe("formatRule", () => {
  it("starts each top-level && on a new line and leaves the rest alone", () => {
    expect(formatRule("a && b > 1 && (c || d)")).toBe(
      "a\n&& b > 1\n&& (c || d)"
    );
    expect(formatRule("a\n&& b")).toBe("a\n&& b");
    expect(formatRule('x == "p && q" && has(y.z) && f(a && b)')).toBe(
      'x == "p && q"\n&& has(y.z)\n&& f(a && b)'
    );
    expect(formatRule('x == "a\\" && b" && c')).toBe('x == "a\\" && b"\n&& c');
    expect(formatRule("a || b")).toBe("a || b");
    expect(formatRule("a && b // and c && d")).toBe("a && b // and c && d");
    expect(formatRule("a &&")).toBe("a &&");
    expect(formatRule("")).toBe("");
  });
});

describe("squashSpaces", () => {
  it("makes runs of whitespace one space, except inside quotes", () => {
    expect(squashSpaces("  a\n&&   b  ")).toBe("a && b");
    expect(squashSpaces('x == "a  b" &&\ty')).toBe('x == "a  b" && y');
    expect(squashSpaces('x == "a \\"  b"  && y')).toBe('x == "a \\"  b" && y');
    expect(squashSpaces("x == 'p  q'")).toBe("x == 'p  q'");
  });
});

describe("moveRow", () => {
  it("moves one row and leaves the list alone when an index is out of range", () => {
    const rows = ["a", "b", "c"];
    expect(moveRow(rows, 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveRow(rows, 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveRow(rows, 0, -1)).toBe(rows);
    expect(moveRow(rows, 2, 3)).toBe(rows);
    expect(moveRow(rows, -1, 0)).toBe(rows);
    expect(moveRow(rows, 1, 1)).toBe(rows);
    expect(rows).toEqual(["a", "b", "c"]);
  });
});
