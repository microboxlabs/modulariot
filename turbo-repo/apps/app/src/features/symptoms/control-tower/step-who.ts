/**
 * Who an operator step contacts: a condition on each contact of the book, the
 * same CEL as a communication rule's "contacts from the book" audience. The
 * trip's RUTs are `event.data`: driverRut, secondDriverRut and carrierRut.
 */

import {
  compileClauses,
  type ContactClause,
  parseClauses,
} from "@/features/conversations/contact-condition";
import type { EventField } from "@/features/conversations/conversations-types";
import type { StepScope } from "../maintainer/maintainer-api";

/** The book role of a trip's driver. */
export const DRIVER_ROLE = "Conductor";
/** The role older steps used for "the trip's carrier". */
const LEGACY_CARRIER_ROLE = "Transportista";
const LEGACY_DRIVER_WHO =
  "contact.roleKey == 'conductor' && ((has(event.data.driverRut) && contact.nationalId == event.data.driverRut) || (has(event.data.secondDriverRut) && contact.nationalId == event.data.secondDriverRut))";
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
  return !carrier && compiled ? compiled + ORG_ONLY : compiled;
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

/** What the call panel says about a condition it can read as clauses. */
export interface WhoSummary {
  /** The role the condition asks for, if one. */
  role: string | null;
  /** The contact's own RUT is the trip driver's. */
  driver: boolean;
  /** The contact's company RUT is the trip carrier's. */
  carrier: boolean;
  driverField?: "either";
}

/** Null when the condition says more than the clauses can (|| or other fields). */
export function summarizeWho(who: string): WhoSummary | null {
  if (who === LEGACY_DRIVER_WHO)
    return {
      role: DRIVER_ROLE,
      driver: true,
      carrier: false,
      driverField: "either",
    };
  const condition = who.endsWith(ORG_ONLY)
    ? who.slice(0, -ORG_ONLY.length)
    : who;
  const readable = condition.startsWith("contact.roleKey ==")
    ? condition.replace("contact.roleKey ==", "contact.role ==")
    : condition;
  const clauses = parseClauses(readable);
  if (
    !clauses ||
    clauses.some(
      (c) =>
        (c.kind === "nationalIdIs" && c.field !== "driverRut") ||
        (c.kind === "companyRutIs" && c.field !== "carrierRut")
    )
  )
    return null;
  const role = clauses.find((c) => c.kind === "role");
  return {
    role: role && role.kind === "role" ? role.value || null : null,
    driver: clauses.some((c) => c.kind === "nationalIdIs"),
    carrier: clauses.some((c) => c.kind === "companyRutIs"),
  };
}
