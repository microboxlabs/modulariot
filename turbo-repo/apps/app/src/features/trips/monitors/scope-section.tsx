"use client";

import { useMemo, useState } from "react";
import { Button } from "flowbite-react";
import { HiX } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  ANY_TRIP,
  SCOPE_DIMENSIONS,
  useScopeCheck,
  type MonitorScope,
  type ScopeDimension,
  type ScopeOverlap,
  type ScopeValues,
} from "./monitors-api";

interface Option {
  value: string;
  label: string;
}

const MAX_SUGGESTIONS = 8;

/** The values each dimension can take, labelled. */
export function scopeOptions(
  values: ScopeValues | undefined
): Record<ScopeDimension, Option[]> {
  const places = (values?.locations ?? []).map((l) => ({
    value: l.id,
    label: l.code ? `${l.name} (${l.code})` : l.name,
  }));
  return {
    feeds: (values?.feeds ?? []).map((f) => ({ value: f.key, label: f.name })),
    orderTypes: (values?.orderTypes ?? []).map((t) => ({ value: t, label: t })),
    origins: places,
    destinations: places,
  };
}

function labelOf(options: Option[], value: string) {
  return options.find((o) => o.value === value)?.label ?? value;
}

/** "Feed: Exacta · Destino: ANF", "Todos los viajes" or "Sin alcance". */
export function scopeSummary(
  scope: MonitorScope | null,
  values: ScopeValues | undefined,
  d: I18nRecord
) {
  if (!scope) return tr("scope.none", d);
  const options = scopeOptions(values);
  const parts = SCOPE_DIMENSIONS.filter((dim) => scope[dim].length > 0).map(
    (dim) =>
      `${tr(`scope.${dim}`, d)}: ${scope[dim]
        .map((v) => labelOf(options[dim], v))
        .join(", ")}`
  );
  return parts.length === 0 ? tr("scope.allTrips", d) : parts.join(" · ");
}

function ValuesPicker({
  label,
  selected,
  options,
  readOnly,
  onChange,
  d,
}: Readonly<{
  label: string;
  selected: string[];
  options: Option[];
  readOnly: boolean;
  onChange: (values: string[]) => void;
  d: I18nRecord;
}>) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const needle = q.trim().toLowerCase();
  const suggestions = options
    .filter(
      (o) =>
        !selected.includes(o.value) &&
        (!needle ||
          o.label.toLowerCase().includes(needle) ||
          o.value.toLowerCase().includes(needle))
    )
    .slice(0, MAX_SUGGESTIONS);

  const add = (value: string) => {
    onChange([...selected, value]);
    setQ("");
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
        {label}
      </span>
      <div className="relative">
        <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-lg border border-gray-300 bg-gray-50 px-2 py-1 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-gray-600 dark:bg-gray-700">
          {selected.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/60 dark:text-blue-200"
            >
              {labelOf(options, v)}
              {!readOnly && (
                <button
                  type="button"
                  aria-label={tr("scope.remove", d, {
                    value: labelOf(options, v),
                  })}
                  onClick={() => onChange(selected.filter((s) => s !== v))}
                  className="text-blue-600 hover:text-blue-900 dark:text-blue-300 dark:hover:text-white"
                >
                  <HiX className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
          {readOnly ? (
            selected.length === 0 && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {tr("scope.any", d)}
              </span>
            )
          ) : (
            <input
              value={q}
              aria-label={label}
              placeholder={selected.length === 0 ? tr("scope.any", d) : ""}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && suggestions.length > 0) {
                  e.preventDefault();
                  add(suggestions[0].value);
                } else if (
                  e.key === "Backspace" &&
                  q === "" &&
                  selected.length > 0
                ) {
                  onChange(selected.slice(0, -1));
                }
              }}
              className="min-w-24 flex-1 border-0 bg-transparent p-0.5 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-0 dark:text-white dark:placeholder:text-gray-400"
            />
          )}
        </div>
        {open && !readOnly && (
          <ul
            role="listbox"
            className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
          >
            {suggestions.length === 0 ? (
              <li className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400">
                {tr("scope.noMatches", d)}
              </li>
            ) : (
              suggestions.map((o) => (
                <li key={o.value} role="option" aria-selected={false}>
                  <button
                    type="button"
                    // Keep the input focused so the list stays open for the next pick.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => add(o.value)}
                    className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    {o.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

const OVERLAP_STYLE: Record<ScopeOverlap["relation"], string> = {
  DUPLICATE:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300",
  NARROWER:
    "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300",
  BROADER:
    "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-300",
};

/** How the scope stands to each published monitor it meets. */
export function ScopeOverlaps({
  overlaps,
  d,
}: Readonly<{ overlaps: ScopeOverlap[]; d: I18nRecord }>) {
  if (overlaps.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {tr("scope.noOverlap", d)}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {overlaps.map((o) => (
        <li
          key={o.key}
          className={`rounded-md border px-3 py-2 text-sm ${OVERLAP_STYLE[o.relation]}`}
        >
          {tr(`scope.relation.${o.relation}`, d, { name: o.name })}
        </li>
      ))}
    </ul>
  );
}

/**
 * The monitor's scope: the values each dimension accepts, empty for any. A
 * scope that duplicates another published monitor's is marked and cannot be
 * published.
 */
export default function ScopeEditor({
  monitorKey,
  scope,
  values,
  readOnly,
  onChange,
  d,
}: Readonly<{
  monitorKey: string;
  scope: MonitorScope | null;
  values: ScopeValues | undefined;
  readOnly: boolean;
  onChange: (scope: MonitorScope) => void;
  d: I18nRecord;
}>) {
  const options = useMemo(() => scopeOptions(values), [values]);
  const { data: check, error: checkError } = useScopeCheck(monitorKey, scope);
  const shown = scope ?? ANY_TRIP;

  return (
    <div className="flex flex-col gap-3">
      {!scope && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:border-yellow-500/40 dark:bg-yellow-500/10 dark:text-yellow-300">
          <span>{tr("scope.unset", d)}</span>
          {!readOnly && (
            <Button color="light" size="xs" onClick={() => onChange(ANY_TRIP)}>
              {tr("scope.applyAll", d)}
            </Button>
          )}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {SCOPE_DIMENSIONS.map((dim) => (
          <ValuesPicker
            key={dim}
            label={tr(`scope.${dim}`, d)}
            selected={shown[dim]}
            options={options[dim]}
            readOnly={readOnly}
            onChange={(next) => onChange({ ...shown, [dim]: next })}
            d={d}
          />
        ))}
      </div>
      {scope && checkError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
          {tr("scope.checkFailed", d)}
        </p>
      )}
      {scope && check && !checkError && (
        <ScopeOverlaps overlaps={check.overlaps} d={d} />
      )}
    </div>
  );
}
