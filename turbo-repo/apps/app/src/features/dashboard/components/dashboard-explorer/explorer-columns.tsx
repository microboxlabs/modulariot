"use client";

/**
 * The list's header row: the column names, with a filter in the Name, Tags,
 * Created and Star headers. Every column always shows.
 *
 * The headers that filter are drawn as capsules as wide as their column, the
 * name inside and, at the right end, what they do: a magnifier for a search,
 * a chevron for a menu, a calendar for a date range.
 */
import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  HiArrowDown,
  HiArrowUp,
  HiCheck,
  HiChevronDown,
  HiOutlineCalendar,
  HiOutlineSearch,
  HiPlus,
  HiOutlineStar,
  HiOutlineSwitchVertical,
  HiStar,
  HiX,
} from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import { Badge } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import TimeRangePicker from "../dashboard-filter-bar/time-range-picker";
import type {
  ExplorerFacets,
  ExplorerSort,
  ExplorerSortKey,
} from "./explorer-tree.types";
import { nextSort } from "./explorer-tree";
import { formatCreatedRange } from "./explorer-created";
import { useDismiss } from "./use-dismiss";
import SelectBox from "@/features/common/components/select-box";

/**
 * The bordered box around the header row and the list. In light mode the
 * list sits a shade darker than the header above it, as something inside it.
 */
export const LIST_FRAME_CLASS =
  "min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40";

/** Widths shared by the header and every row, so the columns line up. */
export const COLUMN_CLASSES = {
  tags: "hidden w-56 shrink-0 md:flex",
  created: "hidden w-32 shrink-0 items-center sm:flex",
  star: "flex w-10 shrink-0 justify-center",
} as const;

/**
 * Where a row's value starts inside the Tags and Created columns: under the
 * header pill's label, which sits past the pill's 1px border and 12px
 * padding, rather than at the column's edge.
 */
export const CELL_INSET_CLASS = "pl-[13px]";

/**
 * The outline every filtering header shares, at rest and in use. It is filled
 * with the list's own colour (in dark mode the list's 40% gray-800 over the
 * page's gray-900, mixed here since the header behind it is opaque).
 */
export const CAPSULE_CLASS =
  "h-7 rounded-full border border-gray-300 bg-gray-50 text-sm font-normal text-gray-700 transition-colors hover:border-gray-400 dark:border-gray-600 dark:bg-[color-mix(in_oklab,var(--color-gray-800)_40%,var(--color-gray-900))] dark:text-gray-200 dark:hover:border-gray-500";

/** A filter capsule that is filtering: blue, like a selected chip. */
export const CAPSULE_ACTIVE_CLASS =
  "border-blue-500 bg-blue-50 text-blue-700 hover:border-blue-600 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:border-blue-300";

/** A header button that opens a small menu under it. */
function HeaderMenu({
  label,
  button,
  active = false,
  align = "left",
  buttonClassName,
  className,
  menuClassName,
  children,
}: Readonly<{
  label: string;
  button: ReactNode;
  active?: boolean;
  align?: "left" | "right";
  /** Replaces the plain look, e.g. with a capsule's. */
  buttonClassName?: string;
  /** For the wrapper, e.g. to fill its column. */
  className?: string;
  /** For the menu, e.g. to take the button's width. */
  menuClassName?: string;
  children: (close: () => void) => ReactNode;
}>) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(root, open, close);
  return (
    <div ref={root} className={twMerge("relative", className)}>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={twMerge(
          "inline-flex h-7 items-center gap-1 rounded px-1.5 text-sm font-medium transition-colors",
          "text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700",
          active && "text-blue-700 dark:text-blue-300",
          buttonClassName
        )}
      >
        {button}
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className={twMerge(
            "absolute top-full z-20 mt-1 min-w-48 rounded-md border border-gray-200 bg-white py-1 text-sm font-normal shadow-lg dark:border-gray-700 dark:bg-gray-800",
            align === "right" ? "right-0" : "left-0",
            menuClassName
          )}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

function CheckItem({
  label,
  checked,
  onToggle,
}: Readonly<{ label: string; checked: boolean; onToggle: () => void }>) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={onToggle}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
    >
      <span
        className={twMerge(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
          checked
            ? "border-blue-600 bg-blue-600 text-white"
            : "border-gray-300 dark:border-gray-600"
        )}
      >
        {checked && <HiCheck className="h-3 w-3" />}
      </span>
      <span className="truncate" title={label}>
        {label}
      </span>
    </button>
  );
}

