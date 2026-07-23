"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { TextInput } from "flowbite-react";
import { HiCheck, HiChevronDown, HiPlus } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { matchEnvironment, normalizeEnvironment } from "../credential.types";
import { environmentLabel } from "./credential-badges";

interface EnvironmentSelectProps {
  readonly id: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Known environments — seeded ones plus any already in use. */
  readonly options: readonly string[];
  readonly invalid?: boolean;
  readonly dict: I18nRecord;
}

/**
 * Editable select for the environment: pick an existing one, or type a label
 * that doesn't exist yet and create it inline.
 *
 * Environments are open-ended (staging, sandbox, per-customer stacks), so a
 * closed dropdown would force people to misfile credentials. Matching is
 * case-insensitive, so typing "qa" reuses "QA" rather than creating a twin.
 */
export function EnvironmentSelect({
  id,
  value,
  onChange,
  options,
  invalid = false,
  dict,
}: EnvironmentSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // While closed the input shows the selection; while open it shows what is
  // being typed, so the list can filter without destroying the current value.
  const inputValue = open ? query : environmentLabel(value, dict);

  const matches = useMemo(() => {
    const needle = normalizeEnvironment(query).toLowerCase();
    if (!needle) return [...options];
    return options.filter(
      (option) =>
        option.toLowerCase().includes(needle) ||
        environmentLabel(option, dict).toLowerCase().includes(needle)
    );
  }, [options, query, dict]);

  const typed = normalizeEnvironment(query);
  const existing = matchEnvironment(typed, options);
  const canCreate = typed.length > 0 && !existing;
  const rowCount = matches.length + (canCreate ? 1 : 0);

  // Close on outside click — the input keeps focus for keyboard users.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function openList() {
    setQuery("");
    setHighlight(0);
    setOpen(true);
  }

  function commit(next: string) {
    const normalized = normalizeEnvironment(next);
    if (!normalized) return;
    onChange(matchEnvironment(normalized, options) ?? normalized);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
      return;
    }
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter") {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((current) => (rowCount ? (current + 1) % rowCount : 0));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) =>
        rowCount ? (current - 1 + rowCount) % rowCount : 0
      );
      return;
    }
    if (event.key === "Enter") {
      // Enter must not submit the surrounding credential form.
      event.preventDefault();
      commit(highlight < matches.length ? matches[highlight] : typed);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <TextInput
        id={id}
        value={inputValue}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        placeholder={tr("modal.environmentPlaceholder", dict)}
        color={invalid ? "failure" : undefined}
        rightIcon={HiChevronDown}
        onFocus={openList}
        onChange={(event) => {
          setQuery(event.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />

      {open && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-700"
        >
          {matches.map((option, index) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={option === value}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 ${
                  index === highlight ? "bg-gray-100 dark:bg-gray-600" : ""
                }`}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => commit(option)}
              >
                {environmentLabel(option, dict)}
                {option === value && <HiCheck className="h-4 w-4" />}
              </button>
            </li>
          ))}

          {canCreate && (
            <li>
              <button
                type="button"
                role="option"
                aria-selected={false}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-blue-700 dark:text-blue-400 ${
                  highlight === matches.length
                    ? "bg-gray-100 dark:bg-gray-600"
                    : ""
                }`}
                onMouseEnter={() => setHighlight(matches.length)}
                onClick={() => commit(typed)}
              >
                <HiPlus className="h-4 w-4 shrink-0" />
                {tr("modal.environmentCreate", dict, { name: typed })}
              </button>
            </li>
          )}

          {rowCount === 0 && (
            <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              {tr("modal.environmentEmpty", dict)}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
