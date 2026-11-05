"use client";

import { useMemo, useState } from "react";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { Badge } from "flowbite-react";
import { HiCheck, HiChevronDown, HiX } from "react-icons/hi";
import { formatCount, type Facet } from "./data-sharing";

interface FacetComboboxProps {
  readonly id: string;
  readonly facets: readonly Facet[];
  readonly value: readonly string[];
  readonly onChange: (values: string[]) => void;
  readonly placeholder: string;
  /** Label for the empty value, e.g. assets whose signal sends no owner. */
  readonly emptyLabel: string;
  readonly noResults: string;
  readonly lang: string;
}

/** Several values of one asset attribute, with how many assets carry each. */
export default function FacetCombobox({
  id,
  facets,
  value,
  onChange,
  placeholder,
  emptyLabel,
  noResults,
  lang,
}: Readonly<FacetComboboxProps>) {
  const [query, setQuery] = useState("");
  const label = (v: string) => v || emptyLabel;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? facets.filter((f) => label(f.value).toLowerCase().includes(q))
      : facets;
    // `label` only depends on `emptyLabel`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facets, query, emptyLabel]);

  return (
    <Combobox
      value={[...value]}
      onChange={(picked: string[]) => {
        onChange(picked);
        setQuery("");
      }}
      onClose={() => setQuery("")}
      multiple
      immediate
    >
      <div className="relative flex min-h-[42px] w-full flex-wrap items-center gap-1 rounded-lg border border-gray-300 bg-gray-50 py-1 pl-1.5 pr-8 text-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-gray-600 dark:bg-gray-700">
        {value.map((v) => (
          <Badge key={v || "_empty"} color="blue" className="w-fit">
            <span className="flex items-center gap-1">
              {label(v)}
              <button
                type="button"
                aria-label={label(v)}
                onClick={() => onChange(value.filter((x) => x !== v))}
                className="rounded-sm opacity-70 hover:opacity-100"
              >
                <HiX className="h-3 w-3" />
              </button>
            </span>
          </Badge>
        ))}
        <ComboboxInput
          id={id}
          placeholder={value.length ? "" : placeholder}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-24 flex-1 border-0 bg-transparent p-1 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 dark:text-white"
        />
        <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400">
          <HiChevronDown className="h-4 w-4" />
        </ComboboxButton>
      </div>
      <ComboboxOptions
        anchor="bottom start"
        className="z-[60] w-[var(--input-width)] min-w-64 max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg [--anchor-gap:4px] empty:invisible dark:border-gray-600 dark:bg-gray-700"
      >
        {matches.map((f) => (
          <ComboboxOption
            key={f.value || "_empty"}
            value={f.value}
            className="group flex cursor-default items-center gap-2 px-3 py-2 text-gray-900 data-[focus]:bg-gray-100 dark:text-white dark:data-[focus]:bg-gray-600"
          >
            <HiCheck className="invisible h-4 w-4 shrink-0 text-blue-600 group-data-[selected]:visible" />
            <span className="min-w-0 flex-1 truncate">{label(f.value)}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatCount(f.count, lang)}
            </span>
          </ComboboxOption>
        ))}
        {matches.length === 0 && (
          <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
            {noResults}
          </p>
        )}
      </ComboboxOptions>
    </Combobox>
  );
}
