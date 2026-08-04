"use client";

import type { ReactNode } from "react";
import { Badge, Button, Select, Spinner } from "flowbite-react";
import { HiPlus } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type {
  EnrichmentBinding,
  EnrichmentTarget,
} from "../enrichment/enrichment.types";

/**
 * The list-and-picker furniture every calendar-administered binding section
 * shares. Sections differ in their form and their card summary line, never in
 * this scaffolding — the `keyPrefix` points each one at its own i18n block
 * (`pages.calendar.enrichment`, `pages.calendar.dispatch`), whose common keys
 * are deliberately parallel.
 */

interface BindingListCardsProps<T extends EnrichmentBinding> {
  readonly bindings: readonly T[] | null;
  readonly error: string | null;
  readonly dict: I18nRecord;
  /** e.g. `pages.calendar.dispatch` — owns add/empty/on/off/scope/edit/delete. */
  readonly keyPrefix: string;
  /** The card's middle line — the one section-specific part of a card. */
  readonly summary: (binding: T) => ReactNode;
  readonly onAdd: () => void;
  readonly onEdit: (binding: T) => void;
  readonly onDelete: (binding: T) => void | Promise<void>;
}

export function BindingListCards<T extends EnrichmentBinding>({
  bindings,
  error,
  dict,
  keyPrefix,
  summary,
  onAdd,
  onEdit,
  onDelete,
}: Readonly<BindingListCardsProps<T>>) {
  return (
    <div className="flex flex-col gap-3">
      <Button color="blue" size="sm" onClick={onAdd}>
        <HiPlus className="mr-1 h-4 w-4" />
        {tr(`${keyPrefix}.add`, dict)}
      </Button>

      {bindings === null && !error && <Spinner size="sm" />}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}
      {bindings?.length === 0 && !error && (
        <p className="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
          {tr(`${keyPrefix}.empty`, dict)}
        </p>
      )}

      {bindings?.map((binding) => (
        <div
          key={binding.id}
          className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
        >
          <div className="flex items-center gap-2">
            <Badge color={binding.enabled ? "success" : "gray"} size="xs">
              {binding.enabled
                ? tr(`${keyPrefix}.on`, dict)
                : tr(`${keyPrefix}.off`, dict)}
            </Badge>
            {binding.inherited && (
              <Badge color="indigo" size="xs">
                {tr(`${keyPrefix}.inherited`, dict)}
              </Badge>
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {binding.scopeKey
                ? tr(`${keyPrefix}.thisCalendar`, dict)
                : tr(`${keyPrefix}.allCalendars`, dict)}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {summary(binding)}
          </p>
          {!binding.inherited && (
            <div className="mt-2 flex gap-2">
              <Button color="light" size="xs" onClick={() => onEdit(binding)}>
                {tr(`${keyPrefix}.edit`, dict)}
              </Button>
              <Button color="light" size="xs" onClick={() => onDelete(binding)}>
                {tr(`${keyPrefix}.delete`, dict)}
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface BindingTargetPickerProps {
  readonly id: string;
  readonly targets: readonly EnrichmentTarget[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  /**
   * An edit whose stored connection/operation no longer appears among the
   * targets (deleted or deactivated) — silence would read as an empty
   * selection, so the picker warns instead.
   */
  readonly missing: boolean;
  readonly dict: I18nRecord;
  readonly keyPrefix: string;
}

/** The connection · operation picker, with the resolved target's contract line. */
export function BindingTargetPicker({
  id,
  targets,
  value,
  onChange,
  missing,
  dict,
  keyPrefix,
}: Readonly<BindingTargetPickerProps>) {
  const target = targets.find(
    (t) => `${t.connectionId}:${t.operationId}` === value
  );
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {tr(`${keyPrefix}.connection`, dict)}
      </label>
      <Select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{tr(`${keyPrefix}.connectionPlaceholder`, dict)}</option>
        {targets.map((t) => (
          <option
            key={`${t.connectionId}:${t.operationId}`}
            value={`${t.connectionId}:${t.operationId}`}
          >
            {t.connectionName} · {t.operationName}
          </option>
        ))}
      </Select>
      {target && (
        <p className="mt-1 font-mono text-xs text-gray-500 dark:text-gray-400">
          {target.method} {target.path}
        </p>
      )}
      {missing && (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
          {tr(`${keyPrefix}.targetMissing`, dict)}
        </p>
      )}
    </div>
  );
}
