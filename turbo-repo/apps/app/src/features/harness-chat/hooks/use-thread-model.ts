"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { getThread } from "../harness-thread-store";
import { useHarnessModels } from "./use-harness-models";

/**
 * Starts a reopened thread on the model it last ran on, when that model is
 * still offered. A model the user already picked in this session wins.
 */
export function useThreadModel(
  sessionId: string,
  setModel: Dispatch<SetStateAction<string | null>>
): void {
  const offered = useHarnessModels();
  const [stored, setStored] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void getThread(sessionId, controller.signal).then((thread) => {
      if (!controller.signal.aborted) setStored(thread?.model ?? null);
    });
    return () => controller.abort();
  }, [sessionId]);

  useEffect(() => {
    if (stored && offered.models.includes(stored)) {
      setModel((current) => current ?? stored);
    }
  }, [stored, offered.models, setModel]);
}
