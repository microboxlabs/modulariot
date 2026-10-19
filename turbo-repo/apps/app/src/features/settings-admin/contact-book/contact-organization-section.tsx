"use client";

import { useState, type KeyboardEvent } from "react";
import { HiCheck, HiOutlineOfficeBuilding, HiPlus, HiX } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { SECTION_INPUT_CLASS } from "./contact-person-section";
import { normalizeLabel } from "./taxonomy-store";

/**
 * Organization picker under an outside contact's RUT — the company the
 * contact belongs to (the API's `company`). The search bar lists the organizations already used in the
 * book, filtered while typing; when no name matches exactly, a "Crear"
 * option sets the typed one. A contact belongs to at most one organization.
 */
export default function ContactOrganizationSection({
  value,
  onChange,
  organizations,
  d,
}: Readonly<{
  value: string;
  onChange: (next: string) => void;
  organizations: readonly string[];
  d: I18nRecord;
}>) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const key = normalizeLabel(query);
  const exact = organizations.find((o) => normalizeLabel(o) === key);
  const matches = key
    ? organizations.filter((o) => normalizeLabel(o).includes(key))
    : organizations;
  const selectedKey = normalizeLabel(value);

  const pick = (name: string) => {
    onChange(name.trim());
    setQuery("");
    setOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      return;
    }
    if (e.key !== "Enter" || !key) return;
    e.preventDefault();
    pick(exact ?? query);
  };

  const showList = open && (matches.length > 0 || Boolean(key));

  return (
    <div className="flex flex-col gap-2">
      {value && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/60 px-2.5 py-1.5 dark:border-blue-500/40 dark:bg-blue-500/10">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
            <HiOutlineOfficeBuilding className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-white">
            {value}
          </span>
          <button
            type="button"
            aria-label={tr("companyRemove", d)}
            onClick={() => onChange("")}
            className="rounded p-1 text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200"
          >
            <HiX className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="relative">
        <input
          className={SECTION_INPUT_CLASS}
          aria-label={tr("companyLabel", d)}
          placeholder={tr("companyInputPlaceholder", d)}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
        />
        {showList && (
          // Buttons keep the input focused on mousedown so the click lands.
          <ul
            onMouseDown={(e) => e.preventDefault()}
            className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800"
          >
            {matches.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => pick(name)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/50"
                >
                  <HiOutlineOfficeBuilding className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  {normalizeLabel(name) === selectedKey && (
                    <HiCheck className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  )}
                </button>
              </li>
            ))}
            {key && !exact && (
              <li>
                <button
                  type="button"
                  onClick={() => pick(query)}
                  className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
                >
                  <HiPlus className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {tr("companyCreate", d, { name: query.trim() })}
                  </span>
                </button>
              </li>
            )}
          </ul>
        )}
        {open && !key && matches.length === 0 && (
          <p className="mt-1 px-1 text-xs text-gray-400 dark:text-gray-500">
            {tr("companyEmpty", d)}
          </p>
        )}
      </div>
    </div>
  );
}
