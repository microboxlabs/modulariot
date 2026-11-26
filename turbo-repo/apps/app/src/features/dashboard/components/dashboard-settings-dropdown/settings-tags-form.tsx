"use client";

import { useState } from "react";
import { Button } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { TagsStep } from "../dashboard-setup/tags-step";

interface SettingsTagsFormProps {
  tags: readonly string[];
  /** Saves the tags with the dashboard. */
  onSave: (tags: string[]) => Promise<boolean>;
  dictionary: I18nRecord;
}

/** The dashboard's tags, in its settings: the new dashboard's tags step. */
export function SettingsTagsForm({
  tags,
  onSave,
  dictionary,
}: Readonly<SettingsTagsFormProps>) {
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
  return (
    <fieldset disabled={saving} className="flex min-w-0 flex-col gap-4 p-4">
      <TagsStep
        tags={draftTags}
        onChange={(next) =>
          setDraft(JSON.stringify(next) === JSON.stringify(tags) ? null : next)
        }
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
