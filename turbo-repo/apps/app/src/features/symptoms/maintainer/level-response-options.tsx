"use client";

import { ToggleSwitch } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { LevelResponse } from "./maintainer-api";

const inputClass =
  "w-48 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white";

/** Escalation, consequence management and whether the operator may ignore the case. */
export default function LevelResponseOptions({
  response,
  readOnly,
  d,
  onChange,
}: Readonly<{
  response: LevelResponse;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (patch: Partial<LevelResponse>) => void;
}>) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-600 dark:text-gray-300">
      {response.operator && (
        <label className="flex items-center gap-2">
          <span>{tr("escalateTo", d)}</span>
          <input
            className={inputClass}
            disabled={readOnly}
            maxLength={120}
            placeholder={tr("escalateToPlaceholder", d)}
            value={response.escalateTo ?? ""}
            onChange={(e) =>
              onChange({
                escalateTo: e.target.value.trim() ? e.target.value : null,
              })
            }
          />
        </label>
      )}
      <ToggleSwitch
        checked={response.ignorable}
        disabled={readOnly}
        label={tr("ignorable", d)}
        onChange={(ignorable) => onChange({ ignorable })}
      />
      <ToggleSwitch
        checked={response.consequence ?? false}
        disabled={readOnly}
        label={tr("consequence", d)}
        onChange={(consequence) => onChange({ consequence })}
      />
    </div>
  );
}
