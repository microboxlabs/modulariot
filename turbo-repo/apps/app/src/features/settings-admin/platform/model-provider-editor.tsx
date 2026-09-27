"use client";

import { useState } from "react";
import { Button, Checkbox, Label, Select, TextInput } from "flowbite-react";
import { HiPlus, HiX } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  draftFrom,
  emptyModel,
  toRequest,
  withDefault,
  type ModelDraft,
  type ProviderDraftError,
} from "./model-provider-form";
import {
  MODEL_PROVIDERS,
  type ModelProviderAdmin,
  type SetModelProvider,
} from "./platform.types";

interface ModelProviderEditorProps {
  readonly dict: I18nRecord;
  /** Undefined adds a provider. */
  readonly existing?: ModelProviderAdmin;
  /** Providers already configured, left out of the choice when adding. */
  readonly taken: readonly string[];
  readonly onSave: (
    provider: string,
    value: SetModelProvider
  ) => Promise<boolean>;
  readonly onCancel: () => void;
}

/** Adds a model provider, or edits one: key, base URL and priced models. */
export default function ModelProviderEditor({
  dict,
  existing,
  taken,
  onSave,
  onCancel,
}: ModelProviderEditorProps) {
  const isNew = existing === undefined;
  const [draft, setDraft] = useState(() => draftFrom(existing));
  const [problem, setProblem] = useState<ProviderDraftError | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const choices = MODEL_PROVIDERS.filter((p) => !taken.includes(p));

  const setModel = (index: number, patch: Partial<ModelDraft>) =>
    setDraft((d) => ({
      ...d,
      models: d.models.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    }));

  const submit = async () => {
    const result = toRequest(draft, isNew);
    if (!result.ok) {
      setProblem(result.error);
      return;
    }
    setProblem(null);
    setIsSaving(true);
    try {
      await onSave(draft.provider, result.value);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-blue-200 bg-white p-4 dark:border-blue-800 dark:bg-gray-800">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
        {isNew
          ? tr("editor.addTitle", dict)
          : tr("editor.editTitle", dict, { provider: draft.provider })}
      </h3>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        {isNew && (
          <div>
            <Label htmlFor="model-provider-name">
              {tr("editor.provider", dict)}
            </Label>
            <Select
              id="model-provider-name"
              value={draft.provider}
              onChange={(e) =>
                setDraft((d) => ({ ...d, provider: e.target.value }))
              }
            >
              <option value="">{tr("editor.providerPlaceholder", dict)}</option>
              {choices.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <Label htmlFor="model-provider-key">
            {tr("editor.apiKey", dict)}
          </Label>
          <TextInput
            id="model-provider-key"
            type="password"
            autoComplete="off"
            value={draft.apiKey}
            placeholder={
              isNew
                ? ""
                : tr("editor.apiKeyKeep", dict, {
                    preview: existing.keyPreview,
                  })
            }
            onChange={(e) =>
              setDraft((d) => ({ ...d, apiKey: e.target.value }))
            }
          />
        </div>
        <div>
          <Label htmlFor="model-provider-url">
            {tr("editor.baseUrl", dict)}
          </Label>
          <TextInput
            id="model-provider-url"
            value={draft.baseUrl}
            placeholder={tr("editor.baseUrlPlaceholder", dict)}
            onChange={(e) =>
              setDraft((d) => ({ ...d, baseUrl: e.target.value }))
            }
          />
        </div>
        <div className="flex items-center gap-2 self-end pb-2">
          <Checkbox
            id="model-provider-enabled"
            checked={draft.enabled}
            onChange={(e) =>
              setDraft((d) => ({ ...d, enabled: e.target.checked }))
            }
          />
          <Label htmlFor="model-provider-enabled">
            {tr("editor.enabled", dict)}
          </Label>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {tr("editor.models", dict)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {tr("editor.modelsHelp", dict)}
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {draft.models.map((model, index) => (
            <div
              key={model.rowKey}
              className="grid grid-cols-[1fr_7rem_7rem_auto_auto] items-center gap-2"
            >
              <TextInput
                sizing="sm"
                value={model.id}
                aria-label={tr("editor.modelId", dict)}
                placeholder={tr("editor.modelId", dict)}
                onChange={(e) => setModel(index, { id: e.target.value })}
              />
              <TextInput
                sizing="sm"
                inputMode="decimal"
                value={model.inputPerMtok}
                aria-label={tr("editor.inputPrice", dict)}
                placeholder={tr("editor.inputPrice", dict)}
                onChange={(e) =>
                  setModel(index, { inputPerMtok: e.target.value })
                }
              />
              <TextInput
                sizing="sm"
                inputMode="decimal"
                value={model.outputPerMtok}
                aria-label={tr("editor.outputPrice", dict)}
                placeholder={tr("editor.outputPrice", dict)}
                onChange={(e) =>
                  setModel(index, { outputPerMtok: e.target.value })
                }
              />
              <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                <Checkbox
                  checked={model.isDefault}
                  onChange={() =>
                    setDraft((d) => ({
                      ...d,
                      models: withDefault(d.models, index),
                    }))
                  }
                />
                {tr("editor.default", dict)}
              </label>
              <Button
                size="xs"
                color="light"
                aria-label={tr("editor.removeModel", dict)}
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    models: d.models.filter((_, i) => i !== index),
                  }))
                }
              >
                <HiX className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          size="xs"
          color="light"
          className="mt-2"
          onClick={() =>
            setDraft((d) => ({ ...d, models: [...d.models, emptyModel()] }))
          }
        >
          <HiPlus className="mr-1 h-3.5 w-3.5" />
          {tr("editor.addModel", dict)}
        </Button>
      </div>

      {problem && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {trDynamic(`errors.${problem}`, dict)}
        </p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <Button size="sm" color="light" disabled={isSaving} onClick={onCancel}>
          {tr("editor.cancel", dict)}
        </Button>
        <Button
          size="sm"
          color="blue"
          disabled={isSaving}
          onClick={() => void submit()}
        >
          {isSaving ? tr("editor.saving", dict) : tr("editor.save", dict)}
        </Button>
      </div>
    </div>
  );
}
