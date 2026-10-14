"use client";

/**
 * The organization's contact book: the directory of people that Settings ›
 * Libreta de contactos maintains and the call panel searches. Stored by the
 * modulith Control Tower API (`/contacts`), so every operator of the
 * organization sees the same book. Tags are stored on each contact by name;
 * the badge list itself is still per browser (`taxonomy-store.ts`).
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { CallMethod } from "@/features/symptoms/components/map-view/prototype/call-center/call-method";
import {
  createContact,
  deleteContact,
  importContacts,
  updateContact,
  useContacts,
  type TowerCallMethod,
  type TowerContact,
  type TowerContactBody,
  type TowerContactImportResult,
} from "@/features/symptoms/control-tower/control-tower-api";
import { displayRut } from "./contact-duplicates";
import {
  ensureBadge,
  normalizeLabel,
  readBadges,
  useContactBadges,
  type ContactBadge,
} from "./taxonomy-store";

export interface BookContact {
  id: string;
  name: string;
  /** Derived from `channels` on save: the primary number shown in lists. */
  phone: string;
  role: string;
  /** Derived from `channels` on save: which methods the call flow offers.
   *  Empty means "no restriction" — every method is offered. */
  methods: CallMethod[];
  /** Configured channels only, each with the address to reach the contact on
   *  (a number for phone/WhatsApp, an account email for Teams/Meet). */
  channels?: Partial<Record<CallMethod, string>>;
  /** Free text about the person; the API's `notes`. The table falls back to
   *  `role` when it is empty. */
  description?: string;
  /** Chilean RUT; unique in the organization (compared normalized). */
  rut?: string;
  company?: string;
  position?: string;
  /** Id of the organization member this contact was created from, if any. */
  orgMemberId?: string;
  /** Ids of the badges ("descriptors") describing the contact, from
   *  `taxonomy-store.ts` — e.g. [transportista] [turno noche] [santiago]. */
  badgeIds?: string[];
  /** Captured quickly from the call panel; still to be completed. */
  provisional?: boolean;
}

/** A contact the API has not stored yet. `save` creates it and the API
 *  assigns the real id. */
const NEW_ID_PREFIX = "new_";

export function makeContactId(): string {
  return `${NEW_ID_PREFIX}${crypto.randomUUID()}`;
}

const fromApiMethod = (m: TowerCallMethod) => m.toLowerCase() as CallMethod;
const toApiMethod = (m: CallMethod) => m.toUpperCase() as TowerCallMethod;

function badgeIdByName(badges: readonly ContactBadge[]): Map<string, string> {
  return new Map(badges.map((b) => [normalizeLabel(b.name), b.id]));
}

/** The API contact in the book's shape. Tags without a local badge are left
 *  out until `useContactBook` creates that badge. */
export function toBookContact(
  c: TowerContact,
  badges: readonly ContactBadge[]
): BookContact {
  const idByName = badgeIdByName(badges);
  const channels: Partial<Record<CallMethod, string>> = {};
  for (const [method, address] of Object.entries(c.channels ?? {})) {
    if (address) channels[method as CallMethod] = address;
  }
  return {
    id: c.id,
    name: c.name,
    phone: c.phone ?? "",
    role: c.role ?? "",
    methods: c.methods.map(fromApiMethod),
    channels,
    description: c.notes ?? undefined,
    rut: c.nationalId ? displayRut(c.nationalId) : undefined,
    company: c.company ?? undefined,
    position: c.position ?? undefined,
    orgMemberId: c.memberUserId ?? undefined,
    badgeIds: (c.tags ?? []).flatMap(
      (name) => idByName.get(normalizeLabel(name)) ?? []
    ),
    provisional: c.provisional,
  };
}

/** The full request body for a book contact. Empty strings clear a field. */
export function toContactBody(
  c: BookContact,
  badges: readonly ContactBadge[]
): TowerContactBody & { name: string } {
  const nameById = new Map(badges.map((b) => [b.id, b.name]));
  return {
    name: c.name,
    role: c.role,
    phone: c.phone,
    methods: c.methods.map(toApiMethod),
    notes: c.description ?? "",
    nationalId: c.rut ?? "",
    nationalIdType: "RUT",
    company: c.company ?? "",
    position: c.position ?? "",
    channels: c.channels ?? {},
    tags: (c.badgeIds ?? []).flatMap((id) => nameById.get(id) ?? []),
    memberUserId: c.orgMemberId ?? "",
    provisional: c.provisional ?? false,
  };
}

