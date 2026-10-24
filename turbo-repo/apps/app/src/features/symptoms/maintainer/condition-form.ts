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
const STRING = /^"(?:[^"\\]|\\.)*"$|^'(?:[^'\\]|\\.)*'$/;
const COMPARISON = /^([A-Za-z_][\w.]*)\s*(==|!=|>=|<=|>|<)/;
const HAS = /^has\(\s*([A-Za-z_][\w.]*)\s*\)$/;
const OPTIONAL_BOOL = /^([A-Za-z_][\w.?]*)\s*==\s*(TRUE|FALSE)$/;

/** The frame as the device sent it: the device may leave out any of its parts. */
const DEVICE_FRAME = "signal.frame";

/**
 * The paths a rule tests with has() before reading this field, outermost
 * first: each level below the frame, since the device may leave any out.
 * None for fields outside the frame.
 */
export function guardsFor(path: string): string[] {
  if (!path.startsWith(`${DEVICE_FRAME}.`)) return [];
  const parts = path.slice(DEVICE_FRAME.length + 1).split(".");
  return parts.map(
    (_, i) => `${DEVICE_FRAME}.${parts.slice(0, i + 1).join(".")}`
  );
}

/** A frame field read with `.?` on each level below the frame: `signal.frame.?sensors.?panic_button`. */
export function optionalPath(path: string): string {
  const parts = path.slice(DEVICE_FRAME.length + 1).split(".");
  return DEVICE_FRAME + parts.map((p) => `.?${p}`).join("");
}

/** A yes/no condition on the frame, written `optionalPath == TRUE` or `== FALSE` instead of with has(). */
function readsOptional(c: Condition): boolean {
  return (
    c.path.startsWith(`${DEVICE_FRAME}.`) &&
    (c.op === "is_true" || c.op === "is_false")
  );
}

/** The has() tests the form writes for a condition. */
function guardsOf(c: Condition): string[] {
  return readsOptional(c) ? [] : guardsFor(c.path);
}

let nextId = 0;
export const newId = () => `cond-${++nextId}`;

/** Fields compared as numbers: plain numbers and durations in seconds. */
export function isNumeric(type: string) {
  return type === "number" || type === "duration";
}

/** A number as a plain decimal, never in exponent notation: 1e-7 is written 0.0000001. */
export function decimalText(n: number): string {
  const text = String(n);
  const e = text.indexOf("e");
  if (e < 0) return text;
  const sign = text.startsWith("-") ? "-" : "";
  const mantissa = text.slice(sign.length, e);
  const exponent = Number(text.slice(e + 1));
  const [whole = "", fraction = ""] = mantissa.split(".");
  const digits = whole + fraction;
  const point = whole.length + exponent;
  if (point <= 0) return `${sign}0.${"0".repeat(-point)}${digits}`;
  if (point >= digits.length)
    return sign + digits + "0".repeat(point - digits.length);
  return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
}

/**
 * A number literal as a JavaScript number, or null when the conversion would
 * change it (too many digits, too large, too small): writing it back would
 * change the rule. Trailing zeros after the point may go.
 */
export function exactNumber(raw: string): number | null {
  const text = raw.trim();
  if (!NUMBER.test(text)) return null;
  const n = Number(text);
  const trimmed = text.includes(".") ? withoutTrailingZeros(text) : text;
  const expected = trimmed === "-0" ? "0" : trimmed;
  return Number.isFinite(n) && decimalText(n) === expected ? n : null;
}

/** "90.50" → "90.5", "90.0" → "90"; for text that has a point. */
function withoutTrailingZeros(text: string): string {
  let end = text.length;
  while (text[end - 1] === "0") end--;
  if (text[end - 1] === ".") end--;
  return text.slice(0, end);
}

/** The operators a field of this type offers. */
export function opsFor(type: string): ConditionOp[] {
  if (type === "bool") return ["is_true", "is_false"];
  if (isNumeric(type)) return [...ORDER_OPS, "==", "!="];
  return ["==", "!="];
}

/** A new condition on a field, with the first operator and a value that makes sense for it. */
export function newCondition(field: SourceField): Condition {
  const op = opsFor(field.type)[0] as ConditionOp;
  return { id: newId(), path: field.path, op, value: defaultValue(field) };
}

function defaultValue(field: SourceField): number | string | null {
  if (field.type === "bool") return null;
  if (isNumeric(field.type)) return 0;
  return field.values?.[0]?.value ?? "";
}

/** How the conditions of a rule are joined. */
type Join = "&&" | "||";

