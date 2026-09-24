"use client";

/**
 * PROTOTYPE — client-only persistence for the contact book: the system-wide
 * directory of people that Settings › Libreta de contactos maintains and the
 * call-center's "who to call" picker searches. Same localStorage + custom
 * event + `storage` listener pattern as the Selectables store.
 */

import { useCallback, useEffect, useState } from "react";
import type { CallMethod } from "@/features/symptoms/components/map-view/prototype/call-center/call-method";

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
   *  (a number for phone/WhatsApp, an account email for Teams/Meet). Absent on
   *  contacts saved before channels existed. */
  channels?: Partial<Record<CallMethod, string>>;
}

const STORAGE_KEY = "miot.prototype.contact-book.v1";
const SYNC_EVENT = "miot:contact-book-changed";

export function makeContactId(): string {
  return `contact_${Math.random().toString(36).slice(2, 9)}`;
}

function read(): BookContact[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BookContact[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(next: BookContact[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(SYNC_EVENT));
  } catch {
    // storage unavailable — in-memory state still updates for this tab.
  }
}

export function useContactBook() {
  const [contacts, setContacts] = useState<BookContact[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setContacts(read());
    setHydrated(true);
    const sync = () => setContacts(read());
    window.addEventListener(SYNC_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SYNC_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  /** Upsert by id. */
  const save = useCallback((contact: BookContact) => {
    const current = read();
    const exists = current.some((c) => c.id === contact.id);
    const next = exists
      ? current.map((c) => (c.id === contact.id ? contact : c))
      : [...current, contact];
    write(next);
    setContacts(next);
  }, []);

  const remove = useCallback((id: string) => {
    const next = read().filter((c) => c.id !== id);
    write(next);
    setContacts(next);
  }, []);

  return { contacts, hydrated, save, remove };
}
