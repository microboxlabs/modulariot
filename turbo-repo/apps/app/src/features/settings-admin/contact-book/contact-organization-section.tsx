"use client";

import { useState, type KeyboardEvent } from "react";
import {
  HiCheck,
  HiOutlineOfficeBuilding,
  HiOutlineTruck,
  HiPlus,
  HiX,
} from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { displayId, guessCompanyIdType } from "./tax-id";
import { SECTION_INPUT_CLASS } from "./contact-person-section";
import type { CompanyOption } from "./store";
import { normalizeLabel } from "./taxonomy-store";
import { useCarrierCompanies } from "./use-carrier-companies";

/**
 * Organization picker under an outside contact's RUT — the company the
 * contact belongs to (the API's `company`). The search bar lists the companies already used in the
 * book and the organization's own carriers, filtered while typing; picking one with a RUT fills the
 * company's RUT too. When no name matches exactly, a "Crear" option sets the typed one, without RUT.
 */
export default function ContactOrganizationSection({
  value,
  onChange,
  organizations,
  d,
}: Readonly<{
  value: string;
  /** `rut` is set when the picked company has one. */
  onChange: (next: string, rut?: string) => void;
  organizations: readonly CompanyOption[];
  d: I18nRecord;
}>) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const key = normalizeLabel(query);
  const carriers = useCarrierCompanies(query);
  const options = mergeCompanies(organizations, carriers);
  const exact = options.find((o) => normalizeLabel(o.name) === key);
  const matches = key
    ? options.filter(
        (o) =>
          normalizeLabel(o.name).includes(key) ||
          (o.rut ?? "").includes(key.replaceAll(/[.\-\s]/g, "").toUpperCase())
      )
    : options;
  const selectedKey = normalizeLabel(value);

  const pick = (option: CompanyOption) => {
    onChange(option.name.trim(), option.rut);
    setQuery("");
    setOpen(false);
  };
  const create = (name: string) => pick({ name, source: "book" });

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      return;
    }
    if (e.key !== "Enter" || !key) return;
    e.preventDefault();
    if (exact) pick(exact);
    else create(query);
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
            {matches.map((option) => (
              <li key={`${option.source}:${option.name}`}>
                <button
                  type="button"
                  onClick={() => pick(option)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/50"
                >
                  {option.source === "carrier" ? (
                    <HiOutlineTruck
                      aria-label={tr("companyCarrier", d)}
                      className="h-4 w-4 shrink-0 text-gray-400"
                    />
                  ) : (
                    <HiOutlineOfficeBuilding className="h-4 w-4 shrink-0 text-gray-400" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{option.name}</span>
                  {option.rut && (
                    <span className="shrink-0 font-mono text-xs text-gray-400">
                      {displayId(guessCompanyIdType(option.rut), option.rut)}
                    </span>
                  )}
                  {normalizeLabel(option.name) === selectedKey && (
                    <HiCheck className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  )}
                </button>
              </li>
            ))}
            {key && !exact && (
              <li>
                <button
                  type="button"
                  onClick={() => create(query)}
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

/** The book's companies, then the carriers the book doesn't have yet; a name appears once. */
function mergeCompanies(
  book: readonly CompanyOption[],
  carriers: readonly CompanyOption[]
): CompanyOption[] {
  const seen = new Set(book.map((o) => normalizeLabel(o.name)));
  return [
    ...book,
    ...carriers.filter((c) => !seen.has(normalizeLabel(c.name))),
  ];
}