/** Where a scan of a rule stands: inside a string, and how many parentheses deep. */
interface Scan {
  /** The quote that opened the string the scan is in; empty outside strings. */
  quote: string;
  depth: number;
}

/** Moves the scan past the character at i; returns how many characters that took. */
function advance(rule: string, i: number, scan: Scan): number {
  const c = rule[i];
  if (scan.quote) {
    if (c === "\\") return 2;
    if (c === scan.quote) scan.quote = "";
    return 1;
  }
  if (c === '"' || c === "'") scan.quote = c;
  else if (c === "(") scan.depth++;
  else if (c === ")") scan.depth--;
  return 1;
}

/** The && or || at i when it is outside parentheses and strings. */
function topLevelJoin(rule: string, i: number, scan: Scan): Join | null {
  if (scan.quote || scan.depth !== 0) return null;
  const pair = rule.slice(i, i + 2);
  return pair === "&&" || pair === "||" ? pair : null;
}

/** Splits a rule on one operator at the top level, outside parentheses and strings; null when both appear. */
function split(rule: string): { op: Join | null; parts: string[] } | null {
  const parts: string[] = [];
  const scan: Scan = { quote: "", depth: 0 };
  let op: Join | null = null;
  let start = 0;
  let i = 0;
  while (i < rule.length) {
    const join = topLevelJoin(rule, i, scan);
    if (join) {
      if (op && op !== join) return null;
      op = join;
      parts.push(rule.slice(start, i).trim());
      start = i + 2;
      i += 2;
    } else {
      i += advance(rule, i, scan);
    }
  }
  if (scan.depth !== 0 || scan.quote) return null;
  parts.push(rule.slice(start).trim());
  return { op, parts };
}

