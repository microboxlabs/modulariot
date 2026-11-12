"use client";

import { useCallback, useEffect, useRef } from "react";
import type { TreatmentsRequest } from "@/app/api/treatments/route.type";
import type { CallSession } from "./call-center/call-session";
import {
  guardedAbandonTreatment,
  guardedStartTreatment,
  retainTreatmentForCall,
  isConflict,
} from "./prototype-api-guard";

/**
 * Opens the operator's treatment while the treatment panel is open, so every
 * save records into it even after the engine closes the case. Leaving the
 * panel or the page cancels it when nothing was recorded. A call of the case
 * still in the call session keeps it open: its result is recorded later.
 *
 * Returns `ensure`, which opens the treatment again if the first try failed.
 */
export function useStartedTreatment({
  request,
  active,
  callSession,
  onRefused,
  onFailed,
}: {
  request: TreatmentsRequest;
  active: boolean;
  callSession: CallSession | null;
  /** The API refused the treatment: the case is closed, or another operator treats it. */
  onRefused: (error: Error) => void;
  onFailed: () => void;
}): { ensure: () => void; callCleared: () => void } {
  const symptomId = request.symptom_id;
  const latest = useRef({
    request,
    onRefused,
    onFailed,
    call: callSession?.call,
  });
  const lifetime = useRef<object | null>(null);
  useEffect(() => {
    latest.current = { ...latest.current, request, onRefused, onFailed };
  }, [request, onRefused, onFailed]);
  useEffect(() => {
    latest.current.call = callSession?.call;
  }, [callSession?.call]);

  const ensure = useCallback(() => {
    const current = lifetime.current;
    if (!current) return;
    guardedStartTreatment(latest.current.request).catch((error: unknown) => {
      if (lifetime.current !== current) return;
      if (isConflict(error)) latest.current.onRefused(error);
      else latest.current.onFailed();
    });
  }, []);

  /** The panel cleared the case's ended call in the same update that closes it. */
  const callCleared = useCallback(() => {
    if (latest.current.call?.status !== "live") latest.current.call = null;
  }, []);

  useEffect(() => {
    if (!active) return;
    lifetime.current = {};
    ensure();
    const leave = (keepalive: boolean) => {
      const call = latest.current.call;
      const callPending =
        call?.status !== "failed" && call?.context.caseId === String(symptomId);
      if (callPending) retainTreatmentForCall(symptomId);
      else void guardedAbandonTreatment(symptomId, { keepalive });
    };
    const onPageHide = () => leave(true);
    // A page restored from the back/forward cache still shows the panel.
    globalThis.addEventListener("pagehide", onPageHide);
    globalThis.addEventListener("pageshow", ensure);
    return () => {
      lifetime.current = null;
      globalThis.removeEventListener("pagehide", onPageHide);
      globalThis.removeEventListener("pageshow", ensure);
      leave(false);
    };
  }, [active, symptomId, ensure]);

  return { ensure, callCleared };
}
