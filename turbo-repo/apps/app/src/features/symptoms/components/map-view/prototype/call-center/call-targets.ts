"use client";

/**
 * Who the call panel can call: the active contacts of the contact book, each
 * with its channels and call statistics. Trip people are book contacts too.
 */

import { useCallback, useMemo } from "react";
import { mutate } from "swr";
import {
  isValidPhone,
  toE164,
} from "@/features/common/components/phone-input/phone-input";
import { contactReachKey } from "@/features/conversations/conversations-api";
import {
  contactFacetsKey,
  contactsKey,
  createContact,
  type TowerAction,
  type TowerCallMethod,
  type TowerContact,
  type TowerContactBody,
  type TowerContactChannels,
  updateContact,
  useContacts,
} from "@/features/symptoms/control-tower/control-tower-api";
import { isDriverRole } from "@/features/symptoms/control-tower/step-who";
import { normalizeRut } from "@/utils/rut";
import { ALL_CALL_METHODS, type CallMethod } from "./call-method";

export interface CallStats {
  lastCallAt: Date | null;
  accepted: number;
  denied: number;
}

export interface CallTarget {
  /** Row id: the API contact id, or `new:<phone>` for a number not saved to the book. */
  id: string;
  /** API contact id; absent for a number not saved to the book. */
  contactId?: string;
  personName: string;
  role: string;
  phone: string;
  channels?: TowerContactChannels | null;
  /** The contact's company and its tax id; absent for a carrier-less contact. */
  company?: string | null;
  companyRut?: string | null;
  /** The contact's national id (RUT, DNI, ...); absent for a number not saved to the book. */
  nationalId?: string | null;
  /** The channels the target can be reached on. Empty means none. */
  methods: CallMethod[];
  stats: CallStats | null;
}

/** Phone number displayed and recorded for the selected channel. */
export function phoneForMethod(
  target: Pick<CallTarget, "phone" | "channels">,
  method: CallMethod
): string {
  if (method === "phone" || method === "whatsapp")
    return target.channels?.[method]?.trim() || target.phone;
  return target.phone;
}

/** Older CALL actions to the driver have no contact id, only the role. */
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

/** The call channel a step asks for; null when the step's channel is not a call (email). */
export function stepMethod(
  channel: string | null | undefined
): CallMethod | null {
  if (channel === "call" || !channel) return "phone";
  if (channel === "whatsapp" || channel === "teams" || channel === "meet")
    return channel;
  return null;
}

/** What a contact created from an empty trip step starts with. */
export interface NewContactPreset {
  role: string;
  nationalId?: string;
  nationalIdType?: string;
  companyTaxIdType?: string;
  companyRut?: string;
  company?: string;
}

/** Which call-list row a recorded CALL action belongs to. */
export function targetIdOfAction(action: TowerAction): string | null {
  if (action.kind !== "CALL") return null;
  if (action.contactId) return action.contactId;
  return isDriverRole(action.contactRole) ? DRIVER_TARGET_ID : null;
}

/** A book contact as a call-list row. */
export function toCallTarget(c: TowerContact): CallTarget {
  return {
    id: c.id,
    contactId: c.id,
    personName: c.name,
    role: c.role ?? "",
    phone: c.phone || c.channels?.phone || c.channels?.whatsapp || "",
    channels: c.channels,
    company: c.company,
    companyRut: c.companyRut ?? null,
    nationalId: c.nationalId ?? null,
    methods: contactMethods(c),
    stats: {
      lastCallAt: c.lastCalledAt ? new Date(c.lastCalledAt) : null,
      accepted: c.answered,
      denied: c.missed,
    },
  };
}

const normalizedId = (id: string | null | undefined) => normalizeRut(id ?? "");

/** True when the contact's national id is the trip driver's RUT. */
export function isTripDriver(
  target: Pick<CallTarget, "nationalId">,
  driverRut: string | null | undefined
): boolean {
  const id = normalizedId(target.nationalId);
  return id !== "" && id === normalizedId(driverRut);
}

/** The trip's driver phone in E.164 (a national number is read as Chilean), or null when it is not a valid number. */
export function tripPhoneE164(raw: string | null | undefined): string | null {
  const text = raw?.trim() ?? "";
  if (!text || !isValidPhone(text, "CL")) return null;
  return toE164(text, "CL") ?? null;
}

/** The update that gives a contact with no phone the trip's number, on phone and WhatsApp. */
export function tripPhoneBody(
  contact: Pick<TowerContact, "methods" | "channels">,
  phone: string
): TowerContactBody {
  const added: TowerCallMethod[] = ["PHONE", "WHATSAPP"];
  return {
    phone,
    methods: [
      ...contact.methods,
      ...added.filter((m) => !contact.methods.includes(m)),
    ],
    channels: { ...contact.channels, phone, whatsapp: phone },
  };
}

/** Who the call panel can call: the active contacts of the book. */
export function useCallTargets() {
  const { data, isLoading, error } = useContacts();

  const targets = useMemo<CallTarget[]>(
    () => (data ?? []).filter((c) => c.active).map(toCallTarget),
    [data]
  );

  /**
   * Saves a number typed in the call panel as a provisional contact,
   * reachable by phone and WhatsApp. `preset` carries the role and RUTs of
   * the trip person the step could not find.
   */
  const addContact = useCallback(
    async (input: {
      name: string;
      phone: string;
      preset?: NewContactPreset;
    }): Promise<TowerContact> => {
      const methods: CallMethod[] = ["phone", "whatsapp"];
      const saved = await createContact({
        name: input.name,
        phone: input.phone,
        methods: methods.map(toApiMethod),
        channels: { phone: input.phone, whatsapp: input.phone },
        provisional: true,
        role: input.preset?.role || undefined,
        nationalId: input.preset?.nationalId || undefined,
        nationalIdType: input.preset?.nationalIdType,
        companyTaxIdType: input.preset?.companyTaxIdType,
        companyRut: input.preset?.companyRut || undefined,
        company: input.preset?.company || undefined,
      });
      void mutate(contactsKey);
      return saved;
    },
    []
  );

  /**
   * Saves the trip's driver phone (E.164) on a book contact that has none,
   * and allows phone and WhatsApp. Resolves with the updated contact's row;
   * rejects with the API's error.
   */
  const saveTripPhone = useCallback(
    async (contactId: string, phone: string): Promise<CallTarget> => {
      const current = data?.find((c) => c.id === contactId);
      if (!current) throw new Error(`Contact ${contactId} is not in the book`);
      const saved = await updateContact(
        contactId,
        tripPhoneBody(current, phone)
      );
      void mutate(contactsKey);
      void mutate(contactFacetsKey);
      void mutate(contactReachKey);
      return toCallTarget(saved);
    },
    [data]
  );

  return {
    targets,
    addContact,
    saveTripPhone,
    isLoading,
    error: error as Error | undefined,
  };
}
