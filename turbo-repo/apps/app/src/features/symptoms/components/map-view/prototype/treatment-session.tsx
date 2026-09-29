"use client";

/**
 * The Control Tower treatment episode behind the open treatment panel. Every
 * form in the panel (call, ignore, invalidate — including a switch from the
 * call form to another one) records into the same episode:
 *
 *   panel opens      → `ensureOpen(type)` (the API resumes the operator's open episode)
 *   a call is saved  → `addAction({kind: "CALL", ...})`
 *   form finished    → `addAction(...)` then `finish()`
 *   panel closes     → the episode is cancelled if nothing was recorded
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { mutate } from "swr";
import {
  addTreatmentAction,
  cancelTreatment,
  closeTreatment,
  contactsKey,
  openTreatment,
  treatmentsKey,
  type AddActionBody,
  type TowerAction,
  type TowerTreatment,
  type TowerTreatmentType,
} from "@/features/symptoms/control-tower/control-tower-api";

interface TreatmentSession {
  treatment: TowerTreatment | null;
  /** Actions recorded in the episode, including those made before a resume. */
  actions: TowerAction[];
  ensureOpen: (type: TowerTreatmentType) => Promise<TowerTreatment | null>;
  addAction: (body: AddActionBody) => Promise<TowerAction>;
  finish: (resolution?: string) => Promise<void>;
}

const TreatmentSessionContext = createContext<TreatmentSession | null>(null);

export function TreatmentSessionProvider({
  symptomId,
  assetId,
  tripId,
  children,
}: {
  symptomId: number | null | undefined;
  assetId?: string;
  tripId?: string;
  children: React.ReactNode;
}) {
  const [treatment, setTreatment] = useState<TowerTreatment | null>(null);
  const [actions, setActions] = useState<TowerAction[]>([]);
  const treatmentRef = useRef<TowerTreatment | null>(null);
  const actionsRef = useRef<TowerAction[]>([]);
  const opening = useRef<Promise<TowerTreatment | null> | null>(null);

  const refresh = useCallback(() => {
    if (symptomId) void mutate(treatmentsKey(symptomId));
  }, [symptomId]);

  const ensureOpen = useCallback(
    async (type: TowerTreatmentType) => {
      if (!symptomId) return null;
      if (treatmentRef.current?.status === "OPEN") return treatmentRef.current;
      if (!opening.current) {
        opening.current = openTreatment(symptomId, { type, assetId, tripId })
          .then((opened) => {
            treatmentRef.current = opened;
            actionsRef.current = opened.actions;
            setTreatment(opened);
            setActions(opened.actions);
            refresh();
            return opened;
          })
          .finally(() => {
            opening.current = null;
          });
      }
      return opening.current;
    },
    [symptomId, assetId, tripId, refresh]
  );

  const addAction = useCallback(
    async (body: AddActionBody) => {
      const current = treatmentRef.current ?? (await ensureOpen("CALL"));
      if (!current) throw new Error("No symptom to treat");
      const saved = await addTreatmentAction(current.id, body);
      actionsRef.current = [...actionsRef.current, saved];
      setActions(actionsRef.current);
      refresh();
      void mutate(contactsKey);
      return saved;
    },
    [ensureOpen, refresh]
  );

  // Idempotent: a retry after a later step failed does not close twice.
  const finish = useCallback(
    async (resolution?: string) => {
      const current = treatmentRef.current;
      if (current?.status !== "OPEN") return;
      const closed = await closeTreatment(current.id, resolution ? { resolution } : {});
      treatmentRef.current = closed;
      setTreatment(closed);
      refresh();
    },
    [refresh]
  );

  // Closing the panel without recording anything leaves no empty episode behind.
  useEffect(
    () => () => {
      const current = treatmentRef.current;
      if (current?.status === "OPEN" && actionsRef.current.length === 0) {
        void cancelTreatment(current.id, "panel closed").finally(refresh);
      }
    },
    [refresh]
  );

  const value = useMemo(
    () => ({ treatment, actions, ensureOpen, addAction, finish }),
    [treatment, actions, ensureOpen, addAction, finish]
  );

  return <TreatmentSessionContext.Provider value={value}>{children}</TreatmentSessionContext.Provider>;
}

export function useTreatmentSession(): TreatmentSession {
  const session = useContext(TreatmentSessionContext);
  if (!session) throw new Error("useTreatmentSession needs a TreatmentSessionProvider");
  return session;
}
