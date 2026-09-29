"use client";

/**
 * Who the call panel can call: the trip's driver (from the symptom's trip,
 * not a stored contact) followed by the organization's contacts from the
 * Control Tower API, each with its call statistics.
 */

import { useCallback, useMemo } from "react";
import { mutate } from "swr";
import type { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import {
  contactsKey,
  createContact,
  type TowerAction,
  type TowerCallMethod,
  useContacts,
} from "@/features/symptoms/control-tower/control-tower-api";
import type { CallMethod } from "./call-method";

export interface CallStats {
  lastCallAt: Date | null;
  accepted: number;
  denied: number;
}

export interface CallTarget {
  /** Row id: the API contact id, or {@link DRIVER_TARGET_ID}. */
  id: string;
  /** API contact id; absent for the driver, who is recorded by name. */
  contactId?: string;
  personName: string;
  role: string;
  phone: string;
  /** Empty means every channel is offered. */
  methods: CallMethod[];
  stats: CallStats | null;
}

export const DRIVER_TARGET_ID = "driver";
export const DRIVER_ROLE = "Conductor";

export const toApiMethod = (m: CallMethod) => m.toUpperCase() as TowerCallMethod;
export const fromApiMethod = (m: TowerCallMethod) => m.toLowerCase() as CallMethod;

/** Which call-list row a recorded CALL action belongs to. */
export function targetIdOfAction(action: TowerAction): string | null {
  if (action.kind !== "CALL") return null;
  if (action.contactId) return action.contactId;
  return action.contactRole === DRIVER_ROLE ? DRIVER_TARGET_ID : null;
}

export function useCallTargets(treatmentData: TreatmentsGeneralResponseItem | null) {
  const { data, isLoading, error } = useContacts();

  const targets = useMemo<CallTarget[]>(() => {
    const driver: CallTarget = {
      id: DRIVER_TARGET_ID,
      personName: treatmentData?.trip_info?.driver ?? DRIVER_ROLE,
      role: DRIVER_ROLE,
      phone: treatmentData?.trip_info?.driver_contact ?? "",
      methods: [],
      stats: null,
    };
    const contacts = (data ?? [])
      .filter((c) => c.active)
      .map<CallTarget>((c) => ({
        id: c.id,
        contactId: c.id,
        personName: c.name,
        role: c.role ?? "",
        phone: c.phone ?? "",
        methods: c.methods.map(fromApiMethod),
        stats: {
          lastCallAt: c.lastCalledAt ? new Date(c.lastCalledAt) : null,
          accepted: c.answered,
          denied: c.missed,
        },
      }));
    return [driver, ...contacts];
  }, [data, treatmentData]);

  const knownRoles = useMemo(
    () => Array.from(new Set(targets.map((t) => t.role).filter(Boolean))),
    [targets]
  );

  const addContact = useCallback(
    async (input: { name: string; phone?: string; role?: string; methods: CallMethod[] }) => {
      await createContact({
        name: input.name,
        phone: input.phone || undefined,
        role: input.role || undefined,
        methods: input.methods.map(toApiMethod),
      });
      await mutate(contactsKey);
    },
    []
  );

  return { targets, knownRoles, addContact, isLoading, error: error as Error | undefined };
}
