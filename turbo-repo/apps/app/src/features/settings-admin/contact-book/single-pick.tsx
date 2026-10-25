"use client";

import { useState, type ComponentType, type KeyboardEvent } from "react";
import { Spinner } from "flowbite-react";
import { HiCheck, HiPlus, HiX } from "react-icons/hi";
import { SECTION_INPUT_CLASS } from "./contact-person-section";
import { normalizeLabel } from "./taxonomy-store";

type Icon = ComponentType<{ className?: string; "aria-label"?: string }>;

export interface PickOption {
  label: string;
  /** Shown at the right, such as a RUT; also searched. */
  hint?: string;
  icon?: Icon;
  iconLabel?: string;
}

export interface SinglePickTexts {
  label: string;
  placeholder: string;
  remove: string;
  create: (name: string) => string;
  empty: string;
  searching?: string;
}

/**
 * One value picked from a list or created: the picked value as a chip with ×, and a search bar that filters the
 * options while typing. When no label matches exactly, a "Crear" option sets the typed text; it waits while
 * `searching`, so an option still on its way is not created twice.
 */
export default function SinglePick<T extends PickOption>({
  value,
  icon: ValueIcon,
  options,
  query,
  onQuery,
  searching = false,
  onPick,
  onCreate,
  onClear,
  texts,
}: Readonly<{
  value: string;
  icon: Icon;
  options: readonly T[];
  query: string;
  onQuery: (query: string) => void;
  searching?: boolean;
  onPick: (option: T) => void;
  onCreate: (label: string) => void;
  onClear: () => void;
  texts: SinglePickTexts;
}>) {
  const [open, setOpen] = useState(false);
  const key = normalizeLabel(query);
  const compact = key.replaceAll(/[.\-\s]/g, "").toUpperCase();
  const exact = options.find((o) => normalizeLabel(o.label) === key);
  const matches = key
    ? options.filter(
        (o) =>
          normalizeLabel(o.label).includes(key) ||
          (o.hint ?? "").replaceAll(/[.\-\s]/g, "").includes(compact)
      )
    : options;
  const selectedKey = normalizeLabel(value);

  const done = () => {
    onQuery("");
    setOpen(false);
  };
  const pick = (option: T) => {
    onPick(option);
    done();
  };
  const create = () => {
    onCreate(query.trim());
    done();
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
    if (exact) pick(exact);
    else if (!searching) create();
  };

  const showList = open && (matches.length > 0 || Boolean(key));

  return (
    <div className="flex flex-col gap-2">
      {value && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/60 px-2.5 py-1.5 dark:border-blue-500/40 dark:bg-blue-500/10">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
            <ValueIcon className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-white">
            {value}
          </span>
          <button
            type="button"
            aria-label={texts.remove}
            onClick={onClear}
            className="rounded p-1 text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200"
          >
            <HiX className="h-4 w-4" />
          </button>
        </div>
      )}
      <div
        className="relative"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null))
            setOpen(false);
        }}
      >
        <input
          className={SECTION_INPUT_CLASS}
          aria-label={texts.label}
          placeholder={texts.placeholder}
          value={query}
          onChange={(e) => {
            onQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {showList && (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
            {matches.map((option) => {
              const OptionIcon = option.icon ?? ValueIcon;
              return (
                <li key={`${option.iconLabel ?? ""}:${option.label}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(option)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/50"
                  >
                    <OptionIcon
                      aria-label={option.iconLabel}
                      className="h-4 w-4 shrink-0 text-gray-400"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {option.label}
                    </span>
                    {option.hint && (
                      <span className="shrink-0 font-mono text-xs text-gray-400">
                        {option.hint}
                      </span>
                    )}
                    {normalizeLabel(option.label) === selectedKey && (
                      <HiCheck className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                    )}
                  </button>
                </li>
              );
            })}
            {searching && (
              <li className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                <Spinner size="xs" />
                {texts.searching}
              </li>
            )}
            {key && !exact && !searching && (
              <li>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={create}
                  className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
                >
                  <HiPlus className="h-4 w-4 shrink-0" />
                  <span className="truncate">{texts.create(query.trim())}</span>
                </button>
              </li>
            )}
          </ul>
        )}
        {open && !key && matches.length === 0 && (
          <p className="mt-1 px-1 text-xs text-gray-400 dark:text-gray-500">
            {texts.empty}
          </p>
        )}
      </div>
    </div>
  );
}
