/**
 * Who an operator step contacts: a condition on each contact of the book, the
 * same CEL as a communication rule's "contacts from the book" audience. The
 * trip's RUTs are `event.data`: driverRut, secondDriverRut and carrierRut.
 */

import {
  compileClauses,
  type ContactClause,
} from "@/features/conversations/contact-condition";
import type { EventField } from "@/features/conversations/conversations-types";
import type { StepScope } from "../maintainer/maintainer-api";

/** The book role of a trip's driver. */
export const DRIVER_ROLE = "Conductor";
/** The role older steps used for "the trip's carrier". */
const LEGACY_CARRIER_ROLE = "Transportista";
const LEGACY_DRIVER_WHO =
  "contact.roleKey == 'conductor' && ((has(event.data.driverRut) && has(event.data.driverIdType) && contact.nationalIdType == event.data.driverIdType && contact.nationalId == event.data.driverRut) || (has(event.data.secondDriverRut) && has(event.data.secondDriverIdType) && contact.nationalIdType == event.data.secondDriverIdType && contact.nationalId == event.data.secondDriverRut))";
const CARRIER_TYPE =
  " && has(event.data.carrierIdType) && contact.companyTaxIdType == event.data.carrierIdType";
const ORG_ONLY = " && contact.companyRut == ''";

/** The fields of `event.data` a step's condition can read: the case trip's RUTs. */
export const TRIP_FIELDS: EventField[] = [
  { name: "driverRut", type: "string", label: "RUT del conductor" },
  {
    name: "secondDriverRut",
    type: "string",
    label: "RUT del segundo conductor",
  },
  { name: "carrierRut", type: "string", label: "RUT del transportista" },
];

const roleKey = (role: string | null | undefined) =>
  (role ?? "").trim().toLowerCase();

/** Roles match ignoring case and surrounding spaces, as the contacts API does. */
export const isDriverRole = (role: string | null | undefined) =>
  roleKey(role) === roleKey(DRIVER_ROLE);

/**
 * The condition of a step saved before steps had one. Conductor (or the DRIVER
 * scope) is the trip's driver, Transportista (or TRIP_CARRIER) the trip
 * carrier's people with the role if any, anything else a role of the book.
 * Empty when the step names nobody.
 */
export function legacyWho(
  role: string | null | undefined,
  scope: StepScope | null | undefined
): string {
  const r = role?.trim() ?? "";
  const clauses: ContactClause[] = [];
  const driver =
    scope === "DRIVER" || (!scope && roleKey(r) === roleKey(DRIVER_ROLE));
  const carrier =
    scope === "TRIP_CARRIER" ||
    (!scope && roleKey(r) === roleKey(LEGACY_CARRIER_ROLE));
  if (driver) {
    return LEGACY_DRIVER_WHO;
  } else if (carrier) {
    if (r && (scope || roleKey(r) !== roleKey(LEGACY_CARRIER_ROLE)))
      clauses.push({ kind: "role", value: roleKey(r) });
    clauses.push({ kind: "companyRutIs", field: "carrierRut" });
  } else if (r) {
    clauses.push({ kind: "role", value: roleKey(r) });
  }
  const compiled = compileClauses(clauses).replace(
    "contact.role ==",
    "contact.roleKey =="
  );
  if (carrier && compiled) return compiled + CARRIER_TYPE;
  return compiled ? compiled + ORG_ONLY : compiled;
}

/** A step's condition, read from its older role and scope when it has none. */
export function whoOf(step: {
  who?: string | null;
  role?: string | null;
  scope?: StepScope | null;
}): string {
  if (step.who?.trim()) return step.who;
  return legacyWho(step.role, step.scope);
}

/** What the call panel says about a step's condition. */
export interface WhoSummary {
  /** The first role the condition asks for, if any. */
  role: string | null;
  /** Every role the condition accepts (`||` of roles); empty when it names none. */
  roles: string[];
  /** The contact's own RUT is a trip driver's. */
  driver: boolean;
  /** "either" for the legacy driver-or-second-driver condition, "second" for the second driver only. */
  driverField?: "either" | "second";
  /** The contact's company RUT is the trip carrier's. */
  carrier: boolean;
  /** The contact's own RUT is the trip carrier's: the carrier is a person. */
  carrierSelf: boolean;
  /** The company name the condition asks for, if any. */
  company: string | null;
  /** Tags required by the condition's conjunction. */
  tags: string[];
}

const QUOTED = String.raw`(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")`;
const ROLE_ATOM = new RegExp(
  String.raw`^contact\.role(?:Key)?\s*==\s*${QUOTED}$`
);
const COMPANY_ATOM = new RegExp(
  String.raw`^contact\.company\s*==\s*${QUOTED}$`
);
const TAG_ATOM = new RegExp(String.raw`^${QUOTED}\s+in\s+contact\.tags$`);
const FIELD_ATOM =
  /^contact\.(nationalId|companyRut)\s*==\s*event\.data\.([A-Za-z_]\w*)$/;
