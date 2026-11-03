"use client";

import { useMemo } from "react";
import type { StepScope } from "../maintainer/maintainer-api";
import { type TowerContact, useContacts } from "./control-tower-api";

/** The book role of a trip's driver. */
export const DRIVER_ROLE = "Conductor";
/** The role older steps used for "the trip's carrier". */
const LEGACY_CARRIER_ROLE = "Transportista";

/** Roles match ignoring case and surrounding spaces, as the contacts API does. */
export const roleKey = (role: string | null | undefined) =>
  (role ?? "").trim().toLowerCase();

export const isDriverRole = (role: string | null | undefined) =>
  roleKey(role) === roleKey(DRIVER_ROLE);

/** Who a step (or the escalation) contacts: a scope, plus a role except for the driver. */
export interface StepTarget {
  scope: StepScope;
  /** Null for the driver, and for any contact of the trip's carrier. */
  role: string | null;
}

/**
 * Reads a saved target. Older ones have no scope: Conductor is the driver,
 * Transportista any contact of the trip's carrier, anything else a role of
 * the organization. Null when nothing is set.
 */
export function stepTarget(
  role: string | null | undefined,
  scope: StepScope | null | undefined
): StepTarget | null {
  const r = role?.trim() || null;
  if (scope === "DRIVER") return { scope, role: null };
  if (scope === "TRIP_CARRIER" || scope === "ORG") return { scope, role: r };
  if (!r) return null;
  if (isDriverRole(r)) return { scope: "DRIVER", role: null };
  if (roleKey(r) === roleKey(LEGACY_CARRIER_ROLE))
    return { scope: "TRIP_CARRIER", role: null };
  return { scope: "ORG", role: r };
}

/** The stored fields of a target. The driver keeps role "Conductor" so older readers still see it. */
export function storedTarget(target: StepTarget | null): {
  role: string;
  scope: StepScope | null;
} {
  if (!target) return { role: "", scope: null };
  if (target.scope === "DRIVER") return { role: DRIVER_ROLE, scope: "DRIVER" };
  return { role: target.role ?? "", scope: target.scope };
}

/** A carrier contact has a company tax id. The organization's own people have none. */
export const isCarrierContact = (c: { companyRut?: string | null }) =>
  Boolean(c.companyRut?.trim());

/** A role of the book and how many active contacts have it. */
export interface BookRole {
  role: string;
  activeContacts: number;
}

/** The roles each scope offers. */
export interface ScopeRoles {
  /** Roles of carrier people, counted across all carriers. */
  carrier: BookRole[];
  /** Roles of the organization's own people. */
  org: BookRole[];
}

function rolesOf(contacts: readonly TowerContact[]): BookRole[] {
  const byKey = new Map<string, BookRole>();
  for (const c of contacts) {
    const role = c.role?.trim();
    if (!role || isDriverRole(role)) continue;
    const key = roleKey(role);
    const entry = byKey.get(key) ?? { role, activeContacts: 0 };
    if (c.active) entry.activeContacts += 1;
    byKey.set(key, entry);
  }
  return [...byKey.values()].sort((a, b) => a.role.localeCompare(b.role, "es"));
}

/** The book's roles per scope. The driver's role is left out: the driver scope has none. */
export function scopeRoles(contacts: readonly TowerContact[]): ScopeRoles {
  return {
    carrier: rolesOf(contacts.filter(isCarrierContact)),
    org: rolesOf(
      contacts.filter(
        (c) =>
          !isCarrierContact(c) &&
          roleKey(c.role) !== roleKey(LEGACY_CARRIER_ROLE)
      )
    ),
  };
}

/** The book's roles for the step pickers; undefined while loading or when the book is not reachable. */
export function useScopeRoles(): ScopeRoles | undefined {
  const { data } = useContacts();
  return useMemo(() => (data ? scopeRoles(data) : undefined), [data]);
}
