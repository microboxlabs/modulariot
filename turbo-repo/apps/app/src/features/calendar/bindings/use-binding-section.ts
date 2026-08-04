"use client";

import { useCallback, useEffect, useState } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  deleteBinding,
  EnrichmentRequestError,
  fetchBindingsByEvent,
  fetchEnrichmentTargets,
  upsertBinding,
} from "../enrichment/enrichment-data-service";
import type {
  EnrichmentBinding,
  EnrichmentTarget,
} from "../enrichment/enrichment.types";

export type BindingSectionView<T> =
  | { kind: "list" }
  | { kind: "edit"; binding: T | null };

export interface BindingSectionOptions {
  /** Mirrors the drawer's `show` — reload on every open. */
  readonly active: boolean;
  readonly orgSlug: string | null;
  /** The calendar the planner is looking at — narrows the visible bindings. */
  readonly calendarId: string;
  readonly eventType: string;
  /** i18n key for the 403 message — the one per-section string in here. */
  readonly forbiddenKey: string;
  readonly dict: I18nRecord;
}

/**
 * The state scaffolding every calendar-administered binding section shares:
 * load the org's bindings for one event (global rows plus the ones scoped to
 * this calendar) and the dispatch targets, swap between list and inline form,
 * and run save/delete with status-aware error text (a 403 is "you are not an
 * org admin", localized; anything else keeps the modulith's message, which for
 * 400s is the validation text the operator needs verbatim).
 */
export function useBindingSection<T extends EnrichmentBinding>({
  active,
  orgSlug,
  calendarId,
  eventType,
  forbiddenKey,
  dict,
}: BindingSectionOptions) {
  const [bindings, setBindings] = useState<T[] | null>(null);
  const [targets, setTargets] = useState<EnrichmentTarget[]>([]);
  const [view, setView] = useState<BindingSectionView<T>>({ kind: "list" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!orgSlug) return;
    const [loadedBindings, loadedTargets] = await Promise.all([
      fetchBindingsByEvent<T>(orgSlug, eventType),
      fetchEnrichmentTargets(orgSlug),
    ]);
    setBindings(
      loadedBindings.filter(
        (binding) => !binding.scopeKey || binding.scopeKey === calendarId
      )
    );
    setTargets(loadedTargets);
  }, [orgSlug, calendarId, eventType]);

  const describeFailure = useCallback(
    (failure: unknown): string => {
      if (failure instanceof EnrichmentRequestError && failure.status === 403) {
        return tr(forbiddenKey, dict);
      }
      return (failure as Error).message;
    },
    [forbiddenKey, dict]
  );

  useEffect(() => {
    if (!active) return;
    setView({ kind: "list" });
    setError(null);
    setBindings(null);
    reload().catch((requestError: unknown) => {
      setBindings([]);
      setError(describeFailure(requestError));
    });
  }, [active, reload, describeFailure]);

  const handleCancel = useCallback(() => {
    setError(null);
    setView({ kind: "list" });
  }, []);

  const handleDelete = useCallback(
    async (binding: T) => {
      if (!orgSlug) return;
      setError(null);
      try {
        await deleteBinding(orgSlug, binding.id);
        await reload();
      } catch (requestError) {
        // The list stays as-is: a failed delete removed nothing.
        setError(describeFailure(requestError));
      }
    },
    [orgSlug, reload, describeFailure]
  );

  const handleSave = useCallback(
    async (request: unknown) => {
      if (!orgSlug) return;
      setSaving(true);
      setError(null);
      try {
        await upsertBinding(orgSlug, request);
        setView({ kind: "list" });
        await reload();
      } catch (requestError) {
        setError(describeFailure(requestError));
      } finally {
        setSaving(false);
      }
    },
    [orgSlug, reload, describeFailure]
  );

  return {
    bindings,
    targets,
    view,
    setView,
    saving,
    error,
    handleCancel,
    handleDelete,
    handleSave,
  };
}
