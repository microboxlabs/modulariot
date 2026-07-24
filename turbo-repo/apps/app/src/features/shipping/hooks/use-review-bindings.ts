"use client";

import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import {
  attachedChannels,
  bindingChannelKey,
  channelKey,
  REVIEW_EVENT_TYPE,
  REVIEW_SCOPE_KIND,
  taskKeysForBoard,
  type ChannelBindingDraft,
  type DispatchTarget,
  type EventBinding,
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
 * A column may fan a verdict out to several channels: the backend keys bindings on
 * `connection_id` on purpose, so one event legitimately drives many. This hook
 * therefore exposes the *list* of channels a column carries, and `save` commits the
 * whole set — upserting what is attached and soft-deleting what was detached.
 *
 * A column maps to one Activiti task per binding. Where a column aggregates several
 * tasks, saving writes one binding per channel per task, so every task fires on its
 * own completion rather than one of them silently going unbound.
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

  const allBindings = useMemo(() => bindings ?? [], [bindings]);

  /** The channels attached to a board column, own or inherited, one entry each. */
  const bindingsForBoard = useCallback(
    (boardKey: string): EventBinding[] => attachedChannels(allBindings, boardKey),
    [allBindings]
  );

  /**
   * Commits a column's whole set of channels. For every Activiti task behind the
   * column it upserts each attached channel and soft-deletes the org's own bindings
   * that are no longer in the set — so detaching a channel in the drawer removes it
   * everywhere it was written. Inherited bindings belong to a parent org and are left
   * untouched.
   *
   * Sequential rather than concurrent: writes for one task share a unique key and a
   * failure part-way should stop rather than race the rest in.
   */
  const save = useCallback(
    async (boardKey: string, channels: readonly ChannelBindingDraft[]) => {
      if (!orgSlug) throw new Error("No organization is selected");
      setSaving(true);
      try {
        const desired = new Set(
          channels.map((channel) =>
            channelKey(channel.connectionId, channel.operationId)
          )
        );
        for (const taskKey of taskKeysForBoard(boardKey)) {
          for (const channel of channels) {
            await upsertBinding(orgSlug, {
              ...channel,
              eventType: REVIEW_EVENT_TYPE,
              scopeKind: REVIEW_SCOPE_KIND,
              scopeKey: taskKey,
            });
          }
          const stale = allBindings.filter(
            (binding) =>
              !binding.inherited &&
              binding.eventType === REVIEW_EVENT_TYPE &&
              binding.scopeKey === taskKey &&
              !desired.has(bindingChannelKey(binding))
          );
          for (const binding of stale) {
            await deleteBinding(orgSlug, binding.id);
          }
        }
        await mutate();
      } finally {
        setSaving(false);
      }
    },
    [orgSlug, allBindings, mutate]
  );

  return {
    bindings: allBindings,
    targets: targets ?? [],
    bindingsForBoard,
    isLoading,
    error,
    saving,
    save,
    refresh: mutate,
  };
}
