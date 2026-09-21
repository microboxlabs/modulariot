"use client";

/**
 * PROTOTYPE — the extra data a contact gets when it's added through the
 * inline "add contact" form (see `call-center-menu.tsx`), keyed by that
 * option's id: a real phone number (the seeded "who to call" options have no
 * phone field at all — `SelectableOption` is shared with every other
 * selectable in the settings-admin feature, so it isn't grown just for this),
 * a free-text role (searched/created against every role already in use, not
 * a managed list of its own), and which calling channels this contact can
 * actually be reached on. A seeded option (Conductor, Jefe de operaciones, …)
 * has no entry here at all — that's how a row tells "this is a real added
 * contact, its option name IS the person's name" apart from "this is a role
 * placeholder, the person's name is made up". Same localStorage + custom-
 * event pattern as the selectables store itself.
 */

import { useCallback, useEffect, useState } from "react";
import type { CallMethod } from "./call-method";

export interface ContactDetails {
  phone?: string;
  role?: string;
  /** Empty/absent means "no restriction" — every method is offered. */
  methods?: CallMethod[];
}

const STORAGE_KEY = "miot.prototype.contact-details.v1";
const SYNC_EVENT = "miot:contact-details-changed";

type DetailsMap = Record<string, ContactDetails>;

function read(): DetailsMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DetailsMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function write(next: DetailsMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(SYNC_EVENT));
  } catch {
    // storage unavailable — in-memory state still updates for this tab.
  }
}

export function useContactDetails() {
  const [details, setDetailsState] = useState<DetailsMap>({});

  useEffect(() => {
    setDetailsState(read());
    const sync = () => setDetailsState(read());
    window.addEventListener(SYNC_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SYNC_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setDetails = useCallback((optionId: string, patch: ContactDetails) => {
    const next = { ...read(), [optionId]: patch };
    write(next);
    setDetailsState(next);
  }, []);

  return { details, setDetails };
}
