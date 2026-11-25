"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SETUP_STEPS } from "./setup.types";

/** The search parameter that holds the open step. */
export const SETUP_STEP_PARAM = "step";

/** The step's index, or the first step for a missing or unknown one. */
export function setupStepIndex(value: string | null): number {
  return Math.max(
    SETUP_STEPS.findIndex((step) => step === value),
    0
  );
}

/**
 * The setup's open step, kept in the URL (`?step=tags`) so a reload or a
 * shared link opens the same step. The URL is replaced rather than pushed:
 * moving between steps does not fill the browser history.
 *
 * Written with `history.replaceState`, not `router.replace`: the router
 * would navigate, fetching and rendering the page again on the server for
 * every step. Next.js keeps `useSearchParams` in step with the native call.
 */
export function useSetupStep(): [number, (index: number) => void] {
  const searchParams = useSearchParams();
  const [active, setActive] = useState(() =>
    setupStepIndex(searchParams.get(SETUP_STEP_PARAM))
  );
  const select = useCallback((index: number) => {
    const step = SETUP_STEPS[index];
    if (step === undefined) return;
    setActive(index);
    const params = new URLSearchParams(globalThis.location.search);
    params.set(SETUP_STEP_PARAM, step);
    globalThis.history.replaceState(null, "", `?${params.toString()}`);
  }, []);
  return [active, select];
}
