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
import { HiCheck, HiChevronDown, HiOutlineSearch, HiX } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { formatCount } from "./data-sharing";
import type { DataShareOrg } from "./platform.types";

interface OrgComboboxProps {
  readonly id: string;
  readonly orgs: readonly DataShareOrg[];
  readonly value: string;
  readonly onChange: (slug: string) => void;
  readonly placeholder: string;
  /** Why an organization cannot be picked here, or null when it can. */
  readonly blockedReason?: (org: DataShareOrg) => string | null;
  /** Shows a clear button, for filters. */
  readonly clearable?: boolean;
  readonly dict: I18nRecord;
  readonly lang: string;
}

const SHOWN = 50;

function searchText(org: DataShareOrg, dict: I18nRecord) {
  const roles = org.roles.map((r) => trDynamic(`roles.${r}`, dict));
  return [org.name, org.slug, ...roles].join(" ").toLowerCase();
}

/** A searchable organization picker: by name, identifier or role. */
export default function OrgCombobox({
  id,
  orgs,
  value,
  onChange,
  placeholder,
  blockedReason,
  clearable = false,
  dict,
  lang,
}: Readonly<OrgComboboxProps>) {
  const [query, setQuery] = useState("");
  const selected = orgs.find((o) => o.slug === value) ?? null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? orgs.filter((o) => searchText(o, dict).includes(q)) : orgs;
  }, [orgs, query, dict]);

  return (
    <Combobox
      value={selected}
      by="slug"
      onChange={(org: DataShareOrg | null) => onChange(org?.slug ?? "")}
      onClose={() => setQuery("")}
      immediate
    >
      <div className="relative">
        <HiOutlineSearch className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-gray-400" />
        <ComboboxInput
          id={id}
          placeholder={placeholder}
          displayValue={(org: DataShareOrg | null) => org?.name ?? ""}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2.5 pl-9 pr-14 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
        {clearable && selected && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={tr("picker.clear", dict)}
            className="absolute inset-y-0 right-8 flex items-center px-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <HiX className="h-4 w-4" />
          </button>
        )}
        <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
          <HiChevronDown className="h-4 w-4" />
        </ComboboxButton>
      </div>
      <ComboboxOptions
        anchor="bottom start"
        className="z-[60] w-[var(--input-width)] max-h-80 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg [--anchor-gap:4px] empty:invisible dark:border-gray-600 dark:bg-gray-700"
      >
        {matches.slice(0, SHOWN).map((org) => (
          <OrgOption
            key={org.slug}
            org={org}
            blocked={blockedReason?.(org) ?? null}
            dict={dict}
            lang={lang}
          />
        ))}
        <ListNote text={listNote(matches.length, dict)} />
      </ComboboxOptions>
    </Combobox>
  );
}

function listNote(count: number, dict: I18nRecord) {
  if (count === 0) return tr("picker.noOrgs", dict);
  if (count > SHOWN) {
    return tr("picker.refine", dict, { count: String(count - SHOWN) });
  }
  return null;
}

function ListNote({ text }: Readonly<{ text: string | null }>) {
  if (!text) return null;
  return (
    <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{text}</p>
  );
}

interface OrgOptionProps {
  readonly org: DataShareOrg;
  readonly blocked: string | null;
  readonly dict: I18nRecord;
  readonly lang: string;
}

function OrgOption({ org, blocked, dict, lang }: OrgOptionProps) {
  return (
    <ComboboxOption
      value={org}
      disabled={blocked !== null}
      className="group flex cursor-default items-center gap-3 px-3 py-2 data-[disabled]:cursor-not-allowed data-[focus]:bg-gray-100 data-[disabled]:opacity-50 dark:data-[focus]:bg-gray-600"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-gray-900 dark:text-white">
          {org.name}
        </span>
        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
          {blocked ??
            tr("picker.ownAssets", dict, {
              count: formatCount(org.assetCount, lang),
            })}
        </span>
      </span>
      <span className="flex shrink-0 gap-1">
        {org.roles.map((role) => (
          <Badge key={role} color="gray" size="xs">
            {trDynamic(`roles.${role}`, dict)}
          </Badge>
        ))}
      </span>
      <HiCheck className="invisible h-4 w-4 shrink-0 text-blue-600 group-data-[selected]:visible" />
    </ComboboxOption>
  );
}
