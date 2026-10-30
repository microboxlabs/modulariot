"use client";

import { useMemo, useState } from "react";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { HiCheck, HiChevronDown, HiOutlineSearch } from "react-icons/hi";
import {
  filterOrgs,
  type SwitcherOrg,
} from "@/features/layout/components/secured-navbar/org-switcher/org-switcher-list";

const SHOWN = 50;

interface OrgSearchPickerProps {
  readonly id: string;
  readonly orgs: readonly SwitcherOrg[];
  readonly value: string;
  readonly onChange: (slug: string) => void;
  readonly placeholder: string;
  /** Why an organization cannot be picked, or null when it can. */
  readonly blockedReason?: (org: SwitcherOrg) => string | null;
  /** Shown when nothing matches, and when more than 50 do. */
  readonly noMatches: string;
  readonly refine: (hidden: number) => string;
}

/**
 * An organization picker that searches like the header's switcher: every word
 * of the query against the name, identifier and tax id, accents ignored.
 */
export default function OrgSearchPicker({
  id,
  orgs,
  value,
  onChange,
  placeholder,
  blockedReason,
  noMatches,
  refine,
}: OrgSearchPickerProps) {
  const [query, setQuery] = useState("");
  const selected = orgs.find((o) => o.slug === value) ?? null;
  const matches = useMemo(() => filterOrgs(orgs, query), [orgs, query]);

  let note: string | null = null;
  if (matches.length === 0) note = noMatches;
  else if (matches.length > SHOWN) note = refine(matches.length - SHOWN);

  return (
    <Combobox
      value={selected}
      by="slug"
      onChange={(org: SwitcherOrg | null) => onChange(org?.slug ?? "")}
      onClose={() => setQuery("")}
      immediate
    >
      <div className="relative">
        <HiOutlineSearch className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-gray-400" />
        <ComboboxInput
          id={id}
          placeholder={placeholder}
          autoComplete="off"
          displayValue={(org: SwitcherOrg | null) => org?.displayName ?? ""}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2.5 pl-9 pr-10 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
        <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
          <HiChevronDown className="h-4 w-4" />
        </ComboboxButton>
      </div>
      <ComboboxOptions
        anchor="bottom start"
        className="z-[60] max-h-80 w-[var(--input-width)] overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg [--anchor-gap:4px] empty:invisible dark:border-gray-600 dark:bg-gray-700"
      >
        {matches.slice(0, SHOWN).map((org) => {
          const blocked = blockedReason?.(org) ?? null;
          return (
            <ComboboxOption
              key={org.slug}
              value={org}
              disabled={blocked !== null}
              className="group flex cursor-default items-center gap-3 px-3 py-2 data-[disabled]:cursor-not-allowed data-[focus]:bg-gray-100 data-[disabled]:opacity-50 dark:data-[focus]:bg-gray-600"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-gray-900 dark:text-white">
                  {org.displayName}
                </span>
                <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                  {blocked ?? [org.slug, org.taxId].filter(Boolean).join(" · ")}
                </span>
              </span>
              <HiCheck className="invisible h-4 w-4 shrink-0 text-blue-600 group-data-[selected]:visible" />
            </ComboboxOption>
          );
        })}
        {note && (
          <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
            {note}
          </p>
        )}
      </ComboboxOptions>
    </Combobox>
  );
}
