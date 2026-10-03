import { decimalText, exactNumber } from "./condition-form";

export type LowerOp = ">" | ">=";
export type UpperOp = "<" | "<=";

export interface Bound<Op> {
  op: Op;
  value: number;
}

/** The range of one level variable: from a lower bound up to an upper one, either may be missing. */
export interface Range {
  lower: Bound<LowerOp> | null;
  upper: Bound<UpperOp> | null;
}

/** A level's rule as the form shows it: a range on the measure and a range on the hold time. */
export interface LevelThresholds {
  measure: Range;
  held: Range;
}

const VARIABLES = { medida: "measure", sostenido_s: "held" } as const;
type Variable = keyof typeof VARIABLES;
const TERM = /^(medida|sostenido_s)\s*(>=|<=|>|<)\s*(\S+)$/;

const emptyRange = (): Range => ({ lower: null, upper: null });

/** Puts one bound into its range; false when the range already has one on that side. */
function place(range: Range, op: string, value: number): boolean {
  if (op === ">" || op === ">=") {
    if (range.lower) return false;
    range.lower = { op, value };
    return true;
  }
  if (range.upper) return false;
  range.upper = { op: op as UpperOp, value };
  return true;
}

/**
 * The thresholds of a level rule written as bounds on medida and sostenido_s
 * joined by "&&", such as "medida >= 20 && sostenido_s >= 60"; null for
 * anything else (o, parentheses, other variables, two bounds on one side).
 */
export function parseThresholds(when: string | null): LevelThresholds | null {
  const text = (when ?? "").trim();
  const out: LevelThresholds = { measure: emptyRange(), held: emptyRange() };
  if (text === "" || text === "true") return out;
  if (/[()"|!]/.test(text)) return null;
  for (const part of text.split("&&")) {
    const m = TERM.exec(part.trim());
    if (!m) return null;
    const [, variable = "", op = "", raw = ""] = m;
    const value = exactNumber(raw);
    if (value === null) return null;
    if (!place(out[VARIABLES[variable as Variable]], op, value)) return null;
  }
  return out;
}

function rangeTerms(variable: Variable, range: Range): string[] {
  const terms: string[] = [];
  if (range.lower)
    terms.push(
      `${variable} ${range.lower.op} ${decimalText(range.lower.value)}`
    );
  if (range.upper)
    terms.push(
      `${variable} ${range.upper.op} ${decimalText(range.upper.value)}`
    );
  return terms;
}

/** The level rule for its thresholds: measure first, lower bound before upper; "true" when there are none. */
export function compileThresholds(t: LevelThresholds): string {
  const terms = [
    ...rangeTerms("medida", t.measure),
    ...rangeTerms("sostenido_s", t.held),
  ];
  return terms.length === 0 ? "true" : terms.join(" && ");
}