/** Adds `tag` to the filter, or takes it out. */
function toggled(tags: readonly string[], tag: string): string[] {
  return tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
}

export function TagFilter({
  t,
  tags,
  facets,
  onFacetsChange,
}: Readonly<{
  t: (key: string) => string;
  tags: readonly string[];
  facets: ExplorerFacets;
  onFacetsChange: (next: ExplorerFacets) => void;
}>) {
  const count = facets.tags.length;
  return (
    <HeaderMenu
      label={t("columns.filterTags")}
      active={count > 0}
      className="w-full"
      // As wide as the capsule that opens it; long tags are cut short.
      menuClassName="w-full min-w-0"
      buttonClassName={twMerge(
        CAPSULE_CLASS,
        "w-full gap-1.5 pl-3 pr-2",
        count > 0 && CAPSULE_ACTIVE_CLASS
      )}
      button={
        <>
          <span className="truncate">{t("columns.tags")}</span>
          {count > 0 && (
            <span className="rounded-full bg-blue-600 px-1.5 text-xs text-white">
              {count}
            </span>
          )}
          <HiChevronDown aria-hidden className="ml-auto h-4 w-4 shrink-0" />
        </>
      }
    >
      {() => (
        <>
          {tags.length === 0 && (
            <p className="px-3 py-1.5 text-gray-500 dark:text-gray-400">
              {t("columns.noTags")}
            </p>
          )}
          {tags.map((tag) => (
            <CheckItem
              key={tag}
              label={tag}
              checked={facets.tags.includes(tag)}
              onToggle={() =>
                onFacetsChange({ ...facets, tags: toggled(facets.tags, tag) })
              }
            />
          ))}
          {count > 0 && (
            <button
              type="button"
              role="menuitem"
              onClick={() => onFacetsChange({ ...facets, tags: [] })}
              className="mt-1 w-full border-t border-gray-100 px-3 py-1.5 text-left text-blue-700 hover:bg-gray-100 dark:border-gray-700 dark:text-blue-300 dark:hover:bg-gray-700"
            >
              {t("columns.clearFilter")}
            </button>
          )}
        </>
      )}
    </HeaderMenu>
  );
}

/** The header's select-all box: none, some or all of the rows selected. */
export interface SelectAllState {
  state: "none" | "some" | "all";
  onToggle: () => void;
}

/**
 * The Name header, which is also the search: a capsule that reads "Name"
 * with a magnifier at its end until typed in, then filters the list by what
 * was typed. It fills the column, like the other filters.
 */
export function NameSearch({
  t,
  value,
  onChange,
  placeholder,
  leading,
}: Readonly<{
  t: (key: string) => string;
  value: string;
  onChange: (value: string) => void;
  /** "Name" when absent, as the list's header reads. */
  placeholder?: string;
  /** A small button inside the capsule, on its left, e.g. to sort. */
  leading?: ReactNode;
}>) {
  return (
    <div className="flex min-w-0 flex-1 items-center">
      <div className="relative flex w-full min-w-0 items-center">
        {leading && <LeadingSlot>{leading}</LeadingSlot>}
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onChange("");
          }}
          placeholder={placeholder ?? t("name")}
          aria-label={t("nameSearch")}
          className={twMerge(
            CAPSULE_CLASS,
            "w-full min-w-0 py-0 pl-3 pr-8 text-gray-900 dark:text-white",
            leading && "pl-6.5",
            "placeholder:text-gray-700 dark:placeholder:text-gray-200",
            "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:placeholder:text-gray-400",
            // Typing in it: the page's darker background, to stand out.
            "focus:bg-white dark:focus:border-blue-400 dark:focus:bg-gray-900 dark:focus:ring-blue-400",
            // The browser's own clear button; this one matches the header.
            "[&::-webkit-search-cancel-button]:appearance-none"
          )}
        />
        {value ? (
          <button
            type="button"
            aria-label={t("clearSearch")}
            title={t("clearSearch")}
            onClick={() => onChange("")}
            className="absolute right-1.5 rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <HiX className="h-4 w-4" />
          </button>
        ) : (
          <HiOutlineSearch
            aria-hidden
            className="pointer-events-none absolute right-2.5 h-4 w-4 text-gray-500 dark:text-gray-400"
          />
        )}
      </div>
    </div>
  );
}

