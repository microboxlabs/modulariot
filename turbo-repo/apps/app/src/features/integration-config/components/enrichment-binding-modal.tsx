"use client";

import { useEffect, useMemo, useState } from "react";
import { Select, TextInput, ToggleSwitch } from "flowbite-react";
import FormModal from "@/features/common/components/form-modal/form-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { SettingsFormField } from "@/features/settings-admin/components/settings-form-field";
import {
  DEFAULT_RESPONSE_TEMPLATES,
  ENRICHMENT_EVENT_TYPE,
  ENRICHMENT_SCOPE_KIND,
  REQUEST_TEMPLATE_SUGGESTIONS,
  type EnrichmentBinding,
  type EnrichmentTarget,
  type UpsertEnrichmentBinding,
} from "../enrichment.types";

interface EnrichmentBindingModalProps {
  readonly show: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (request: UpsertEnrichmentBinding) => void;
  readonly targets: readonly EnrichmentTarget[];
  readonly editing: EnrichmentBinding | null;
  readonly loading: boolean;
  readonly error: Error | null;
  readonly dict: I18nRecord;
}

/**
 * Authoring form for the calendar's resource-enrichment binding — the fetch-shaped
 * sibling of the kanban's review channel drawer.
 *
 * Same three questions, one more answer: which connection answers (picker over the
 * dispatch targets), what to send (request mapping over the job payload), and —
 * new for a fetch — what to write back (response mapping onto the booking's data).
 * The request rows come from the operation's own contract so the operator maps the
 * parameters that actually exist; the response rows are free-form because the
 * booking's data keys are theirs to name. Server-side validation remains the
 * authority — this form is a convenient way to author what the API will verify.
 */
