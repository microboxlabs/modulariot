"use client";

import { useState } from "react";
import { Button } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { TagsStep } from "../dashboard-setup/tags-step";

interface SettingsTagsFormProps {
  tags: readonly string[];
  /** Saves the tags with the dashboard. */
  onSave: (tags: string[]) => void;
  dictionary: I18nRecord;
}

/** The dashboard's tags, in its settings: the new dashboard's tags step. */
export function SettingsTagsForm({
  tags,
  onSave,
  dictionary,
}: Readonly<SettingsTagsFormProps>) {
  const [draft, setDraft] = useState<string[]>(() => [...tags]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(tags);
  return (
    <div className="flex flex-col gap-4 p-4">
      <TagsStep
        tags={draft}
        onChange={setDraft}
        t={(key, params) =>
          trDynamic(`dashboard.setup.tags.${key}`, dictionary, params)
        }
      />
      <Button
        type="button"
        size="sm"
        disabled={!dirty}
        onClick={() => onSave(draft)}
        className="self-end"
      >
        {tr("dashboard.explorer.tagsDialog.save", dictionary)}
      </Button>
    </div>
  );
}