/** Checks that narrow a match without changing who it is: id types, presence, organisation-only. */
const GUARD_ATOMS = [
  /^has\(event\.data\.[A-Za-z_]\w*\)$/,
  /^contact\.(nationalIdType|companyTaxIdType)\s*==\s*event\.data\.[A-Za-z_]\w*$/,
  /^contact\.companyRut\s*==\s*(''|"")$/,
];
const ESCAPES: Record<string, string> = {
  a: "\x07",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
  v: "\v",
  "\\": "\\",
  "?": "?",
  '"': '"',
  "'": "'",
  "`": "`",
};
const ESCAPE =
  /\\(?:[abfnrtv\\?"'`]|[xX][\da-fA-F]{2}|u[\da-fA-F]{4}|U[\da-fA-F]{8}|[0-3][0-7]{2})/y;

/** Decode CEL escapes; an unsupported literal must keep the summary unreadable. */
function unquote(m: RegExpExecArray): string | null {
  const text = m[1] ?? m[2] ?? "";
  let out = "";
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "\\") {
      out += text[i];
      continue;
    }
    ESCAPE.lastIndex = i;
    const escape = ESCAPE.exec(text)?.[0];
    if (!escape) return null;
    const code = escape[1];
    if (ESCAPES[code] !== undefined) out += ESCAPES[code];
    else {
      const octal = /[0-3]/.test(code);
      const point = Number.parseInt(
        escape.slice(octal ? 1 : 2),
        octal ? 8 : 16
      );
      if (point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) return null;
      out += String.fromCodePoint(point);
    }
    i += escape.length - 1;
  }
  return out;
}

interface WhoToken {
  text: string;
  quoted: boolean;
}

const WORD = /[A-Za-z_][\w.]*|==|!=|&&|\|\||\S/y;

/** One pass with opaque strings and comments; never retries a quoted suffix. */
function quotedEnd(who: string, start: number): number {
  const ch = who[start];
  const delimiter = who.startsWith(ch.repeat(3), start) ? ch.repeat(3) : ch;
  let i = start + delimiter.length;
  while (i < who.length && !who.startsWith(delimiter, i))
    i += who[i] === "\\" ? 2 : 1;
  return Math.min(i + delimiter.length, who.length);
}

/** Scan once, keeping string values opaque. */
function tokens(who: string): WhoToken[] {
  const out: WhoToken[] = [];
  let i = 0;
  while (i < who.length) {
    const ch = who[i];
    if (who.startsWith("//", i)) {
      const end = who.indexOf("\n", i);
      i = end < 0 ? who.length : end + 1;
    } else if (ch === "'" || ch === '"') {
      const start = i;
      i = quotedEnd(who, start);
      out.push({ text: who.slice(start, i), quoted: true });
    } else {
      WORD.lastIndex = i;
      const word = WORD.exec(who);
      if (word) out.push({ text: word[0], quoted: false });
      i = word ? WORD.lastIndex : i + 1;
    }
  }
  return out;
}

/** Actual trip references, excluding examples inside strings or comments. */
export function referencesTrip(who: string): boolean {
  return tokens(who).some(
    (t) =>
      !t.quoted && (t.text === "event.data" || t.text.startsWith("event.data."))
  );
}

/** Splits at a top-level operator, outside quotes and parentheses; null on unbalanced text. */
function splitTop(text: string, op: "&&" | "||"): string[] | null {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let quote: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") {
      if (--depth < 0) return null;
    } else if (depth === 0 && text.startsWith(op, i)) {
      parts.push(text.slice(start, i).trim());
      start = i + op.length;
      i++;
    }
  }
  if (quote || depth !== 0) return null;
  parts.push(text.slice(start).trim());
  return parts;
}

/** Drops parentheses that wrap the whole text. */
function unwrap(text: string): string {
  let t = text.trim();
  while (t.startsWith("(") && t.endsWith(")")) {
    const inner = t.slice(1, -1);
    if (splitTop(inner, "&&") === null) break;
    t = inner.trim();
  }
  return t;
}

/** `'x' == contact.role` and `event.data.f == contact.nationalId` read as their mirror. */
function normalizeAtom(text: string): string {
  const eq = splitEq(text);
  if (!eq) return text;
  const [left, right] = eq;
  return !left.startsWith("contact.") && right.startsWith("contact.")
    ? `${right} == ${left}`
    : `${left} == ${right}`;
}

function splitEq(text: string): [string, string] | null {
  let quote: string | null = null;
  for (let i = 0; i < text.length - 1; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') quote = ch;
    else if (ch === "=" && text[i + 1] === "=")
      return [text.slice(0, i).trim(), text.slice(i + 2).trim()];
  }
  return null;
}