export function EnrichmentBindingModal({
  show,
  onClose,
  onSubmit,
  targets,
  editing,
  loading,
  error,
  dict,
}: EnrichmentBindingModalProps) {
  const isEdit = editing !== null;
  const [targetKey, setTargetKey] = useState("");
  const [scopeKey, setScopeKey] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [requestRows, setRequestRows] = useState<Record<string, string>>({});
  const [responseRows, setResponseRows] = useState<[string, string][]>([]);

  const target = useMemo(
    () =>
      targets.find((t) => `${t.connectionId}:${t.operationId}` === targetKey),
    [targets, targetKey]
  );

  // Initialize when the modal opens so a reopened form never shows stale input.
  useEffect(() => {
    if (!show) return;
    if (editing) {
      setTargetKey(`${editing.connectionId}:${editing.operationId ?? ""}`);
      setScopeKey(editing.scopeKey ?? "");
      setEnabled(editing.enabled);
      setRequestRows({ ...editing.fieldTemplates });
      setResponseRows(Object.entries(editing.responseTemplates ?? {}));
      return;
    }
    setTargetKey("");
    setScopeKey("");
    setEnabled(true);
    setRequestRows({});
    setResponseRows(Object.entries(DEFAULT_RESPONSE_TEMPLATES));
  }, [show, editing]);

  // A newly picked target seeds its parameters with the known suggestions;
  // switching targets re-seeds, but an edit keeps what the operator stored.
  useEffect(() => {
    if (!show || !target || isEdit) return;
    const seeded: Record<string, string> = {};
    for (const field of target.fields) {
      seeded[field.id] = REQUEST_TEMPLATE_SUGGESTIONS[field.id] ?? "";
    }
    setRequestRows(seeded);
  }, [show, target, isEdit]);

  function submit() {
    if (!target) return;
    const fieldTemplates = Object.fromEntries(
      Object.entries(requestRows).filter(([, template]) => template.trim())
    );
    const responseTemplates = Object.fromEntries(
      responseRows.filter(([key, template]) => key.trim() && template.trim())
    );
    onSubmit({
      eventType: ENRICHMENT_EVENT_TYPE,
      scopeKind: scopeKey.trim() ? ENRICHMENT_SCOPE_KIND : null,
      scopeKey: scopeKey.trim() || null,
      connectionId: target.connectionId,
      operationId: target.operationId,
      matchCondition: {},
      fieldTemplates,
      responseTemplates,
      enabled,
    });
  }

  const requestFieldIds = target
    ? target.fields.map((field) => field.id)
    : Object.keys(requestRows);

  return (
    <FormModal
      isOpen={show}
      onClose={onClose}
      size="3xl"
      title={
        isEdit
          ? tr("enrichment.editTitle", dict)
          : tr("enrichment.addTitle", dict)
      }
      subtitle={tr("enrichment.subtitle", dict)}
      submitLabel={
        loading ? tr("enrichment.saving", dict) : tr("enrichment.save", dict)
      }
      isProcessing={loading || !target}
      error={error}
      onSubmit={submit}
      showCancelButton
      cancelLabel={tr("enrichment.cancel", dict)}
    >
      <div className="flex flex-col gap-4">
        <SettingsFormField
          id="enrich-target"
          label={tr("enrichment.connection", dict)}
        >
          <Select
            id="enrich-target"
            value={targetKey}
            onChange={(event) => setTargetKey(event.target.value)}
          >
            <option value="">
              {tr("enrichment.connectionPlaceholder", dict)}
            </option>
            {targets.map((t) => (
              <option
                key={`${t.connectionId}:${t.operationId}`}
                value={`${t.connectionId}:${t.operationId}`}
              >
                {t.connectionName} · {t.operationName}
              </option>
            ))}
          </Select>
          {target && (
            <p className="mt-1 font-mono text-xs text-gray-500 dark:text-gray-400">
              {target.method} {target.path}
            </p>
          )}
        </SettingsFormField>

        <SettingsFormField
          id="enrich-scope"
          label={tr("enrichment.scope", dict)}
        >
          <TextInput
            id="enrich-scope"
            placeholder={tr("enrichment.scopePlaceholder", dict)}
            value={scopeKey}
            onChange={(event) => setScopeKey(event.target.value)}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {tr("enrichment.scopeHelp", dict)}
          </p>
        </SettingsFormField>

        {target && (
          <fieldset className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <legend className="px-1 text-sm font-medium text-gray-700 dark:text-gray-300">
              {tr("enrichment.requestMapping", dict)}
            </legend>
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
              {tr("enrichment.requestMappingHelp", dict)}
            </p>
            <div className="flex flex-col gap-2">
              {requestFieldIds.map((fieldId) => (
                <div
                  key={fieldId}
                  className="grid grid-cols-[200px_1fr] items-center gap-2"
                >
                  <code className="truncate text-xs text-gray-700 dark:text-gray-300">
                    {fieldId}
                  </code>
                  <TextInput
                    sizing="sm"
                    className="font-mono"
                    value={requestRows[fieldId] ?? ""}
                    onChange={(event) =>
                      setRequestRows((rows) => ({
                        ...rows,
                        [fieldId]: event.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <legend className="px-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            {tr("enrichment.responseMapping", dict)}
          </legend>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            {tr("enrichment.responseMappingHelp", dict)}
          </p>
          <div className="flex flex-col gap-2">
            {responseRows.map(([key, template], index) => (
              <div
                key={index}
                className="grid grid-cols-[200px_1fr] items-center gap-2"
              >
                <TextInput
                  sizing="sm"
                  className="font-mono"
                  value={key}
                  onChange={(event) =>
                    setResponseRows((rows) =>
                      rows.map((row, i) =>
                        i === index ? [event.target.value, row[1]] : row
                      )
                    )
                  }
                />
                <TextInput
                  sizing="sm"
                  className="font-mono"
                  value={template}
                  onChange={(event) =>
                    setResponseRows((rows) =>
                      rows.map((row, i) =>
                        i === index ? [row[0], event.target.value] : row
                      )
                    )
                  }
                />
              </div>
            ))}
          </div>
        </fieldset>

        <ToggleSwitch
          checked={enabled}
          label={tr("enrichment.enabled", dict)}
          onChange={setEnabled}
        />
      </div>
    </FormModal>
  );
}
