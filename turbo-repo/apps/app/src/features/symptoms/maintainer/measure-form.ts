import { decimalText, exactNumber, isNumeric } from "./condition-form";
import { compileThresholds, parseThresholds } from "./level-thresholds";
import type { SourceField, SymptomSpec } from "./maintainer-api";

/** What is subtracted from the measure's field: another field or a number. */
export type Minus =
  | { kind: "field"; path: string }
  | { kind: "number"; value: number };

/** The measure as the form shows it: a field, minus another field or a number. */
export interface MeasureForm {
  field: string;
  minus: Minus | null;
}

type Measure = NonNullable<SymptomSpec["measure"]>;

const PATH = String.raw`[A-Za-z_][\w.]*`;
const SHAPE = new RegExp(String.raw`^(${PATH})(?:\s*-\s*(\S+))?$`);

/** The numeric fields a measure can read, in source order. */
export function measureFields(fields: SourceField[]): SourceField[] {
  return fields.filter((f) => isNumeric(f.type));
}

/**
 * The form of a measure written as `field` or `field - field|number` over
 * numeric fields of the source; null for any other expression.
 */
export function parseMeasure(
  expression: string | null,
  fields: SourceField[]
): MeasureForm | null {
  const m = SHAPE.exec((expression ?? "").trim());
  if (!m) return null;
  const numeric = new Set(measureFields(fields).map((f) => f.path));
  const [, field = "", other] = m;
  if (!numeric.has(field)) return null;
  if (other === undefined) return { field, minus: null };
  if (numeric.has(other))
    return { field, minus: { kind: "field", path: other } };
  const value = exactNumber(other);
  return value === null ? null : { field, minus: { kind: "number", value } };
}

// Source numbers are CEL doubles and "-" takes two of one type, so 90 is written 90.0.
function doubleLiteral(n: number): string {
  const text = decimalText(n);
  return text.includes(".") ? text : `${text}.0`;
}

export function compileMeasure(form: MeasureForm): string {
  if (!form.minus) return form.field;
  const other =
    form.minus.kind === "field"
      ? form.minus.path
      : doubleLiteral(form.minus.value);
  return `${form.field} - ${other}`;
}

/**
 * The measure after a form change: its expression, and a name and unit taken
 * from the fields while the owner has not written their own.
 */
export function measureFromForm(
  form: MeasureForm,
  previous: Measure | null | undefined,
  fields: SourceField[]
): Measure {
  const byPath = new Map(fields.map((f) => [f.path, f]));
  const before = previous?.expression
    ? parseMeasure(previous.expression, fields)
    : null;
  const derived = (f: MeasureForm | null) => {
    const main = f ? byPath.get(f.field) : undefined;
    if (!main) return { label: null, unit: null };
    let minus: string | null | undefined = null;
    if (f?.minus?.kind === "field") minus = byPath.get(f.minus.path)?.label;
    else if (f?.minus) minus = decimalText(f.minus.value);
    return {
      label: minus ? `${main.label} − ${minus}` : main.label,
      unit: main.unit,
    };
  };
  const old = derived(before);
  const next = derived(form);
  const keepLabel = previous?.label && previous.label !== old.label;
  const keepUnit = previous?.unit && previous.unit !== old.unit;
  return {
    expression: compileMeasure(form),
    label: keepLabel ? (previous?.label ?? null) : next.label,
    unit: keepUnit ? (previous?.unit ?? null) : next.unit,
  };
}

// The level variable, not a field path segment such as signal.sensor.measure.
const MEASURE_WORD = /(?<![.\w])measure\b/;

/** True when a level that applies compares the measure. */
export function levelsUseMeasure(spec: SymptomSpec): boolean {
  return (spec.levels ?? []).some(
    (l) => l.applies && MEASURE_WORD.test(l.when ?? "")
  );
}

/**
 * The spec with no measure. Levels written as thresholds lose their measure
 * bounds and keep the time held; other rules are left for the owner to edit.
 */
export function withoutMeasure(spec: SymptomSpec): SymptomSpec {
  const noMeasure = { lower: null, upper: null };
  return {
    ...spec,
    measure: null,
    levels:
      spec.levels?.map((l) => {
        const t = parseThresholds(l.when);
        return t
          ? { ...l, when: compileThresholds({ ...t, measure: noMeasure }) }
          : l;
      }) ?? null,
  };
}
