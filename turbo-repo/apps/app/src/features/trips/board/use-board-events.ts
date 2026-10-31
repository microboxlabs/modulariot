"use client";

import { useEffect, useState } from "react";
import { mutate } from "swr";

const API = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/trips`;
const DEBOUNCE_MS = 500;

/** Every board view and trip page read from the API. */
export function isBoardKey(key: unknown): boolean {
  return typeof key === "string" && key.startsWith(`${API}/board/`);
}

/**
 * Listens to the organization's trip changes and reloads the boards and trip pages on screen, at most once per half
 * second. Returns whether the stream is connected; the pages still poll every 30 seconds without it.
 */
export function useBoardEvents(): boolean {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const source = new EventSource(`${API}/board/events`);
    let timer: number | undefined;
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (message) => {
      try {
        const change = JSON.parse(message.data as string) as { type?: string };
        if (change.type !== "trip") return;
      } catch {
        return;
      }
      if (timer !== undefined) return;
      timer = window.setTimeout(() => {
        timer = undefined;
        void mutate(isBoardKey);
      }, DEBOUNCE_MS);
    };
    return () => {
      window.clearTimeout(timer);
      source.close();
    };
  }, []);

  return connected;
}
