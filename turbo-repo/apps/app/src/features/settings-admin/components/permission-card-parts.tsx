"use client";

import { HiSearch } from "react-icons/hi";

interface EnabledSwitchRowProps {
  readonly idPrefix: string;
  readonly label: string;
  readonly help: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}

export function EnabledSwitchRow({
  idPrefix,
  label,
  help,
  checked,
  onChange,
}: EnabledSwitchRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-4 py-4 dark:border-gray-700">
      <div className="min-w-0">
        <span
          id={`${idPrefix}-enabled-label`}
          className="block text-sm font-medium text-gray-900 dark:text-white"
        >
          {label}
        </span>
        <span
          id={`${idPrefix}-enabled-help`}
          className="block text-xs text-gray-500 dark:text-gray-400"
        >
          {help}
        </span>
      </div>
      <label className="relative inline-flex shrink-0 cursor-pointer items-center">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-labelledby={`${idPrefix}-enabled-label`}
          aria-describedby={`${idPrefix}-enabled-help`}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-transform after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 dark:bg-gray-600 dark:after:border-gray-500" />
      </label>
    </div>
  );
}

interface MemberSearchInputProps {
  readonly label: string;
  readonly placeholder: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}

export function MemberSearchInput({
  label,
  placeholder,
  value,
  onChange,
}: MemberSearchInputProps) {
  return (
    <label className="relative block sm:w-72">
      <span className="sr-only">{label}</span>
      <HiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
      />
    </label>
  );
}

interface UnavailableAssigneeRowProps {
  readonly personId: string;
  readonly label: string;
  readonly onToggle: (personId: string) => void;
}

export function UnavailableAssigneeRow({
  personId,
  label,
  onToggle,
}: UnavailableAssigneeRowProps) {
  return (
    <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 last:border-b-0 dark:border-amber-800 dark:bg-amber-900/20">
      <input
        type="checkbox"
        checked
        onChange={() => onToggle(personId)}
        aria-label={`${personId}: ${label}`}
        className="h-4 w-4 rounded border-gray-300 text-blue-600"
      />
      <span className="min-w-0">
        <span className="block truncate text-sm text-gray-900 dark:text-white">
          {personId}
        </span>
        <span className="block text-xs text-amber-700 dark:text-amber-300">
          {label}
        </span>
      </span>
    </div>
  );
}

interface SaveFooterProps {
  readonly errors: ReadonlyArray<string | false>;
  readonly disabled: boolean;
  readonly onSave: () => void;
  readonly label: string;
}

export function SaveFooter({
  errors,
  disabled,
  onSave,
  label,
}: SaveFooterProps) {
  return (
    <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {errors
          .filter((message): message is string => Boolean(message))
          .map((message) => (
            <p key={message} className="text-sm text-red-600 dark:text-red-400">
              {message}
            </p>
          ))}
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {label}
      </button>
    </div>
  );
}
