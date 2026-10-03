import type { SourceField } from "./maintainer-api";

/** How the conditions of a list combine: all of them, any of them, or none of them (an exception). */
export type Match = "all" | "any" | "none";

export type ConditionOp =
  | "is_true"
  | "is_false"
  | "=="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<=";

export interface Condition {
  id: string;
  path: string;
  op: ConditionOp;
  /** A number for number fields, text otherwise; null for yes/no fields. */
  value: number | string | null;
}

export interface ConditionGroup {
  id: string;
  match: Match;
  rows: Condition[];
}

/** An activation rule as the form shows it: one list of conditions plus groups joined with "y". */
export interface ConditionForm {
  match: "all" | "any";
  rows: Condition[];
  groups: ConditionGroup[];
}

const ORDER_OPS: ConditionOp[] = [">", ">=", "<", "<="];
const NUMBER = /^-?\d+(\.\d+)?$/;
const STRING = /^"(?:[^"\\]|\\.)*"$/;
const COMPARISON = /^([A-Za-z_][\w.]*)\s*(==|!=|>=|<=|>|<)/;

let nextId = 0;
export const newId = () => `cond-${++nextId}`;

/** The operators a field of this type offers. */
export function opsFor(type: string): ConditionOp[] {
  if (type === "bool") return ["is_true", "is_false"];
  if (type === "number") return [...ORDER_OPS, "==", "!="];
  return ["==", "!="];
}

/** A new condition on a field, with the first operator and a value that makes sense for it. */
export function newCondition(field: SourceField): Condition {
  const op = opsFor(field.type)[0] as ConditionOp;
  return { id: newId(), path: field.path, op, value: defaultValue(field) };
}

function defaultValue(field: SourceField): number | string | null {
  if (field.type === "bool") return null;
  if (field.type === "number") return 0;
  return field.values?.[0]?.value ?? "";
}

/** Splits a rule on one operator at the top level, outside parentheses and strings; null when both appear. */
function split(
  rule: string
): { op: "&&" | "||" | null; parts: string[] } | null {
  const parts: string[] = [];
  let op: "&&" | "||" | null = null;
  let depth = 0;
  let quoted = false;
  let start = 0;
  let i = 0;
  while (i < rule.length) {
    const c = rule[i];
    const pair = rule.slice(i, i + 2);
    let step = 1;
    if (quoted && c === "\\") step = 2;
    else if (c === '"') quoted = !quoted;
    else if (!quoted && c === "(") depth++;
    else if (!quoted && c === ")") depth--;
    else if (!quoted && depth === 0 && (pair === "&&" || pair === "||")) {
      if (op && op !== pair) return null;
      op = pair;
      parts.push(rule.slice(start, i).trim());
      start = i + 2;
      step = 2;
    }
    i += step;
  }
  if (depth !== 0 || quoted) return null;
  parts.push(rule.slice(start).trim());
  return { op, parts };
}

/** The text inside one pair of parentheses around the whole term, or null. */
function unwrap(term: string): string | null {
  if (!term.startsWith("(") || !term.endsWith(")")) return null;
  let depth = 0;
  let quoted = false;
  let i = 0;
  while (i < term.length - 1) {
    const c = term[i];
    if (quoted && c === "\\") i++;
    else if (c === '"') quoted = !quoted;
    else if (!quoted && c === "(") depth++;
    else if (!quoted && c === ")" && --depth === 0) return null;
    i++;
  }
  return term.slice(1, -1).trim();
}

function boolRow(term: string, field: SourceField): Condition | null {
  const negated = term.startsWith("!");
  const path = negated ? term.slice(1).trim() : term;
  if (path !== field.path) return null;
  return {
    id: newId(),
    path,
    op: negated ? "is_false" : "is_true",
    value: null,
  };
}

