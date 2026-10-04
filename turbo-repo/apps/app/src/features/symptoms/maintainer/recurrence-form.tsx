"use client";

import { ToggleSwitch } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { SymptomSpec } from "./maintainer-api";

type Recurrence = NonNullable<SymptomSpec["recurrence"]>;

export const RECURRENCE_ENTITIES = [
  { key: "patente", label: "entityVehicle" },
  { key: "conductor", label: "entityDriver" },
];

/** What a symptom without a recurrence starts from when it is turned on. */
export const DEFAULT_RECURRENCE: Recurrence = {
  enabled: true,
  count: 3,
  days: 7,
  raiseLevels: 1,
  entity: "patente",
};

const inputClass =
  "w-16 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white";

/** A whole number from an input, or 0 when it is empty or not a number. */
export function wholeNumber(value: string): number {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? 0 : n;
}

/** Turning the recurrence off keeps its numbers, so turning it back on restores them. */
export function toggleRecurrence(
  current: SymptomSpec["recurrence"],
  enabled: boolean
): Recurrence {
  return { ...(current ?? DEFAULT_RECURRENCE), enabled };
}

function NumberInput({
  value,
  label,
  min,
  readOnly,
  onChange,
}: Readonly<{
  value: number;
  label: string;
  min: number;
  readOnly: boolean;
  onChange: (value: number) => void;
}>) {
  return (
    <input
      type="number"
      min={min}
      step={1}
      aria-label={label}
      className={inputClass}
      disabled={readOnly}
      value={value}
      onChange={(e) => onChange(wholeNumber(e.target.value))}
    />
  );
}

/** "Si la misma patente tiene N casos en D días, sube L nivel(es)." */
export default function RecurrenceForm({
  recurrence,
  readOnly,
  d,
  onChange,
}: Readonly<{
  recurrence: SymptomSpec["recurrence"];
  readOnly: boolean;
  d: I18nRecord;
  onChange: (recurrence: Recurrence) => void;
}>) {
  const enabled = recurrence?.enabled ?? false;
  const r = recurrence ?? { ...DEFAULT_RECURRENCE, enabled: false };
  const set = (patch: Partial<Recurrence>) => onChange({ ...r, ...patch });
  return (
    <div className="flex flex-col gap-3">
      <ToggleSwitch
        checked={enabled}
        disabled={readOnly}
        label={tr("recurrenceOn", d)}
        onChange={(on) => onChange(toggleRecurrence(recurrence, on))}
      />
      {enabled && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <span>{tr("recurrenceIfSame", d)}</span>
          <select
            aria-label={tr("recurrenceEntity", d)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            disabled={readOnly}
            value={r.entity ?? "patente"}
            onChange={(e) => set({ entity: e.target.value })}
          >
            {RECURRENCE_ENTITIES.map((e) => (
              <option key={e.key} value={e.key}>
                {trDynamic(e.label, d)}
              </option>
            ))}
          </select>
          <span>{tr("recurrenceHas", d)}</span>
          <NumberInput
            value={r.count}
            min={2}
            label={tr("recurrenceCount", d)}
            readOnly={readOnly}
            onChange={(count) => set({ count })}
          />
          <span>{tr("recurrenceCasesIn", d)}</span>
          <NumberInput
            value={r.days}
            min={1}
            label={tr("recurrenceDays", d)}
            readOnly={readOnly}
            onChange={(days) => set({ days })}
          />
          <span>{tr("recurrenceDaysRaise", d)}</span>
          <NumberInput
            value={r.raiseLevels}
            min={1}
            label={tr("recurrenceRaise", d)}
            readOnly={readOnly}
            onChange={(raiseLevels) => set({ raiseLevels })}
          />
          <span>{tr("recurrenceLevels", d)}</span>
        </div>
      )}
    </div>
  );
}
