"use client";

import { useMemo } from "react";
import {
  type TowerContact,
  useContactFacets,
  useContacts,
} from "./control-tower-api";

/** The role a step stores for the trip's driver, who is not a contact in the book. */
export const DRIVER_ROLE = "Conductor";

/** Roles match ignoring case and surrounding spaces, as the contacts API does. */
export const roleKey = (role: string | null | undefined) =>
  (role ?? "").trim().toLowerCase();

export const isDriverRole = (role: string | null | undefined) =>
  roleKey(role) === roleKey(DRIVER_ROLE);

/** A role of the book and how many active contacts have it. */
export interface BookRole {
  role: string;
  activeContacts: number;
}

/** The book's roles, sorted, each with its active contacts. The driver's role is left out. */
export function bookRoles(
  facetRoles: readonly string[],
  contacts: readonly TowerContact[]
): BookRole[] {
  const counts = new Map<string, number>();
  for (const c of contacts) {
    if (!c.active || !c.role?.trim()) continue;
    const key = roleKey(c.role);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const seen = new Set<string>();
  const out: BookRole[] = [];
  for (const role of facetRoles) {
    const key = roleKey(role);
    if (!key || seen.has(key) || isDriverRole(role)) continue;
    seen.add(key);
    out.push({ role: role.trim(), activeContacts: counts.get(key) ?? 0 });
  }
  return out.sort((a, b) => a.role.localeCompare(b.role, "es"));
}

/** The book's roles for the step pickers; undefined while loading or when the book is not reachable. */
export function useBookRoles(): BookRole[] | undefined {
  const facets = useContactFacets();
  const contacts = useContacts();
  return useMemo(
    () =>
      facets.data && contacts.data
        ? bookRoles(facets.data.roles, contacts.data)
        : undefined,
    [facets.data, contacts.data]
  );
}
