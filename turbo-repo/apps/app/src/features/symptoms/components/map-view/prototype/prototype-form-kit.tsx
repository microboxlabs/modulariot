"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Dropdown, DropdownItem } from "flowbite-react";
import {
  HiOutlineCog,
  HiOutlineSearch,
  HiOutlinePlus,
  HiChevronDown,
} from "react-icons/hi";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { tr } from "@/features/i18n/tr.service";
import { useSelectables } from "@/features/settings-admin/selectables/store";
import { useFieldSelectableBinding } from "@/features/settings-admin/selectables/field-bindings";
import type { SelectableOption } from "@/features/settings-admin/selectables/types";
import BrandedMultiSelect from "@/features/task-forms/components/task-confirm-modal/branded-multi-select";

/**
 * PROTOTYPE — shared building blocks for the inline treatment forms
 * (call driver / ignore condition / invalidate symptom). One layout only: a
 * "bento" of bordered cells that fills the panel height with no scroll —
 * the "tarjetas" (cards-with-hints, scrolling body) variant was tried and
 * dropped in favor of this.
 */

export const fieldLabel =
  "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1";

/** Textarea class for a cell that must fill (not push) its bento cell height. */
export const fillTextarea =
  "w-full min-h-0 flex-1 resize-none text-sm text-gray-900 dark:text-white";

/** Every bento cell's header: full-bleed separator, title + optional action
 *  vertically centered. `-mx-*` cancels the cell's own side padding so the
 *  border runs edge to edge; the matching `pl`/`pr` put the content back at
 *  the cell's normal inset. Shared by `FieldCard` and `PlainSection` so every
 *  card in the form looks identical whether or not it has a gear action. */
const cellHeaderClass =
  "-mx-3 flex h-10 shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-3 dark:border-gray-700/60";
const cellTitleClass =
  "truncate text-sm font-semibold leading-none text-gray-900 dark:text-white";

/**
 * Compact "bento" column: fills the form body height, no outer scroll.
 * Deliberately flexbox, not CSS Grid — grid `fr` tracks only expand to fill
 * free space when the grid container's own height is definite, which is easy
 * to lose across a few nested wrappers; `flex-1`/`min-h-0` resolve through
 * nesting reliably, so the bottom row (actions) always lands flush with the
 * floor instead of stopping short. `prototype-inline-form` makes the body
 * `flex flex-col` so this is itself a genuine flex item.
 */
export function BentoGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-3">
      {children}
    </div>
  );
}

/**
 * A bento row: one or two cards side by side, always equal width
 * (`grid-cols-2`) and always full height (an *explicit* single
 * `minmax(0,1fr)` row track, not the implicit `auto` row CSS Grid falls back
 * to — explicit tracks are what actually stretch to the grid's own size).
 * Pass `grow` for the row that should absorb the remaining height in a
 * `BentoGrid`; its cards (`FieldCard ... grow`) then fill that height too,
 * via the default grid `align-items: stretch` — no percentage math needed on
 * the cards themselves.
 */
export function BentoRow({
  grow = false,
  children,
}: {
  grow?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`grid grid-cols-1 grid-rows-[minmax(0,1fr)] gap-3 sm:grid-cols-2 ${
        grow ? "min-h-0 flex-1" : "shrink-0"
      }`}
    >
      {children}
    </div>
  );
}

/**
 * The gear/selectable control for a field's card header. Unassigned, it's a
 * plain gear icon; clicking it opens a small popover — search box, the list
 * of configured selectables, and a "Create selectable" link out to the
 * settings page. Picking one binds it to `fieldKey` (persisted, see
 * `field-bindings.ts`) and the control itself swaps to showing that
 * selectable's name instead of the gear, so it stays visible which list is
 * wired to this field.
 */