/** Where a capsule's leading button sits: inside it, on the left. */
function LeadingSlot({ children }: Readonly<{ children: ReactNode }>) {
  return <span className="absolute left-1 z-10 flex">{children}</span>;
}

const SORT_ICONS = {
  off: HiOutlineSwitchVertical,
  asc: HiArrowUp,
  desc: HiArrowDown,
} as const;

/** The sort labels' keys, by key and state. */
const SORT_LABELS: Record<
  ExplorerSortKey,
  Record<keyof typeof SORT_ICONS, string>
> = {
  name: {
    off: "cards.sortByName",
    asc: "cards.sortedNameAsc",
    desc: "cards.sortedNameDesc",
  },
  created: {
    off: "cards.sortByCreated",
    asc: "cards.sortedCreatedAsc",
    desc: "cards.sortedCreatedDesc",
  },
};

/** The small arrow inside a filter, on its left, that orders the cards by it. */
export function SortButton({
  t,
  sortKey,
  sort,
  onSortChange,
}: Readonly<{
  t: (key: string) => string;
  sortKey: ExplorerSortKey;
  sort: ExplorerSort | null;
  onSortChange: (next: ExplorerSort | null) => void;
}>) {
  const state = sort?.key === sortKey ? sort.direction : "off";
  const Icon = SORT_ICONS[state];
  const label = t(SORT_LABELS[sortKey][state]);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-sort={state}
      onClick={() => onSortChange(nextSort(sort, sortKey))}
      className={twMerge(
        "flex h-5 w-5 items-center justify-center rounded-full transition-colors",
        state === "off"
          ? "text-gray-500 hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
          : "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-900"
      )}
    >
      <Icon aria-hidden className="h-3.5 w-3.5" />
    </button>
  );
}

/** A filter's capsule while the list loads, so nothing moves after. */
function CapsulePlaceholder({
  label,
  icon: Icon,
}: Readonly<{ label: string; icon: typeof HiOutlineSearch }>) {
  return (
    <span
      className={twMerge(
        CAPSULE_CLASS,
        "flex w-full items-center justify-between pl-3 pr-2.5 hover:border-gray-300 dark:hover:border-gray-600"
      )}
    >
      <span className="truncate">{label}</span>
      <Icon
        aria-hidden
        className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400"
      />
    </span>
  );
}

/**
 * The Created header, which is also a filter by creation date: it opens the
 * dashboards' own date range picker. While filtering it turns blue, shows the
 * range on hover, and swaps its calendar for a button that drops the range.
 */
