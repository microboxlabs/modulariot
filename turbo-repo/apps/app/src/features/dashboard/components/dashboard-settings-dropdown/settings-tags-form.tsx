"use client";

import { useState } from "react";
import { Button } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { TagsStep } from "../dashboard-setup/tags-step";

interface SettingsTagsFormProps {
  state: ReturnType<typeof useSettingsTagsForm>;
  dictionary: I18nRecord;
}

/** Held by the dropdown so changing sections or closing it preserves pending edits. */
export function useSettingsTagsForm(
  tags: readonly string[],
  onSave: (tags: string[]) => Promise<boolean>
) {
  const [draft, setDraft] = useState<string[] | null>(null);
  const draftTags = draft ?? [...tags];
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const dirty = JSON.stringify(draftTags) !== JSON.stringify(tags);
  const save = async () => {
    setSaving(true);
    const saved = await onSave(draftTags);
    setSaving(false);
    setSaveFailed(!saved);
    if (saved) setDraft(null);
  };
  return {
    draftTags,
    saving,
    saveFailed,
    dirty,
    save,
    change: (next: string[]) =>
      setDraft(JSON.stringify(next) === JSON.stringify(tags) ? null : next),
  };
}

/** The dashboard's tags, in its settings: the new dashboard's tags step. */
export function SettingsTagsForm({
  state,
  dictionary,
}: Readonly<SettingsTagsFormProps>) {
  const { draftTags, saving, saveFailed, dirty, save, change } = state;
  return (
    <fieldset disabled={saving} className="flex min-w-0 flex-col gap-4 p-4">
      <TagsStep
        tags={draftTags}
        onChange={change}
        t={(key, params) =>
          trDynamic(`dashboard.setup.tags.${key}`, dictionary, params)
        }
      />
      <Button
        type="button"
        size="sm"
        disabled={saving || (!dirty && !saveFailed)}
        onClick={() => void save()}
        className="self-end"
      >
        {tr("dashboard.explorer.tagsDialog.save", dictionary)}
      </Button>
      {saveFailed && (
        <p role="alert" className="text-sm text-red-600">
          {tr("dashboard.server.saveError", dictionary)}
        </p>
      )}
    </fieldset>
  );
}