export function SelectableFieldControl({
  fieldKey,
  dict,
}: {
  fieldKey: string;
  dict: I18nRecord;
}) {
  const { lang } = useParams<{ lang: string }>();
  const { selectables } = useSelectables();
  const [boundId, setBoundId] = useFieldSelectableBinding(fieldKey);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const bound = selectables.find((s) => s.id === boundId) ?? null;
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? selectables.filter((s) => s.name.toLowerCase().includes(normalizedQuery))
    : selectables;

  const configureLabel = tr("symptoms.proto_configure_options", dict);

  return (
    <div ref={containerRef} className="relative shrink-0 self-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={bound ? bound.name : configureLabel}
        aria-label={bound ? bound.name : configureLabel}
        className={
          bound
            ? "max-w-32 truncate rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            : "flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        }
      >
        {bound ? bound.name : <HiOutlineCog className="h-4 w-4" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <label className="relative block">
            <HiOutlineSearch className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr("symptoms.proto_selectable_search_placeholder", dict)}
              className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-7 pr-2 text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>

          <div className="mt-2 flex max-h-48 flex-col gap-0.5 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-gray-400 dark:text-gray-500">
                {tr("symptoms.proto_selectable_none", dict)}
              </p>
            )}
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setBoundId(s.id);
                  setOpen(false);
                  setQuery("");
                }}
                className={`flex flex-col items-start rounded-md px-2 py-1.5 text-left transition-colors ${
                  s.id === boundId
                    ? "bg-blue-50 dark:bg-blue-900/30"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <span className="truncate text-xs font-medium text-gray-900 dark:text-white">
                  {s.name || tr("symptoms.proto_selectable_unassigned", dict)}
                </span>
                <span className="truncate text-[11px] text-gray-400 dark:text-gray-500">
                  {s.options.length} · {s.mode === "multiple" ? "multi" : "single"}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-2 border-t border-gray-100 pt-2 dark:border-gray-700">
            <Link
              href={`/${lang ?? "es"}/users/settings/selectables?new=1`}
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <HiOutlinePlus className="h-3.5 w-3.5" />
              {tr("symptoms.proto_selectable_create", dict)}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/** The options of whichever selectable is currently bound to `fieldKey` (see
 *  `SelectableFieldControl`) — lets a field's own dropdown and its submit
 *  logic (e.g. "is the first option picked?") read the same live list. */
export function useSelectableOptions(fieldKey: string) {
  const { selectables } = useSelectables();
  const [boundId] = useFieldSelectableBinding(fieldKey);
  const selectable = selectables.find((s) => s.id === boundId) ?? null;
  return { selectable, options: selectable?.options ?? [] };
}

const dropdownTriggerClass =
  "flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-left text-xs text-gray-900 hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:border-gray-500";

/**
 * A Flowbite dropdown (not a native `<select>`) over an explicit list of
 * options. `SelectableDropdown` below is the common case — options sourced
 * from a bound selectable — but a field that needs a filtered/derived list
 * (e.g. "escalate to", which excludes whoever was already called) renders
 * this directly.
 */
export function OptionsDropdown({
  options,
  value,
  onSelect,
  placeholder,
  emptyLabel,
  className,
}: {
  options: SelectableOption[];
  value: string;
  onSelect: (option: SelectableOption) => void;
  placeholder: string;
  emptyLabel: string;
  className?: string;
}) {
  const selected = options.find((o) => o.id === value) ?? null;
  return (
    // `relative` makes this the containing block for the floating panel below,
    // so its `w-full` (in the theme override) matches this wrapper's width —
    // i.e. the trigger's width — instead of whatever positioned ancestor it'd
    // otherwise inherit from (which is what made the menu render wider).
    <div className={`relative w-full ${className ?? ""}`}>
      <Dropdown
        label={false}
        placement="bottom-start"
        disabled={options.length === 0}
        theme={{
          floating: {
            base: "z-30 max-h-60 w-full overflow-y-auto rounded-lg",
            content: "py-1 text-xs",
          },
        }}
        renderTrigger={() => (
          <button
            type="button"
            disabled={options.length === 0}
            className={dropdownTriggerClass}
          >
            <span className="truncate">
              {selected ? selected.name : placeholder}
            </span>
            <HiChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          </button>
        )}
      >
        {options.length === 0 ? (
          <DropdownItem disabled>{emptyLabel}</DropdownItem>
        ) : (
          options.map((o) => (
            <DropdownItem
              key={o.id}
              onClick={() => onSelect(o)}
              className={o.id === value ? "bg-gray-100 dark:bg-gray-600" : ""}
            >
              {o.name}
            </DropdownItem>
          ))
        )}
      </Dropdown>
    </div>
  );
}

/**
 * `OptionsDropdown` sourced straight from the selectable bound to `fieldKey` —
 * and mode-aware: when that selectable is set to "multiple" (via Settings ›
 * Selectables), this switches to `BrandedMultiSelect` automatically instead
 * of silently staying a single-pick control. Every field here still only
 * holds one `value: string`, so a multi-pick is encoded as its ids joined by
 * commas — the caller's `onSelect(option)` still fires once, with `option.id`
 * being that joined string and `option.name` the first pick's name (what the
 * field's own "selected label" logic reads). `call_tags`, which already
 * tracks a real `string[]`, talks to `BrandedMultiSelect` directly instead of
 * through this — this path is for fields that don't.
 */
export function SelectableDropdown({
  fieldKey,
  dict,
  value,
  onSelect,
  placeholder,
}: {
  fieldKey: string;
  dict: I18nRecord;
  value: string;
  onSelect: (option: SelectableOption) => void;
  placeholder?: string;
}) {
  const { selectable, options } = useSelectableOptions(fieldKey);
  const unassignedLabel = tr("symptoms.proto_selectable_unassigned", dict);

  if (selectable?.mode === "multiple") {
    const selectedIds = value ? value.split(",").filter(Boolean) : [];
    return (
      <BrandedMultiSelect
        size="sm"
        options={options.map((o) => ({
          value: o.id,
          label: o.name,
          description: o.description || undefined,
        }))}
        selectedValues={selectedIds}
        onSelectionChange={(ids) => {
          const primary = options.find((o) => o.id === ids[0]);
          onSelect({
            id: ids.join(","),
            name: primary?.name ?? "",
            description: primary?.description ?? "",
          });
        }}
        placeholder={placeholder ?? unassignedLabel}
        summaryLabel={(count) =>
          tr("symptoms.proto_multi_summary", dict, { count: String(count) })
        }
        emptyLabel={unassignedLabel}
      />
    );
  }

  return (
    <OptionsDropdown
      options={options}
      value={value}
      onSelect={onSelect}
      placeholder={placeholder ?? unassignedLabel}
      emptyLabel={unassignedLabel}
    />
  );
}

/**
 * A bento cell: bordered card, small title with a full-width separator,
 * full width by default (a `BentoGrid` child). Pass `grow` for a cell that
 * should absorb the remaining height — as a direct `BentoGrid` child that
 * means `flex-1`; inside a `BentoRow` it just stretches with the row (both
 * classes are applied so either context works).
 */
export function FieldCard({
  title,
  action,
  grow = false,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  grow?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`flex min-h-0 flex-col gap-1.5 rounded-lg border border-gray-200 bg-white px-3 pb-2 dark:border-gray-700 dark:bg-gray-800/40 ${
        grow ? "h-full flex-1" : "shrink-0"
      }`}
    >
      <div className={cellHeaderClass}>
        <h3 className={cellTitleClass}>{title}</h3>
        {action}
      </div>
      <div
        className={`flex flex-col gap-2 ${
          grow ? "min-h-0 flex-1 overflow-y-auto" : ""
        }`}
      >
        {children}
      </div>
    </section>
  );
}

/** The form's action bar — the last (shrink-0) row in the bento column, held
 *  at the floor by the flexible row above it absorbing the rest of the height. */
export function StickyActions({ children }: { children: React.ReactNode }) {
  return <div className="shrink-0">{children}</div>;
}

/** Titled bento cell for the general-information grid. */
export function PlainSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-h-0 shrink-0 flex-col gap-1.5 rounded-lg border border-gray-200 bg-white px-3 pb-2 dark:border-gray-700 dark:bg-gray-800/40">
      <div className={cellHeaderClass}>
        <h3 className={cellTitleClass}>{title}</h3>
      </div>
      {children}
    </section>
  );
}

/**
 * Dense trip/service context grid — replaces the sentence-style
 * ServiceInformation. Single-line "label: value" pairs.
 */
export function GeneralInfoGrid({
  dict,
  treatmentData,
  prescription,
}: {
  dict: I18nRecord;
  treatmentData: TreatmentsGeneralResponseItem | null;
  prescription: string;
}) {
  const rows: Array<[string, string | undefined | null]> = [
    [tr("symptoms.driver_name", dict), treatmentData?.trip_info?.driver],
    [tr("symptoms.vehicle_plate", dict), treatmentData?.trip_info?.asset_id],
    [tr("symptoms.phone", dict), treatmentData?.trip_info?.driver_contact],
    [tr("symptoms.service", dict), treatmentData?.symptom_info?.name],
    [tr("symptoms.load_type", dict), treatmentData?.trip_info?.type_load],
    [tr("symptoms.recommended_prescription", dict), prescription],
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-5 gap-y-1 sm:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="flex min-w-0 gap-1.5 text-xs">
          <dt className="shrink-0 text-gray-400 dark:text-gray-500">
            {label}:
          </dt>
          <dd className="truncate text-gray-700 dark:text-gray-300">
            {value || "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
