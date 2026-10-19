"use client";

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { DataSource } from "./maintainer-api";

const KIND_LABEL: Record<DataSource["kind"], string> = {
  SIGNAL: "sourceKindSignal",
  EVENT: "sourceKindEvent",
  CHECK: "sourceKindCheck",
  TRIP_EVENT: "sourceKindTripEvent",
  WEBHOOK: "sourceKindWebhook",
};

/** Fuente: the source the rules read, and a ? that opens what it is. */
export function SourceSelect({
  value,
  sources,
  readOnly,
  helpOpen,
  d,
  onChange,
  onToggleHelp,
}: Readonly<{
  value: string | null;
  sources: DataSource[];
  readOnly: boolean;
  helpOpen: boolean;
  d: I18nRecord;
  onChange: (key: string) => void;
  onToggleHelp: () => void;
}>) {
  const known = sources.some((s) => s.key === value);
  return (
    <span className="flex items-center gap-2 text-xs text-gray-500">
      <label className="flex items-center gap-1">
        <span>{tr("sourceLabel", d)}</span>
        <select
          className="rounded-md border border-gray-300 bg-white px-1.5 py-0.5 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          disabled={readOnly}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          {!known && <option value={value ?? ""}>{value ?? "—"}</option>}
          {sources.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        aria-expanded={helpOpen}
        aria-label={tr("sourceHelp", d)}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-[10px] dark:border-gray-600"
        onClick={onToggleHelp}
      >
        ?
      </button>
    </span>
  );
}

/** What the source is: name, kind, cadence, and how sources work. */
export function SourceHelp({
  source,
  d,
}: Readonly<{ source: DataSource | undefined; d: I18nRecord }>) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-900/50">
      {source && (
        <p>
          <b>{source.name}</b> · {trDynamic(KIND_LABEL[source.kind], d)}
          {source.cadence ? ` · ${source.cadence}` : ""}
        </p>
      )}
      <p className="mt-0.5 text-gray-500">{tr("sourceHelpText", d)}</p>
    </div>
  );
}