/** A CEL string literal's text; null for escapes the form does not write (\\x, \\', octal). */
function unquote(raw: string): string | null {
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

function comparisonRow(
  path: string,
  op: string,
  raw: string,
  field: SourceField
): Condition | null {
  if (field.type === "bool") {
    if ((op !== "==" && op !== "!=") || (raw !== "true" && raw !== "false"))
      return null;
    const isTrue = (op === "==") === (raw === "true");
    return {
      id: newId(),
      path,
      op: isTrue ? "is_true" : "is_false",
      value: null,
    };
  }
  if (field.type === "number") {
    if (!NUMBER.test(raw)) return null;
    return { id: newId(), path, op: op as ConditionOp, value: Number(raw) };
  }
  if (!STRING.test(raw) || (op !== "==" && op !== "!=")) return null;
  const text = unquote(raw);
  if (text === null) return null;
  return { id: newId(), path, op, value: text };
}

/** One condition from one clause, or null when the clause is not a plain comparison on a known field. */
export function parseCondition(
  clause: string,
  fields: SourceField[]
): Condition | null {
  const term = clause.trim();
  const byPath = new Map(fields.map((f) => [f.path, f]));
  const bare = byPath.get(term.replace(/^!\s*/, ""));
  if (bare?.type === "bool") return boolRow(term.replace(/^!\s*/, "!"), bare);
  const m = COMPARISON.exec(term);
  if (!m) return null;
  const [matched, path = "", op = ""] = m;
  const field = byPath.get(path);
  const raw = term.slice(matched.length).trim();
  if (!field || raw === "") return null;
  return comparisonRow(path, op, raw, field);
}

function parseGroup(
  term: string,
  fields: SourceField[]
): ConditionGroup | null {
  const negated = term.startsWith("!");
  const inner = unwrap(negated ? term.slice(1).trim() : term);
  if (inner === null) return null;
  const s = split(inner);
  if (!s) return null;
  const rows = s.parts.map((p) => parseCondition(p, fields));
  if (rows.some((r) => r === null)) return null;
  let match: Match = s.op === "||" ? "any" : "all";
  if (negated) {
    // "Ninguna": none of the conditions may hold, written !(a || b).
    if (s.op === "&&") return null;
    match = "none";
  }
  return { id: newId(), match, rows: rows as Condition[] };
}

/**
 * The form for an activation rule, or null when the rule uses logic the form
 * cannot show: nested parentheses, calculations, fields the source does not
 * have, or "o" between groups.
 */
export function parseConditions(
  rule: string,
  fields: SourceField[]
): ConditionForm | null {
  const text = rule.trim();
  if (text === "" || text === "true")
    return { match: "all", rows: [], groups: [] };
  const top = split(text);
  if (!top) return null;
  const rows: Condition[] = [];
  const groups: ConditionGroup[] = [];
  for (const part of top.parts) {
    const row = parseCondition(part, fields);
    if (row) {
      rows.push(row);
      continue;
    }
    const group = parseGroup(part, fields);
    if (!group || top.op === "||") return null;
    groups.push(group);
  }
  const form: ConditionForm = {
    match: top.op === "||" ? "any" : "all",
    rows,
    groups,
  };
  return lead(form);
}

/** "(a || b) && …" reads back as "Alguna: a, b" when it is the first thing in the rule. */
function lead(form: ConditionForm): ConditionForm {
  const [first, ...rest] = form.groups;
  if (form.rows.length > 0 || first?.match !== "any") return form;
  return { match: "any", rows: first.rows, groups: rest };
}

function literal(c: Condition): string {
  if (typeof c.value === "number") return String(c.value);
  return JSON.stringify(c.value ?? "");
}

/** One condition as CEL. */
export function compileCondition(c: Condition): string {
  if (c.op === "is_true") return c.path;
  if (c.op === "is_false") return `!${c.path}`;
  return `${c.path} ${c.op} ${literal(c)}`;
}

function compileGroup(g: ConditionGroup): string | null {
  if (g.rows.length === 0) return null;
  const join = g.match === "all" ? " && " : " || ";
  const inner = g.rows.map(compileCondition).join(join);
  return g.match === "none" ? `!(${inner})` : `(${inner})`;
}

/** The activation rule for a form: the conditions, then each group joined with "y". */
export function compileConditions(form: ConditionForm): string {
  const parts: string[] = [];
  if (form.rows.length > 0) {
    const rows = form.rows.map(compileCondition);
    if (form.match === "all" || rows.length === 1) parts.push(...rows);
    else
      parts.push(
        form.groups.some((g) => g.rows.length > 0)
          ? `(${rows.join(" || ")})`
          : rows.join(" || ")
      );
  }
  for (const g of form.groups) {
    const clause = compileGroup(g);
    if (clause) parts.push(clause);
  }
  return parts.length === 0 ? "true" : parts.join(" && ");
}
