"use client";

/**
 * Who the call panel can call: the trip's driver (from the symptom's trip,
 * not a stored contact) followed by the organization's contacts from the
 * Control Tower API, each with its call statistics.
 */

import { useCallback, useMemo } from "react";
import { mutate } from "swr";
import { isValidPhone } from "@/features/common/components/phone-input/phone-input";
import type { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import {
  contactsKey,
  createContact,
  type TowerAction,
  type TowerCallMethod,
  type TowerContact,
  useContacts,
} from "@/features/symptoms/control-tower/control-tower-api";
import {
  DRIVER_ROLE,
  isDriverRole,
} from "@/features/symptoms/control-tower/contact-roles";
import { ALL_CALL_METHODS, type CallMethod } from "./call-method";

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
  /** The channels the target can be reached on. Empty means none. */
  methods: CallMethod[];
  stats: CallStats | null;
}

export const DRIVER_TARGET_ID = "driver";

export const toApiMethod = (m: CallMethod) =>
  m.toUpperCase() as TowerCallMethod;
export const fromApiMethod = (m: TowerCallMethod) =>
  m.toLowerCase() as CallMethod;

/** A saved contact's channels: allowed in the book and with an address. Phone and WhatsApp need a number. */
export function contactMethods(c: TowerContact): CallMethod[] {
  return ALL_CALL_METHODS.filter((m) => {
    if (!c.methods.includes(toApiMethod(m))) return false;
    const fallback = m === "phone" || m === "whatsapp" ? c.phone : null;
    return Boolean((c.channels?.[m] ?? fallback)?.trim());
  });
}

/** The driver is reached by phone and WhatsApp when the trip has a number. */
export function driverMethods(phone: string | null | undefined): CallMethod[] {
  return isValidPhone(phone ?? "") ? ["phone", "whatsapp"] : [];
}

/** The call channel a step asks for; null when the step's channel is not a call (email). */
export function stepMethod(
  channel: string | null | undefined
): CallMethod | null {
  if (channel === "call" || !channel) return "phone";
  if (channel === "whatsapp" || channel === "teams" || channel === "meet")
    return channel;
  return null;
}

/** Which call-list row a recorded CALL action belongs to. */
export function targetIdOfAction(action: TowerAction): string | null {
  if (action.kind !== "CALL") return null;
  if (action.contactId) return action.contactId;
  return isDriverRole(action.contactRole) ? DRIVER_TARGET_ID : null;
}

export function useCallTargets(
  treatmentData: TreatmentsGeneralResponseItem | null
) {
  const { data, isLoading, error } = useContacts();

  const targets = useMemo<CallTarget[]>(() => {
    const driver: CallTarget = {
      id: DRIVER_TARGET_ID,
      personName: treatmentData?.trip_info?.driver ?? DRIVER_ROLE,
      role: DRIVER_ROLE,
      phone: treatmentData?.trip_info?.driver_contact ?? "",
      methods: driverMethods(treatmentData?.trip_info?.driver_contact),
      stats: null,
    };
    const contacts = (data ?? [])
      .filter((c) => c.active)
      .map<CallTarget>((c) => ({
        id: c.id,
        contactId: c.id,
        personName: c.name,
        role: c.role ?? "",
        phone: c.phone || c.channels?.phone || c.channels?.whatsapp || "",
        methods: contactMethods(c),
        stats: {
          lastCallAt: c.lastCalledAt ? new Date(c.lastCalledAt) : null,
          accepted: c.answered,
          denied: c.missed,
        },
      }));
    return [driver, ...contacts];
  }, [data, treatmentData]);

  /** Saves a number typed in the call panel as a provisional contact, reachable by phone and WhatsApp. */
  const addContact = useCallback(
    async (input: { name: string; phone: string }): Promise<TowerContact> => {
      const methods: CallMethod[] = ["phone", "whatsapp"];
      const saved = await createContact({
        name: input.name,
        phone: input.phone,
        methods: methods.map(toApiMethod),
        channels: { phone: input.phone, whatsapp: input.phone },
        provisional: true,
      });
      void mutate(contactsKey);
      return saved;
    },
    []
  );

  return { targets, addContact, isLoading, error: error as Error | undefined };
}
