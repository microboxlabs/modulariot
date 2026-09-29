"use client";

/**
 * PROTOTYPE — the shared badges ("descriptors") contacts are tagged with,
 * e.g. [transportista] [mintral] [santiago]. Managed from the contact form:
 * created, renamed and deleted there, and reused across contacts. Contacts
 * store badge ids, so a rename shows everywhere and a deleted badge simply
 * stops showing. Same localStorage + custom event + `storage` listener
 * pattern as the contact store.
 */

import { useCallback, useEffect, useState } from "react";

export interface ContactBadge {
  id: string;
  name: string;
}

const BADGES_KEY = "miot.prototype.contact-badges.v1";
const SYNC_EVENT = "miot:contact-badges-changed";

/** Case- and accent-insensitive key for matching names. */
export function normalizeLabel(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replaceAll(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function readBadges(): ContactBadge[] {
  if (globalThis.window === undefined) return [];
  try {
    const raw = window.localStorage.getItem(BADGES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ContactBadge[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBadges(next: ContactBadge[]): void {
  if (globalThis.window === undefined) return;
  try {
    window.localStorage.setItem(BADGES_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(SYNC_EVENT));
  } catch {
    // storage unavailable — callers still get the returned value.
  }
}

function findByName(badges: readonly ContactBadge[], name: string): ContactBadge | undefined {
  const key = normalizeLabel(name);
  return badges.find((b) => normalizeLabel(b.name) === key);
}

/** Returns the badge named `name` (case/accent-insensitive), creating it
 *  when it doesn't exist yet. */
export function ensureBadge(name: string): ContactBadge {
  const current = readBadges();
  const existing = findByName(current, name);
  if (existing) return existing;
  const created: ContactBadge = {
    id: `badge_${Math.random().toString(36).slice(2, 9)}`,
    name: name.trim(),
  };
  writeBadges([...current, created]);
  return created;
}

/** Renames a badge. Returns false (and changes nothing) when the new name
 *  is empty or already used by another badge. */
export function renameBadge(id: string, name: string): boolean {
  const current = readBadges();
  const clash = findByName(current, name);
  if (!name.trim() || (clash && clash.id !== id)) return false;
  writeBadges(current.map((b) => (b.id === id ? { ...b, name: name.trim() } : b)));
  return true;
}

export function deleteBadge(id: string): void {
  writeBadges(readBadges().filter((b) => b.id !== id));
}

export function useContactBadges() {
  const [badges, setBadges] = useState<ContactBadge[]>([]);
  useEffect(() => {
    setBadges(readBadges());
    const sync = () => setBadges(readBadges());
    window.addEventListener(SYNC_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SYNC_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const ensure = useCallback((name: string) => ensureBadge(name), []);
  const rename = useCallback((id: string, name: string) => renameBadge(id, name), []);
  const remove = useCallback((id: string) => deleteBadge(id), []);
  return { badges, ensure, rename, remove };
}