/** The organizations used in the book (each contact's `company`), once
 *  each (case/accent-insensitive, first spelling wins), sorted by name. */
export function organizationNames(contacts: readonly BookContact[]): string[] {
  const byKey = new Map<string, string>();
  for (const c of contacts) {
    const name = c.company?.trim();
    if (name && !byKey.has(normalizeLabel(name))) byKey.set(normalizeLabel(name), name);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, "es"));
}

/** A tag rename or delete that some contacts did not get. */
export class TagUpdateError extends Error {
  constructor(
    readonly failed: number,
    readonly updated: number
  ) {
    super(`tag not updated on ${failed} contacts`);
  }
}

const sameTag = (a: string, b: string) =>
  normalizeLabel(a) === normalizeLabel(b);

export function useContactBook() {
  const { data, error, mutate } = useContacts();
  const { badges } = useContactBadges();

  // Tags another operator used may not have a badge in this browser yet.
  // Each name is ensured once per mount, so renaming or deleting a badge
  // here does not bring the old name back.
  const ensured = useRef(new Set<string>());
  useEffect(() => {
    for (const tag of (data ?? []).flatMap((c) => c.tags ?? [])) {
      const key = normalizeLabel(tag);
      if (!key || ensured.current.has(key)) continue;
      ensured.current.add(key);
      ensureBadge(tag);
    }
  }, [data]);

  const contacts = useMemo(
    () => (data ?? []).map((c) => toBookContact(c, badges)),
    [data, badges]
  );
  const hydrated = data !== undefined || error !== undefined;

  /** Creates a contact made with `makeContactId`, updates any other.
   *  Resolves with the stored contact; rejects with the API's error. */
  const save = useCallback(
    async (contact: BookContact): Promise<BookContact> => {
      const all = readBadges();
      const body = toContactBody(contact, all);
      const stored = contact.id.startsWith(NEW_ID_PREFIX)
        ? await createContact(body)
        : await updateContact(contact.id, body);
      await mutate();
      return toBookContact(stored, all);
    },
    [mutate]
  );

  /** Creates several contacts in one request (the CSV import). */
  const addMany = useCallback(
    async (added: BookContact[]): Promise<TowerContactImportResult> => {
      const all = readBadges();
      const result = await importContacts(
        added.map((c) => toContactBody(c, all))
      );
      await mutate();
      return result;
    },
    [mutate]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteContact(id);
      await mutate();
    },
    [mutate]
  );

  /** Rewrites the tag on every contact that has it: `to` null removes it.
   *  Rejects with a {@link TagUpdateError} when some contacts were not
   *  updated; the book is reloaded either way. */
  const retag = useCallback(
    async (from: string, to: string | null) => {
      const affected = (data ?? []).filter((c) =>
        (c.tags ?? []).some((t) => sameTag(t, from))
      );
      ensured.current.add(normalizeLabel(from));
      if (to) ensured.current.add(normalizeLabel(to));
      try {
        const results = await Promise.allSettled(
          affected.map((c) => {
            const kept = (c.tags ?? []).filter((t) => !sameTag(t, from));
            return updateContact(c.id, { tags: to ? [...kept, to] : kept });
          })
        );
        const failed = results.filter((r) => r.status === "rejected").length;
        if (failed > 0)
          throw new TagUpdateError(failed, results.length - failed);
      } finally {
        await mutate();
      }
    },
    [data, mutate]
  );

  const renameTag = useCallback(
    (from: string, to: string) => retag(from, to),
    [retag]
  );
  const deleteTag = useCallback((name: string) => retag(name, null), [retag]);

  return {
    contacts,
    hydrated,
    error: error as Error | undefined,
    save,
    addMany,
    remove,
    renameTag,
    deleteTag,
  };
}
