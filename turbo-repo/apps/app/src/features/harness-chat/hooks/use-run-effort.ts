"use client";

import type { RunEffort } from "@microboxlabs/miot-harness-client";
import { useSyncExternalStore } from "react";

export const RUN_EFFORTS: readonly RunEffort[] = [
  "low",
  "medium",
  "high",
  "max",
];

const STORAGE_KEY = "miot.harnessChat.effort";

const listeners = new Set<() => void>();
// Used when localStorage is unavailable, so the choice lasts for the page.
let inMemory: RunEffort | null = null;

/**
 * The reasoning effort the user picked, or null for the harness default. Read
 * when a run starts, so every open session sends the current choice.
 */
export function readRunEffort(): RunEffort | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return inMemory;
    const value = storage.getItem(STORAGE_KEY);
    return RUN_EFFORTS.find((level) => level === value) ?? null;
  } catch {
    return inMemory;
  }
}

export function setRunEffort(effort: RunEffort | null): void {
  inMemory = effort;
  try {
    if (effort) globalThis.localStorage?.setItem(STORAGE_KEY, effort);
    else globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: `inMemory` holds the choice.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRunEffort(): [
  RunEffort | null,
  (effort: RunEffort | null) => void,
] {
  const effort = useSyncExternalStore(subscribe, readRunEffort, () => null);
  return [effort, setRunEffort];
}
