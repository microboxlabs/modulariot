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
const ROLE_ANYWHERE = new RegExp(
  String.raw`contact\.role(?:Key)?\s*==\s*${QUOTED}|${QUOTED}\s*==\s*contact\.role(?:Key)?\b`,
  "g"
);

const unquote = (m: RegExpExecArray, at = 1) =>
  (m[at] ?? m[at + 1] ?? "").replace(/\\(.)/g, "$1");

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
  return m ? unquote(m).trim() : null;
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
    summary.company = unquote(company).trim() || null;
    return true;
  }
  if (TAG_ATOM.test(atom) || GUARD_ATOMS.some((g) => g.test(atom))) return true;
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
  for (const raw of clauses) if (!readClause(summary, unwrap(raw))) return null;
  summary.role = summary.roles[0] ?? null;
  return summary;
}

/** The roles a condition names anywhere, in order and without repeats; for titles of conditions `summarizeWho` cannot read. */
export function rolesIn(who: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of who.matchAll(ROLE_ANYWHERE)) {
    const role = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "")
      .replace(/\\(.)/g, "$1")
      .trim();
    if (role && !seen.has(roleKey(role))) {
      seen.add(roleKey(role));
      out.push(role);
    }
  }
  return out;
}

/** The roles a step's condition asks for: read from its summary, or found in its text. */
export function rolesOf(who: string, summary: WhoSummary | null): string[] {
  return summary ? summary.roles : rolesIn(who);
}

/** True when the contact's role is one of `roles`, ignoring case and spaces. */
export function hasAnyRole(
  role: string | null | undefined,
  roles: readonly string[]
): boolean {
  const key = roleKey(role);
  return key !== "" && roles.some((r) => roleKey(r) === key);
}
