"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Spinner } from "flowbite-react";
import { HiPlus } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  deleteEnrichmentBinding,
  fetchEnrichmentBindings,
  fetchEnrichmentTargets,
  upsertEnrichmentBinding,
} from "../enrichment-data-service";
import type {
  EnrichmentBinding,
  EnrichmentTarget,
  UpsertEnrichmentBinding,
} from "../enrichment.types";
import { EnrichmentBindingModal } from "./enrichment-binding-modal";

interface EnrichmentSectionProps {
  readonly orgSlug: string;
  /** Connection id → display name, from the connections the page already loaded. */
  readonly connectionNames: ReadonlyMap<string, string>;
  readonly dict: I18nRecord;
}

/**
 * Settings › Connections › Calendar enrichment.
 *
 * Manages the fetch-shaped binding the calendar's sync jobs consult before a
 * booking write — which connection resolves workflow identity into resource
 * ids, and how fields map in both directions. Kanban's review channels
 * administer the notify-shaped rows of the same table; this administers the
 * fetch-shaped one.
 */
export function EnrichmentSection({
  orgSlug,
  connectionNames,
  dict,
}: EnrichmentSectionProps) {
  const [bindings, setBindings] = useState<EnrichmentBinding[] | null>(null);
  const [targets, setTargets] = useState<EnrichmentTarget[]>([]);
  const [editing, setEditing] = useState<EnrichmentBinding | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    const [loadedBindings, loadedTargets] = await Promise.all([
      fetchEnrichmentBindings(orgSlug),
      fetchEnrichmentTargets(orgSlug),
    ]);
    setBindings(loadedBindings);
    setTargets(loadedTargets);
  }, [orgSlug]);

  useEffect(() => {
    reload().catch((failure: Error) => {
      setBindings([]);
      setError(failure);
    });
  }, [reload]);

  async function save(request: UpsertEnrichmentBinding) {
    setSaving(true);
    setError(null);
    try {
      await upsertEnrichmentBinding(orgSlug, request);
      setShowModal(false);
      setEditing(null);
      await reload();
    } catch (failure) {
      setError(failure as Error);
    } finally {
      setSaving(false);
    }
  }

  async function remove(binding: EnrichmentBinding) {
    await deleteEnrichmentBinding(orgSlug, binding.id);
    await reload();
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {tr("enrichment.title", dict)}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("enrichment.description", dict)}
          </p>
        </div>
        <Button
          color="blue"
          size="sm"
          onClick={() => {
            setEditing(null);
            setError(null);
            setShowModal(true);
          }}
        >
          <HiPlus className="mr-1 h-4 w-4" />
          {tr("enrichment.add", dict)}
        </Button>
      </div>

      {bindings === null && <Spinner size="sm" />}

      {bindings?.length === 0 && (
        <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
          {tr("enrichment.empty", dict)}
        </p>
      )}

      {!!bindings?.length && (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
          {bindings.map((binding) => (
            <li key={binding.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {connectionNames.get(binding.connectionId) ??
                      binding.connectionId}
                  </span>
                  <Badge color={binding.enabled ? "success" : "gray"} size="xs">
                    {binding.enabled
                      ? tr("enrichment.on", dict)
                      : tr("enrichment.off", dict)}
                  </Badge>
                  {binding.inherited && (
                    <Badge color="indigo" size="xs">
                      {tr("enrichment.inherited", dict)}
                    </Badge>
                  )}
                </div>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {binding.scopeKey
                    ? tr("enrichment.scopedTo", dict, {
                        calendar: binding.scopeKey,
                      })
                    : tr("enrichment.allCalendars", dict)}
                  {" · "}
                  {Object.keys(binding.fieldTemplates).length}→
                  {Object.keys(binding.responseTemplates ?? {}).length}{" "}
                  {tr("enrichment.mappedFields", dict)}
                </p>
              </div>
              {/* Inherited rows are visible but the parent owns them. */}
              {!binding.inherited && (
                <>
                  <Button
                    color="light"
                    size="xs"
                    onClick={() => {
                      setEditing(binding);
                      setError(null);
                      setShowModal(true);
                    }}
                  >
                    {tr("enrichment.edit", dict)}
                  </Button>
                  <Button
                    color="light"
                    size="xs"
                    onClick={() => remove(binding)}
                  >
                    {tr("enrichment.delete", dict)}
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <EnrichmentBindingModal
        show={showModal}
        onClose={() => {
          setShowModal(false);
          setEditing(null);
        }}
        onSubmit={save}
        targets={targets}
        editing={editing}
        loading={saving}
        error={error}
        dict={dict}
      />
    </section>
  );
}
