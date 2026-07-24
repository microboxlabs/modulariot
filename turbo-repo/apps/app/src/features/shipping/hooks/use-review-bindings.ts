"use client";

import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import {
  REVIEW_EVENT_TYPE,
  REVIEW_SCOPE_KIND,
  taskKeysForBoard,
  type DispatchTarget,
  type EventBinding,
  type UpsertBindingRequest,
} from "../components/lane/review-binding.types";
import {
  deleteBinding,
  fetchBindings,
  fetchDispatchTargets,
  upsertBinding,
} from "../components/lane/review-bindings-data-service";

const BINDINGS_KEY = "integration-event-bindings";
const TARGETS_KEY = "integration-dispatch-targets";

/**
 * The review bindings for this board's columns, and the channels they can point at.
 *
 * Replaces the localStorage hook the mockup used. Mutations revalidate rather than
 * patching locally, so server-owned fields — who last changed a binding, whether it
 * is inherited from a parent org — come back from the source that decided them.
 *
 * A column maps to one Activiti task per binding. Where a column aggregates several
 * tasks, saving writes one binding each, so every task fires on its own completion
 * rather than one of them silently going unbound.
 */
export function useReviewBindings(orgSlug: string | null) {
  const {
    data: bindings,
    error,
    isLoading,
    mutate,
  } = useSWR<EventBinding[], Error>(
    orgSlug ? [BINDINGS_KEY, orgSlug] : null,
    () => fetchBindings(orgSlug as string),
    { revalidateOnFocus: false, dedupingInterval: 5_000 }
  );

  const { data: targets } = useSWR<DispatchTarget[], Error>(
    orgSlug ? [TARGETS_KEY, orgSlug] : null,
    () => fetchDispatchTargets(orgSlug as string),
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  const [saving, setSaving] = useState(false);

  /** Bindings by the Activiti task they listen to, for quick per-column lookup. */
  const byTaskKey = useMemo(() => {
    const index = new Map<string, EventBinding>();
    for (const binding of bindings ?? []) {
      if (binding.eventType !== REVIEW_EVENT_TYPE || !binding.scopeKey) continue;
      // An org's own binding wins over one inherited from its parent.
      const existing = index.get(binding.scopeKey);
      if (!existing || (existing.inherited && !binding.inherited)) {
        index.set(binding.scopeKey, binding);
      }
    }
    return index;
  }, [bindings]);

  /** The binding governing a board column, own or inherited. */
  const bindingForBoard = useCallback(
    (boardKey: string): EventBinding | undefined => {
      for (const taskKey of taskKeysForBoard(boardKey)) {
        const found = byTaskKey.get(taskKey);
        if (found) return found;
      }
      return undefined;
    },
    [byTaskKey]
  );

  /**
   * Writes one binding per Activiti task behind the column. Sequential rather than
   * concurrent: they share a unique key per task and a failure part-way should stop
   * rather than race the rest in.
   */
  const save = useCallback(
    async (boardKey: string, draft: Omit<UpsertBindingRequest, "eventType" | "scopeKind" | "scopeKey">) => {
      if (!orgSlug) throw new Error("No organization is selected");
      setSaving(true);
      try {
        for (const taskKey of taskKeysForBoard(boardKey)) {
          await upsertBinding(orgSlug, {
            ...draft,
            eventType: REVIEW_EVENT_TYPE,
            scopeKind: REVIEW_SCOPE_KIND,
            scopeKey: taskKey,
          });
        }
        await mutate();
      } finally {
        setSaving(false);
      }
    },
    [orgSlug, mutate]
  );

  const remove = useCallback(
    async (bindingId: string) => {
      if (!orgSlug) throw new Error("No organization is selected");
      setSaving(true);
      try {
        await deleteBinding(orgSlug, bindingId);
        await mutate();
      } finally {
        setSaving(false);
      }
    },
    [orgSlug, mutate]
  );

  return {
    bindings: bindings ?? [],
    targets: targets ?? [],
    bindingForBoard,
    isLoading,
    error,
    saving,
    save,
    remove,
    refresh: mutate,
  };
}
