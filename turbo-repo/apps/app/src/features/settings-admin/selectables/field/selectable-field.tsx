"use client";

import { useEffect, useRef, useState } from "react";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { HiChevronDown, HiX } from "react-icons/hi";
import { useDebounce } from "use-debounce";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { pickText } from "../localized";
import { useSelectableOptions } from "../selectables-api";
import type { Selectable, SelectableOption } from "../types";
import {
  canCreate,
  filterStatic,
  optionFor,
  sections,
  underCap,
} from "./field-logic";
import { OptionBadge, OptionRow, OptionSectionHeader } from "./field-parts";

export interface SelectableFieldProps {
  readonly list: Selectable;
  /** Selected values; a single-choice list uses the first. */
  readonly value: string[];
  readonly onChange: (next: string[]) => void;
  readonly lang: string;
  /** The `selectables.field` dictionary section. */
  readonly dict: I18nRecord;
  /** Values picked in the list this one depends on. */
  readonly parentValues?: string[];
  /** Name of that list, for "pick one there first". */
  readonly parentName?: string;
  readonly id?: string;
  readonly disabled?: boolean;
}

/** Tracks the element's width, so the floating list lines up with the whole field. */
function useWidth(
  ref: React.RefObject<HTMLElement | null>
): number | undefined {
  const [width, setWidth] = useState<number>();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry?.contentRect.width)
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** Every option seen so far, so a selected value keeps its label after the search moves on. */
function useKnownOptions(
  list: Selectable,
  fetched: SelectableOption[] | undefined
) {
  const [known, setKnown] = useState(
    () => new Map(list.options.map((o) => [o.value, o]))
  );
  useEffect(() => {
    setKnown(new Map(list.options.map((o) => [o.value, o])));
  }, [list]);
  useEffect(() => {
    if (!fetched?.length) return;
    setKnown((prev) => {
      const next = new Map(prev);
      fetched.forEach((o) => next.set(o.value, o));
      return next;
    });
  }, [fetched]);
  return known;
}

function toValues(picked: string | string[] | null): string[] {
  if (picked === null) return [];
  return Array.isArray(picked) ? picked : [picked];
}

/**
 * A select backed by a selectable, in the spirit of select2: search, several
 * choices as removable badges, typed tags, groups, per-option color and icon,
 * a cap on selections, a list filtered by another, and options fetched from
 * the list's source. Keyboard and screen-reader behaviour come from Headless
 * UI's Combobox; the look is Flowbite's.
 */
export default function SelectableField({
  list,
  value,
  onChange,
  lang,
  dict,
  parentValues,
  parentName,
  id,
  disabled,
}: SelectableFieldProps) {
  const [query, setQuery] = useState("");
  const [search] = useDebounce(query, 250);
  const frame = useRef<HTMLDivElement>(null);
  const width = useWidth(frame);

  const multiple = list.mode === "MULTIPLE";
  const searchable = list.settings?.searchable !== false;
  const dynamic = list.source.kind !== "STATIC";
  const waitingForParent =
    Boolean(list.settings?.dependsOn) && !parentValues?.length;

  const { data: fetched, isLoading } = useSelectableOptions(
    dynamic && !waitingForParent ? list.key : null,
    { search, parents: parentValues }
  );
  const known = useKnownOptions(list, fetched);
  const shown = dynamic
    ? (fetched ?? [])
    : filterStatic(list, query, parentValues);
  const creatable = canCreate(list, query, shown, lang);
  const roomForMore = underCap(list, value.length);

  const handleChange = (picked: string | string[] | null) => {
    onChange(toValues(picked));
    setQuery("");
  };
  const remove = (gone: string) => onChange(value.filter((v) => v !== gone));

  const placeholder = waitingForParent
    ? tr("pickParentFirst", dict, { list: parentName ?? "" })
    : pickText(list.settings?.placeholder, lang) || tr("placeholder", dict);

  return (
    <Combobox
      value={multiple ? value : (value[0] ?? null)}
      onChange={handleChange}
      multiple={multiple}
      immediate
      onClose={() => setQuery("")}
      disabled={disabled || waitingForParent}
    >
      <div
        ref={frame}
        className="relative flex min-h-[42px] w-full flex-wrap items-center gap-1 rounded-lg border border-gray-300 bg-gray-50 py-1 pl-1.5 pr-14 text-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
      >
        {multiple &&
          value.map((v) => (
            <OptionBadge
              key={v}
              option={optionFor(v, known)}
              lang={lang}
              removeLabel={tr("remove", dict, {
                label: pickText(optionFor(v, known).label, lang),
              })}
              onRemove={remove}
            />
          ))}
        <ComboboxInput
          id={id}
          readOnly={!searchable}
          placeholder={multiple && value.length ? "" : placeholder}
          displayValue={(v: string | null) =>
            multiple || !v ? "" : pickText(optionFor(v, known).label, lang)
          }
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-24 flex-1 border-0 bg-transparent p-1 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed dark:text-white"
        />
        {value.length > 0 && !disabled && (
          <button
            type="button"
            onClick={() => handleChange(null)}
            aria-label={tr("clear", dict)}
            className="absolute inset-y-0 right-7 flex items-center px-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <HiX className="h-4 w-4" />
          </button>
        )}
        <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400">
          <HiChevronDown className="h-4 w-4" />
        </ComboboxButton>
      </div>

      <ComboboxOptions
        anchor="bottom start"
        style={{ width }}
        className="z-[60] mt-1 max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg [--anchor-gap:4px] empty:invisible dark:border-gray-600 dark:bg-gray-700"
      >
        {creatable && (
          <ComboboxOption
            value={query.trim()}
            className="cursor-default px-3 py-2 text-blue-700 data-[focus]:bg-blue-50 dark:text-blue-300 dark:data-[focus]:bg-gray-600"
          >
            {tr("create", dict, { value: query.trim() })}
          </ComboboxOption>
        )}
        {sections(shown, list.groups).map((section) => (
          <div key={section.group?.key ?? "_"}>
            {section.group && (
              <OptionSectionHeader
                label={pickText(section.group.label, lang)}
              />
            )}
            {section.options.map((option) => (
              <OptionRow
                key={option.value}
                option={option}
                lang={lang}
                blocked={!roomForMore && !value.includes(option.value)}
              />
            ))}
          </div>
        ))}
        <FieldStatus
          loading={dynamic && isLoading}
          empty={!shown.length && !creatable}
          atCap={!roomForMore}
          max={list.settings?.maxSelections}
          dict={dict}
        />
      </ComboboxOptions>
    </Combobox>
  );
}

interface FieldStatusProps {
  readonly loading: boolean;
  readonly empty: boolean;
  readonly atCap: boolean;
  readonly max?: number | null;
  readonly dict: I18nRecord;
}

function statusText({
  loading,
  empty,
  atCap,
  max,
  dict,
}: FieldStatusProps): string | null {
  if (loading) return tr("loading", dict);
  if (empty) return tr("noResults", dict);
  if (atCap && max) return tr("max", dict, { count: String(max) });
  return null;
}

function FieldStatus(props: FieldStatusProps) {
  const text = statusText(props);
  if (!text) return null;
  return (
    <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{text}</p>
  );
}