function roleOf(atom: string): string | null {
  const m = ROLE_ATOM.exec(atom);
  return m ? (unquote(m)?.trim() ?? null) : null;
}

/** What each trip field means when the contact's own or company RUT equals it. */
const TRIP_FIELD_MEANING: Record<string, Partial<WhoSummary>> = {
  "nationalId:driverRut": { driver: true },
  "nationalId:secondDriverRut": { driver: true, driverField: "second" },
  "nationalId:carrierRut": { carrierSelf: true },
  "companyRut:carrierRut": { carrier: true },
};

/** Adds one `&&` clause to the summary; false when the panel cannot name it. */
function readClause(summary: WhoSummary, clause: string): boolean {
  const alternatives = splitTop(clause, "||");
  if (!alternatives) return false;
  if (alternatives.length > 1) {
    const roles = alternatives.map((a) => roleOf(normalizeAtom(unwrap(a))));
    if (summary.roles.length > 0 || roles.some((r) => !r)) return false;
    summary.roles = roles as string[];
    return true;
  }
  const atom = normalizeAtom(clause);
  const role = roleOf(atom);
  if (role !== null) {
    if (summary.roles.length > 0) return false;
    summary.roles = role ? [role] : [];
    return true;
  }
  const company = COMPANY_ATOM.exec(atom);
  if (company) {
    const value = unquote(company);
    if (value === null) return false;
    summary.company = value.trim() || null;
    return true;
  }
  const tag = TAG_ATOM.exec(atom);
  if (tag) {
    const value = unquote(tag);
    if (value === null) return false;
    summary.tags.push(value);
    return true;
  }
  if (GUARD_ATOMS.some((g) => g.test(atom))) return true;
  const field = FIELD_ATOM.exec(atom);
  const meaning = field ? TRIP_FIELD_MEANING[`${field[1]}:${field[2]}`] : null;
  if (!meaning) return false;
  Object.assign(summary, meaning);
  return true;
}

/**
 * Reads a step's condition as roles plus the trip person or company it
 * points to. Null when it says something the panel cannot name, such as an
 * unknown field or an `||` of anything but roles.
 */
export function summarizeWho(who: string): WhoSummary | null {
  const summary: WhoSummary = {
    role: null,
    roles: [],
    driver: false,
    carrier: false,
    carrierSelf: false,
    company: null,
    tags: [],
  };
  if (who === LEGACY_DRIVER_WHO)
    return {
      ...summary,
      role: DRIVER_ROLE,
      roles: [DRIVER_ROLE],
      driver: true,
      driverField: "either",
    };
  const text = unwrap(who);
  if (!text) return null;
  const clauses = splitTop(text, "&&");
  if (!clauses) return null;
  // || binds less tightly: A || B && C does not constrain A by C.
  if (clauses.length > 1 && (splitTop(text, "||")?.length ?? 0) > 1)
    return null;
  for (const raw of clauses) if (!readClause(summary, unwrap(raw))) return null;
  summary.role = summary.roles[0] ?? null;
  return summary;
}

/** The roles a condition names anywhere, in order and without repeats; for titles of conditions `summarizeWho` cannot read. */
export function rolesIn(who: string): string[] {
  const parts = tokens(who);
  const scopes: boolean[] = [];
  let negated = 0;
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].quoted) continue;
    if (parts[i].text === "(") {
      const excluded = parts[i - 1]?.text === "!";
      scopes.push(excluded);
      if (excluded) negated++;
    } else if (parts[i].text === ")" && scopes.pop()) negated--;
    if (negated > 0 || parts[i].text !== "==") continue;
    const left = parts[i - 1];
    const right = parts[i + 1];
    if (!left || !right) continue;
    const atom = normalizeAtom(`${left.text} == ${right.text}`);
    const role = roleOf(atom);
    if (role && !seen.has(roleKey(role))) {
      seen.add(roleKey(role));
      out.push(role);
    }
  }
  return out;
}

/** The roles a step's condition asks for: read from its summary, or found in its text. */
export function rolesOf(who: string, summary: WhoSummary | null): string[] {
  if (summary) return summary.roles;
  const text = unwrap(who);
  // Only independently readable conjuncts prove a role requirement. A role
  // mentioned in an unknown function, negation or optional branch proves none.
  if ((splitTop(text, "||")?.length ?? 0) !== 1) return [];
  if (tokens(text).some((t) => !t.quoted && t.text === "?")) return [];
  const clauses = splitTop(text, "&&") ?? [];
  return [...new Set(clauses.flatMap((c) => summarizeWho(c)?.roles ?? []))];
}

/** True when the contact's role is one of `roles`, ignoring case and spaces. */
export function hasAnyRole(
  role: string | null | undefined,
  roles: readonly string[]
): boolean {
  const key = roleKey(role);
  return key !== "" && roles.some((r) => roleKey(r) === key);
}
