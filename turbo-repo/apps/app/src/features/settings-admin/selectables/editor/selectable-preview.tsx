"use client";

import { useState } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import SelectableField from "../field/selectable-field";
import { pickText } from "../localized";
import type { Selectable } from "../types";
import { toSelectable, type Draft } from "./editor-draft";

interface SelectablePreviewProps {
  readonly draft: Draft;
  /** The `selectables` dictionary section. */
  readonly dict: I18nRecord;
  readonly lang: string;
  readonly parentList?: Selectable;
}

/**
 * The field as a form would show it, built from the unsaved draft. A list that
 * depends on another shows that one first, to pick the parent value from. A
 * dynamic list can only be tried once saved, since its options come from the API.
 */
export function SelectablePreview({
  draft,
  dict,
  lang,
  parentList,
}: SelectablePreviewProps) {
  const [value, setValue] = useState<string[]>([]);
  const [parentValue, setParentValue] = useState<string[]>([]);
  const d = dict?.editor as I18nRecord;
  const fieldDict = dict?.field as I18nRecord;
  const list = toSelectable(draft);
  const canTry = list.source.kind === "STATIC" || !draft.isNew;

  return (
    <section className="mt-2 rounded-lg border border-dashed border-gray-300 p-4 dark:border-gray-600">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {tr("previewTitle", d)}
      </h3>
      {canTry ? (
        <div className="flex flex-col gap-3">
          {parentList && (
            <SelectableField
              list={parentList}
              value={parentValue}
              onChange={setParentValue}
              lang={lang}
              dict={fieldDict}
            />
          )}
          <SelectableField
            list={list}
            value={value}
            onChange={setValue}
            lang={lang}
            dict={fieldDict}
            parentValues={parentList ? parentValue : undefined}
            parentName={pickText(parentList?.name, lang)}
          />
        </div>
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {tr("previewAfterSave", d)}
        </p>
      )}
    </section>
  );
}
