"use client";

import type { RunEffort } from "@microboxlabs/miot-harness-client";
import { useCallback, useEffect, useState } from "react";

export const RUN_EFFORTS: readonly RunEffort[] = [
  "low",
  "medium",
  "high",
  "max",
];

const STORAGE_KEY = "miot.harnessChat.effort";

function readStored(): RunEffort | null {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY);
    return RUN_EFFORTS.find((level) => level === value) ?? null;
  } catch {
    return null;
  }
}

/**
 * The reasoning effort the user picked, kept across sessions in
 * localStorage. Null is the harness default.
 */
export function useRunEffort(): [
  RunEffort | null,
  (effort: RunEffort | null) => void,
] {
  const [effort, setEffortState] = useState<RunEffort | null>(null);

  useEffect(() => {
    setEffortState(readStored());
  }, []);

  const setEffort = useCallback((next: RunEffort | null) => {
    setEffortState(next);
    try {
      if (next) globalThis.localStorage?.setItem(STORAGE_KEY, next);
      else globalThis.localStorage?.removeItem(STORAGE_KEY);
    } catch {
      // Storage unavailable: the choice lasts for this page only.
    }
  }, []);

  return [effort, setEffort];
}