export function CreatedFilter({
  t,
  dictionary,
  facets,
  onFacetsChange,
  leading,
  lang,
}: Readonly<{
  t: (key: string) => string;
  /** The page's language, for the chosen range's dates. */
  lang?: string;
  /** The whole dictionary, for the picker's own words. */
  dictionary: I18nRecord;
  facets: ExplorerFacets;
  onFacetsChange: (next: ExplorerFacets) => void;
  /** A small button inside the capsule, on its left, e.g. to sort. */
  leading?: ReactNode;
}>) {
  const range = facets.created;
  const active = range !== null;
  return (
    <div className="relative flex w-full items-center">
      {leading && <LeadingSlot>{leading}</LeadingSlot>}
      <TimeRangePicker
        fullWidth
        mode="date"
        ranges="date"
        dictionary={dictionary}
        from={range?.from}
        to={range?.to}
        onDateChange={(from, to) =>
          onFacetsChange({ ...facets, created: { from, to } })
        }
        trigger={{
          label: t("columns.filterCreated"),
          className: twMerge(
            CAPSULE_CLASS,
            "flex w-full items-center gap-1.5 pl-3 pr-2.5",
            leading && "pl-6.5",
            active && CAPSULE_ACTIVE_CLASS
          ),
          content: (
            <>
              {/* The chosen range in place of the label, once there is one. */}
              <span className="truncate">
                {range ? formatCreatedRange(range, lang) : t("columns.created")}
              </span>
              <HiOutlineCalendar
                aria-hidden
                className={twMerge(
                  "ml-auto h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400",
                  // The clear button sits here instead.
                  active && "invisible"
                )}
              />
            </>
          ),
        }}
      />
      {active && (
        <button
          type="button"
          aria-label={t("columns.clearCreated")}
          title={t("columns.clearCreated")}
          onClick={() => onFacetsChange({ ...facets, created: null })}
          className="absolute right-1.5 rounded-full p-0.5 text-blue-600 hover:bg-blue-100 hover:text-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/50 dark:hover:text-blue-100"
        >
          <HiX className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

interface ExplorerHeaderProps {
  t: (key: string) => string;
  /** Absent while the list loads: an empty slot keeps "Name" in place. */
  selectAll?: SelectAllState;
  /** The Name header doubles as the search by name; absent while loading. */
  search?: { value: string; onChange: (value: string) => void };
  /** Every tag in the list, for the Tags filter. */
  tags: readonly string[];
  facets: ExplorerFacets;
  onFacetsChange: (next: ExplorerFacets) => void;
  /**
   * The whole dictionary, for the Created column's date picker; absent while
   * loading, when the header is inert.
   */
  pickerDictionary?: I18nRecord;
  /** The page's language, for the Created filter's range. */
  lang?: string;
  /** The rows' order, from the arrows inside Name and Created; absent while loading. */
  sorting?: {
    sort: ExplorerSort | null;
    onSortChange: (next: ExplorerSort | null) => void;
  };
}

export function ExplorerHeader({
  t,
  selectAll,
  search,
  pickerDictionary,
  tags,
  facets,
  onFacetsChange,
  sorting,
  lang,
}: Readonly<ExplorerHeaderProps>) {
  const sortButton = (sortKey: ExplorerSortKey) =>
    sorting && (
      <SortButton
        t={t}
        sortKey={sortKey}
        sort={sorting.sort}
        onSortChange={sorting.onSortChange}
      />
    );
  const StarIcon = facets.starredOnly ? HiStar : HiOutlineStar;
  return (
    <div className="sticky top-0 z-10 flex h-10 items-center gap-3 border-b border-gray-200 bg-white pl-3 pr-3 text-sm font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
      {selectAll ? (
        <span data-keep-selection className="flex">
          <SelectBox
            checked={
              selectAll.state === "some" ? "mixed" : selectAll.state === "all"
            }
            label={t("columns.selectAll")}
            onToggle={selectAll.onToggle}
          />
        </span>
      ) : (
        <span className="w-4 shrink-0" />
      )}
      {search ? (
        <NameSearch
          t={t}
          value={search.value}
          onChange={search.onChange}
          leading={sortButton("name")}
        />
      ) : (
        <div className="flex min-w-0 flex-1 items-center">
          <CapsulePlaceholder label={t("name")} icon={HiOutlineSearch} />
        </div>
      )}
      <div className={COLUMN_CLASSES.tags}>
        <TagFilter
          t={t}
          tags={tags}
          facets={facets}
          onFacetsChange={onFacetsChange}
        />
      </div>
      <div className={COLUMN_CLASSES.created}>
        {pickerDictionary ? (
          <CreatedFilter
            t={t}
            dictionary={pickerDictionary}
            facets={facets}
            onFacetsChange={onFacetsChange}
            lang={lang}
            leading={sortButton("created")}
          />
        ) : (
          <CapsulePlaceholder
            label={t("columns.created")}
            icon={HiOutlineCalendar}
          />
        )}
      </div>
      <div className={COLUMN_CLASSES.star}>
        <button
          type="button"
          aria-pressed={facets.starredOnly}
          aria-label={t("columns.starredOnly")}
          title={t("columns.starredOnly")}
          onClick={() =>
            onFacetsChange({ ...facets, starredOnly: !facets.starredOnly })
          }
          className={twMerge(
            "flex h-7 w-7 items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-700",
            facets.starredOnly ? "text-amber-500" : "text-gray-500"
          )}
        >
          <StarIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Beside a dashboard's name while it is new. Hidden from screen readers so
 * the link keeps the dashboard's name; the Created column says the same.
 */
export function NewBadge({ label }: Readonly<{ label: string }>) {
  return (
    <span
      aria-hidden
      className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
    >
      {label}
    </span>
  );
}

/**
 * In a folder's Tags cell, so the row's columns are not left empty: the
 * app's gray badge, as on the other pages' neutral labels.
 * Hidden from screen readers: the row already says it is a folder.
 */
export function FolderBadge({ label }: Readonly<{ label: string }>) {
  return (
    <Badge aria-hidden color="gray" size="xs" className="shrink-0">
      {label}
    </Badge>
  );
}

/**
 * A dashboard's tags, as a button that edits them. While the row or card is
 * hovered (or the button focused) a small "+" grows in at the start of the
 * list, taking no room until then; without tags, "Add tag" comes with it.
 * Kept apart from the row's own clicks and keys.
 */
export function TagsButton({
  tags,
  label,
  addLabel,
  onEdit,
  className,
}: Readonly<{
  tags: readonly string[];
  /** 'Edit tags of "Fleet"', for screen readers and the tooltip. */
  label: string;
  addLabel: string;
  onEdit: () => void;
  className?: string;
}>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      draggable={false}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onEdit();
      }}
      onKeyDown={(event) => event.stopPropagation()}
      className={twMerge(
        "-mx-1 flex min-w-0 max-w-full cursor-pointer items-center rounded-md px-1 py-0.5 transition-colors hover:bg-gray-200/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-gray-700",
        className
      )}
    >
      <span
        aria-hidden
        className="flex h-5 w-0 shrink-0 scale-0 items-center justify-center overflow-hidden rounded border-0 border-gray-300 bg-white text-gray-500 opacity-0 transition-all duration-200 ease-out group-focus-within:mr-1.5 group-focus-within:w-5 group-focus-within:scale-100 group-focus-within:border group-focus-within:opacity-100 group-hover:mr-1.5 group-hover:w-5 group-hover:scale-100 group-hover:border group-hover:opacity-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
      >
        <HiPlus className="h-3 w-3" />
      </span>
      {tags.length > 0 ? (
        <TagChips tags={tags} />
      ) : (
        <span className="whitespace-nowrap text-xs text-gray-500 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 dark:text-gray-400">
          {addLabel}
        </span>
      )}
    </button>
  );
}

/** A dashboard's tags as small chips; the ones that do not fit are counted. */
export function TagChips({ tags }: Readonly<{ tags: readonly string[] }>) {
  const shown = tags.slice(0, 3);
  const rest = tags.length - shown.length;
  return (
    <div className="flex min-w-0 items-center gap-1 overflow-hidden">
      {shown.map((tag) => (
        <span
          key={tag}
          className="truncate rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200"
        >
          {tag}
        </span>
      ))}
      {rest > 0 && (
        <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
          +{rest}
        </span>
      )}
    </div>
  );
}