/** The text inside one pair of parentheses around the whole term, or null. */
function unwrap(term: string): string | null {
  if (!term.startsWith("(") || !term.endsWith(")")) return null;
  const scan: Scan = { quote: "", depth: 0 };
  let i = 0;
  while (i < term.length - 1) {
    const closes = !scan.quote && term[i] === ")";
    i += advance(term, i, scan);
    if (closes && scan.depth === 0) return null;
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
  // CEL also quotes with '; the form reads those only without escapes and writes them back with ".
  if (raw.startsWith("'")) {
    const text = raw.slice(1, -1);
    return text.includes("\\") ? null : text;
  }
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
  if (isNumeric(field.type)) {
    const value = exactNumber(raw);
    if (value === null) return null;
    return { id: newId(), path, op: op as ConditionOp, value };
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
  const optional = OPTIONAL_BOOL.exec(term);
  if (optional) return optionalRow(optional[1] ?? "", optional[2], byPath);
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

/** `signal.frame.?a.?b == TRUE` as a yes/no row on `signal.frame.a.b`. */
function optionalRow(
  read: string,
  constant: string | undefined,
  byPath: Map<string, SourceField>
): Condition | null {
  const path = read.replaceAll("?", "");
  if (byPath.get(path)?.type !== "bool" || read !== optionalPath(path))
    return null;
  const op = constant === "TRUE" ? "is_true" : "is_false";
  return { id: newId(), path, op, value: null };
}

/** The path a has() term tests, or null. */
function hasPath(term: string): string | null {
  return HAS.exec(term.trim())?.[1] ?? null;
}

/** A condition, or one written with its has() tests: `(has(a) && has(a.b) && a.b > 1)`. */
function parseGuarded(term: string, fields: SourceField[]): Condition | null {
  const row = parseCondition(term, fields);
  if (row) return row;
  const inner = unwrap(term.trim());
  const s = inner === null ? null : split(inner);
  if (s?.op !== "&&") return null;
  const last = parseCondition(s.parts.at(-1) ?? "", fields);
  if (!last) return null;
  const guards = s.parts.slice(0, -1).map(hasPath);
  const expected = guardsFor(last.path);
  return guards.length === expected.length &&
    guards.every((g, i) => g === expected[i])
    ? last
    : null;
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
  const rows = s.parts.map((p) => parseGuarded(p, fields));
  if (rows.includes(null)) return null;
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
  const guards: string[] = [];
  for (const part of top.parts) {
    const guard = hasPath(part);
    if (guard && top.op !== "||") {
      guards.push(guard);
      continue;
    }
    const row = parseGuarded(part, fields);
    if (row) {
      rows.push(row);
      continue;
    }
    const group = parseGroup(part, fields);
    if (!group || top.op === "||") return null;
    groups.push(group);
  }
  // A has() at the top is shown with the condition it protects; the form writes it back.
  const needed = new Set(rows.flatMap((r) => guardsFor(r.path)));
  if (guards.some((g) => !needed.has(g))) return null;
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
  if (typeof c.value === "number") return decimalText(c.value);
  return JSON.stringify(c.value ?? "");
}

/** `rows` with the row at `from` moved to `to`; the same list when either index is out of range. */
export function moveRow<T>(rows: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= rows.length ||
    to >= rows.length
  )
    return rows;
  const next = [...rows];
  const [row] = next.splice(from, 1);
  next.splice(to, 0, row);
  return next;
}

const WORD = /\w/;

/**
 * A key for comparing two writings of a rule: whitespace outside quotes is
 * dropped, except one space between two word characters (`a in b`). A rule with
 * a `//` comment is its own key, since a line break ends the comment.
 */
export function ruleKey(rule: string): string {
  let out = "";
  let space = false;
  let i = 0;
  while (i < rule.length) {
    const c = rule.charAt(i);
    if (/\s/.test(c)) {
      space = true;
      i++;
      continue;
    }
    if (rule.startsWith("//", i)) return rule;
    if (space && WORD.test(out.at(-1) ?? "") && WORD.test(c)) out += " ";
    space = false;
    const end = c === '"' || c === "'" ? quotedEnd(rule, i) : i + 1;
    out += rule.slice(i, end);
    i = end;
  }
  return out;
}

/** The index just past the string literal that starts at `start`, or the end of the rule. */
function quotedEnd(rule: string, start: number): number {
  const quote = rule.charAt(start);
  let i = start + 1;
  while (i < rule.length && rule.charAt(i) !== quote) {
    i += rule.charAt(i) === "\\" ? 2 : 1;
  }
  return Math.min(i + 1, rule.length);
}

/**
 * The rule with each top-level `&&` starting a new line, as the form writes it.
 * `&&` inside quotes or brackets stays; a rule with a `//` comment is returned as is,
 * since a line break would end the comment.
 */
export function formatRule(rule: string): string {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < rule.length; i++) {
    const c = rule.charAt(i);
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (rule.startsWith("//", i)) return rule;
    else if (depth === 0 && rule.startsWith("&&", i)) {
      parts.push(rule.slice(start, i).trim());
      start = i + 2;
      i++;
    }
  }
  parts.push(rule.slice(start).trim());
  if (parts.length < 2 || parts.some((part) => !part)) return rule;
  return parts.join("\n&& ");
}

/** One condition as CEL. */
export function compileCondition(c: Condition): string {
  if (readsOptional(c))
    return `${optionalPath(c.path)} == ${c.op === "is_true" ? "TRUE" : "FALSE"}`;
  if (c.op === "is_true") return c.path;
  if (c.op === "is_false") return `!${c.path}`;
  return `${c.path} ${c.op} ${literal(c)}`;
}

const hasTest = (path: string) => `has(${path})`;

/** One condition with its has() tests, in parentheses when it has any. */
function compileGuarded(c: Condition): string {
  const guards = guardsOf(c);
  if (guards.length === 0) return compileCondition(c);
  const terms = [...guards.map(hasTest), compileCondition(c)];
  return `(${terms.join(" && ")})`;
}

function compileGroup(g: ConditionGroup): string | null {
  if (g.rows.length === 0) return null;
  const join = g.match === "all" ? " && " : " || ";
  const inner = g.rows.map(compileGuarded).join(join);
  return g.match === "none" ? `!(${inner})` : `(${inner})`;
}

/**
 * The activation rule for a form: the conditions, then each group joined with "y".
 * When all conditions must hold, their has() tests go first, each once. A
 * yes/no frame field is read with `.?` and needs none.
 */
export function compileConditions(form: ConditionForm): string {
  const parts: string[] = [];
  if (form.rows.length > 0) {
    const rows = form.rows.map(compileCondition);
    if (form.match === "all" || rows.length === 1) {
      const guards = new Set(form.rows.flatMap(guardsOf));
      parts.push(...[...guards].map(hasTest), ...rows);
    } else {
      const any = form.rows.map(compileGuarded).join(" || ");
      parts.push(form.groups.some((g) => g.rows.length > 0) ? `(${any})` : any);
    }
  }
  for (const g of form.groups) {
    const clause = compileGroup(g);
    if (clause) parts.push(clause);
  }
  return parts.length === 0 ? "true" : parts.join("\n&& ");
}
