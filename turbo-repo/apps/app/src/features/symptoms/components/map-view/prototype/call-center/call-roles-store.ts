"use client";

/**
 * PROTOTYPE — dedicated list of "who to call" contacts/roles for the
 * call-center debug flow. No longer sourced from the generic Selectables
 * admin system (`settings-admin/selectables`) — that system is still what
 * the older, non-debug "Llamar al conductor" form's dropdown reads from
 * (`useSelectableOptions("who_to_call")`, kept untouched as the fallback),
 * but it's the wrong place for this flow's contacts: editing an unrelated
 * selectable elsewhere in settings shouldn't change who shows up here, and
 * vice versa. Same `CallRole` shape (so the rest of the flow didn't
 * need to change) and the same localStorage + custom-event pattern as every
 * other prototype store in this feature.
 */

import { useCallback, useEffect, useState } from "react";
import { isMockDataEnabled } from "../prototype-api-guard";

/** A person or role the operator can call. */
export interface CallRole {
  id: string;
  name: string;
  description?: string;
}

const STORAGE_KEY = "miot.prototype.call-roles.v1";
const SYNC_EVENT = "miot:call-roles-changed";

function makeRoleId(): string {
  return `role_${crypto.randomUUID()}`;
}

const DEFAULT_ROLES: CallRole[] = [
  {
    id: "role_conductor",
    name: "Conductor",
    description: "Conductor asignado al viaje",
  },
  {
    id: "role_transportista",
    name: "Transportista / Jefe de transporte",
    description: "",
  },
  { id: "role_jefe_operaciones", name: "Jefe de operaciones", description: "" },
  { id: "role_jefe_mina", name: "Jefe mina", description: "" },
  { id: "role_otro", name: "Otro", description: "Detallar en la nota" },
];

/** These seeded roles are as fabricated as everything in `mock-contact-
 *  data.ts` — gated by the same flag (see `prototype-api-guard.ts`) so an
 *  operator with no custom contacts added sees an empty list, not a fake
 *  org chart, once this is meant to reflect something real. */
function seededRoles(): CallRole[] {
  return isMockDataEnabled() ? DEFAULT_ROLES : [];
}

function read(): CallRole[] {
  if (typeof window === "undefined") return seededRoles();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seededRoles();
    const parsed = JSON.parse(raw) as CallRole[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seededRoles();
  } catch {
    return seededRoles();
  }
}

function write(next: CallRole[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(SYNC_EVENT));
  } catch {
    // storage unavailable (private mode, quota) — in-memory state still updates.
  }
}

export function useCallRoles() {
  const [options, setOptions] = useState<CallRole[]>(seededRoles);

  useEffect(() => {
    setOptions(read());
    const sync = () => setOptions(read());
    window.addEventListener(SYNC_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SYNC_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  /** Appends a real contact — its name IS the person's name, not a role
   *  placeholder like the seeded defaults above — and returns its id. */
  const addContact = useCallback((name: string): string => {
    const option: CallRole = { id: makeRoleId(), name, description: "" };
    const next = [...read(), option];
    write(next);
    setOptions(next);
    return option.id;
  }, []);

  return { options, addContact };
}
