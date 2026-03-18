"use client";

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Label } from "flowbite-react";
import { HiSearch, HiChevronDown, HiX } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

const DEBOUNCE_MS = 300;
const MIN_CHARACTERS = 2;

// ============================================================================
// Types
// ============================================================================

export interface BaseOption {
  id: string;
}

export interface FieldConfig<
  TOption extends BaseOption,
  TMatchType extends string,
> {
  readonly field: TMatchType;
  readonly getValue: (option: TOption) => string;
  readonly getLabel: (dict: I18nRecord) => string;
  readonly getIcon: () => ReactNode;
}

export interface GroupedSearchResult<TMatchType extends string> {
  matchType: TMatchType;
  count: number;
}

export interface ActiveFilter<TMatchType extends string> {
  matchType: TMatchType;
  query: string;
}

export interface BaseSearchDropdownProps<
  TOption extends BaseOption,
  TMatchType extends string,
> {
  readonly label: string;
  readonly items: TOption[];
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly dict: I18nRecord;
  readonly labelRightElement?: ReactNode;

  // Field configuration
  readonly fields: readonly FieldConfig<TOption, TMatchType>[];

  // Translation keys
  readonly translations: {
    readonly search: string;
    readonly noResults: string;
  };

  // Custom renderers
  readonly renderCard: (props: CardRenderProps<TOption>) => ReactNode;
  readonly renderSelectedButton: (
    option: TOption,
    dict: I18nRecord
  ) => ReactNode;

  // Optional: whether item can be selected (for disabled items)
  readonly canSelect?: (option: TOption) => boolean;

  // Optional: exclude certain items from the list
  readonly excludeId?: string;
}

export interface CardRenderProps<TOption extends BaseOption> {
  readonly item: TOption;
  readonly isSelected: boolean;
  readonly isHighlighted: boolean;
  readonly dict: I18nRecord;
  readonly onClick: () => void;
  readonly onMouseEnter: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateGroupedResults<
  TOption extends BaseOption,
  TMatchType extends string,
>(
  items: TOption[],
  query: string,
  fields: readonly FieldConfig<TOption, TMatchType>[],
  excludeId?: string
): GroupedSearchResult<TMatchType>[] {
  if (query.length < MIN_CHARACTERS) {
    return [];
  }

  const filteredItems = excludeId
    ? items.filter((item) => item.id !== excludeId)
    : items;

  const lowerQuery = query.toLowerCase();
  const matchCounts = new Map<TMatchType, Set<string>>();

  for (const item of filteredItems) {
    for (const fieldConfig of fields) {
      const fieldValue = fieldConfig.getValue(item);
      if (fieldValue.toLowerCase().includes(lowerQuery)) {
        if (!matchCounts.has(fieldConfig.field)) {
          matchCounts.set(fieldConfig.field, new Set());
        }
        matchCounts.get(fieldConfig.field)!.add(item.id);
      }
    }
  }

  return Array.from(matchCounts.entries())
    .map(([matchType, itemIds]) => ({
      matchType,
      count: itemIds.size,
    }))
    .filter((result) => result.count > 0)
    .sort((a, b) => b.count - a.count);
}

function filterItemsByField<
  TOption extends BaseOption,
  TMatchType extends string,
>(
  items: TOption[],
  query: string,
  matchType: TMatchType,
  fields: readonly FieldConfig<TOption, TMatchType>[],
  excludeId?: string
): TOption[] {
  const filteredItems = excludeId
    ? items.filter((item) => item.id !== excludeId)
    : items;

  if (!query.trim()) {
    return filteredItems;
  }

  const fieldConfig = fields.find((f) => f.field === matchType);
  if (!fieldConfig) {
    return filteredItems;
  }

  const lowerQuery = query.toLowerCase();
  return filteredItems.filter((item) =>
    fieldConfig.getValue(item).toLowerCase().includes(lowerQuery)
  );
}

// ============================================================================
// Keyboard Handler Helpers
// ============================================================================

interface KeyboardHandlerContext<TOption extends BaseOption> {
  setIsOpen: (open: boolean) => void;
  setQuery: (query: string) => void;
  setActiveFilter: (filter: null) => void;
  setHighlightedIndex: (fn: (prev: number) => number) => void;
  isKeyboardNavigation: React.RefObject<boolean>;
  handleClearFilter: () => void;
  handleSelect: (id: string) => void;
  canSelect?: (option: TOption) => boolean;
}

function handleGroupedModeKeyDown<TMatchType extends string>(
  e: KeyboardEvent<HTMLInputElement>,
  groupedResults: GroupedSearchResult<TMatchType>[],
  highlightedIndex: number,
  handleMatchTypeSelect: (result: GroupedSearchResult<TMatchType>) => void,
  context: Pick<
    KeyboardHandlerContext<BaseOption>,
    "setIsOpen" | "setQuery" | "setActiveFilter" | "setHighlightedIndex"
  >
): void {
  const { setIsOpen, setQuery, setActiveFilter, setHighlightedIndex } = context;

  if (groupedResults.length === 0) {
    if (e.key === "Escape") {
      setIsOpen(false);
      setQuery("");
      setActiveFilter(null);
    }
    return;
  }

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < groupedResults.length - 1 ? prev + 1 : prev
      );
      break;
    case "ArrowUp":
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      break;
    case "Enter":
      e.preventDefault();
      if (groupedResults[highlightedIndex]) {
        handleMatchTypeSelect(groupedResults[highlightedIndex]);
      }
      break;
    case "Escape":
      e.preventDefault();
      setIsOpen(false);
      setQuery("");
      setActiveFilter(null);
      break;
    case "Tab":
      if (groupedResults[highlightedIndex]) {
        handleMatchTypeSelect(groupedResults[highlightedIndex]);
      }
      break;
  }
}

function trySelectHighlightedItem<TOption extends BaseOption>(
  filteredItems: TOption[],
  highlightedIndex: number,
  canSelect: ((option: TOption) => boolean) | undefined,
  handleSelect: (id: string) => void
): void {
  const item = filteredItems[highlightedIndex];
  if (item && (!canSelect || canSelect(item))) {
    handleSelect(item.id);
  }
}

function handleEscapeKey(
  activeFilter: unknown,
  handleClearFilter: () => void,
  setIsOpen: (open: boolean) => void,
  setQuery: (query: string) => void
): void {
  if (activeFilter) {
    handleClearFilter();
  } else {
    setIsOpen(false);
    setQuery("");
  }
}

function handleListModeKeyDown<TOption extends BaseOption>(
  e: KeyboardEvent<HTMLInputElement>,
  filteredItems: TOption[],
  highlightedIndex: number,
  activeFilter: unknown,
  context: KeyboardHandlerContext<TOption>
): void {
  const {
    setIsOpen,
    setQuery,
    setHighlightedIndex,
    isKeyboardNavigation,
    handleClearFilter,
    handleSelect,
    canSelect,
  } = context;

  if (filteredItems.length === 0) {
    if (e.key === "Escape") {
      handleEscapeKey(activeFilter, handleClearFilter, setIsOpen, setQuery);
    }
    return;
  }

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      isKeyboardNavigation.current = true;
      setHighlightedIndex((prev) =>
        prev < filteredItems.length - 1 ? prev + 1 : prev
      );
      break;
    case "ArrowUp":
      e.preventDefault();
      isKeyboardNavigation.current = true;
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      break;
    case "Enter":
      e.preventDefault();
      trySelectHighlightedItem(
        filteredItems,
        highlightedIndex,
        canSelect,
        handleSelect
      );
      break;
    case "Escape":
      e.preventDefault();
      handleEscapeKey(activeFilter, handleClearFilter, setIsOpen, setQuery);
      break;
    case "Tab":
      trySelectHighlightedItem(
        filteredItems,
        highlightedIndex,
        canSelect,
        handleSelect
      );
      break;
  }
}

// ============================================================================
// Filtered Items List Component
// ============================================================================

interface FilteredItemsListProps<TOption extends BaseOption> {
  readonly filteredItems: TOption[];
  readonly selectedId: string;
  readonly highlightedIndex: number;
  readonly dict: I18nRecord;
  readonly noResultsText: string;
  readonly canSelect?: (option: TOption) => boolean;
  readonly renderCard: (props: CardRenderProps<TOption>) => ReactNode;
  readonly onSelect: (id: string) => void;
  readonly onHighlight: (index: number) => void;
}

function FilteredItemsList<TOption extends BaseOption>({
  filteredItems,
  selectedId,
  highlightedIndex,
  dict,
  noResultsText,
  canSelect,
  renderCard,
  onSelect,
  onHighlight,
}: FilteredItemsListProps<TOption>) {
  if (filteredItems.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        {noResultsText}
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-600">
      {filteredItems.map((item, index) => (
        <div key={item.id} data-index={index}>
          {renderCard({
            item,
            isSelected: item.id === selectedId,
            isHighlighted: index === highlightedIndex,
            dict,
            onClick: () => {
              if (!canSelect || canSelect(item)) {
                onSelect(item.id);
              }
            },
            onMouseEnter: () => onHighlight(index),
          })}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Grouped Results Content Component
// ============================================================================

interface GroupedResultsContentProps<TMatchType extends string> {
  readonly searchResults: GroupedSearchResult<TMatchType>[];
  readonly selectedIndex: number;
  readonly debouncedQuery: string;
  readonly dict: I18nRecord;
  readonly noResultsText: string;
  readonly fields: readonly FieldConfig<BaseOption, TMatchType>[];
  readonly onMatchTypeSelect: (result: GroupedSearchResult<TMatchType>) => void;
  readonly onMouseEnter: (index: number) => void;
}

function GroupedResultsContent<TMatchType extends string>({
  searchResults,
  selectedIndex,
  debouncedQuery,
  dict,
  noResultsText,
  fields,
  onMatchTypeSelect,
  onMouseEnter,
}: GroupedResultsContentProps<TMatchType>) {
  if (searchResults.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <div>{noResultsText}</div>
        <div className="mt-1 text-xs">
          {tr("pages.planning.sidebar.assignment.searchNoResultsFor", dict)}{" "}
          &ldquo;{debouncedQuery}&rdquo;
        </div>
      </div>
    );
  }

  return (
    <ul className="py-1">
      {searchResults.map((result, index) => {
        const fieldConfig = fields.find((f) => f.field === result.matchType);
        return (
          <li key={result.matchType}>
            <button
              type="button"
              tabIndex={index === selectedIndex ? 0 : -1}
              onClick={() => onMatchTypeSelect(result)}
              onMouseEnter={() => onMouseEnter(index)}
              className={twMerge(
                "w-full text-left px-4 py-2 cursor-pointer flex items-center gap-2",
                "transition-colors border-0 bg-transparent",
                index === selectedIndex
                  ? "bg-blue-50 dark:bg-blue-900/30"
                  : "hover:bg-gray-50 dark:hover:bg-gray-700"
              )}
            >
              <div className="flex items-center justify-center w-5 h-5 shrink-0">
                {fieldConfig?.getIcon()}
              </div>
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {fieldConfig?.getLabel(dict)}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({result.count})
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function BaseSearchDropdown<
  TOption extends BaseOption,
  TMatchType extends string,
>({
  label,
  items,
  selectedId,
  onSelect,
  placeholder,
  disabled = false,
  dict,
  labelRightElement,
  fields,
  translations,
  renderCard,
  renderSelectedButton,
  canSelect,
  excludeId,
}: BaseSearchDropdownProps<TOption, TMatchType>) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [activeFilter, setActiveFilter] =
    useState<ActiveFilter<TMatchType> | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isKeyboardNavigation = useRef(false);

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  // Calculate grouped results when no filter is active
  const groupedResults = useMemo(
    () => calculateGroupedResults(items, debouncedQuery, fields, excludeId),
    [items, debouncedQuery, fields, excludeId]
  );

  // Filter items when a field filter is active
  const filteredItems = useMemo(() => {
    if (!activeFilter) {
      return excludeId ? items.filter((item) => item.id !== excludeId) : items;
    }
    return filterItemsByField(
      items,
      activeFilter.query,
      activeFilter.matchType,
      fields,
      excludeId
    );
  }, [items, activeFilter, fields, excludeId]);

  // Determine if we're in "grouped mode" (showing field types) or "list mode"
  const isGroupedMode =
    debouncedQuery.length >= MIN_CHARACTERS && !activeFilter;

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [groupedResults.length, filteredItems.length, isGroupedMode]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideContainer =
        containerRef.current && !containerRef.current.contains(target);
      const isOutsideDropdown =
        dropdownRef.current && !dropdownRef.current.contains(target);

      if (isOutsideContainer && isOutsideDropdown) {
        setIsOpen(false);
        setQuery("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
    }
  }, [isOpen]);

  // Scroll highlighted item into view (only for keyboard navigation)
  useEffect(() => {
    if (isOpen && listRef.current && isKeyboardNavigation.current) {
      const highlightedElement = listRef.current.querySelector(
        `[data-index="${highlightedIndex}"]`
      );
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: "nearest" });
      }
      isKeyboardNavigation.current = false;
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
      setIsOpen(false);
      setQuery("");
      setActiveFilter(null);
    },
    [onSelect]
  );

  const handleMatchTypeSelect = useCallback(
    (result: GroupedSearchResult<TMatchType>) => {
      setActiveFilter({
        matchType: result.matchType,
        query: debouncedQuery,
      });
      setQuery("");
      setHighlightedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    },
    [debouncedQuery]
  );

  const handleClearFilter = useCallback(() => {
    setActiveFilter(null);
    setQuery("");
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      const context = {
        setIsOpen,
        setQuery,
        setActiveFilter,
        setHighlightedIndex,
        isKeyboardNavigation,
        handleClearFilter,
        handleSelect,
        canSelect,
      };

      if (isGroupedMode) {
        handleGroupedModeKeyDown(
          e,
          groupedResults,
          highlightedIndex,
          handleMatchTypeSelect,
          context
        );
      } else {
        handleListModeKeyDown(
          e,
          filteredItems,
          highlightedIndex,
          activeFilter,
          context
        );
      }
    },
    [
      isGroupedMode,
      groupedResults,
      filteredItems,
      highlightedIndex,
      activeFilter,
      canSelect,
      handleSelect,
      handleMatchTypeSelect,
      handleClearFilter,
    ]
  );

  const selectedItem = items.find((item) => item.id === selectedId);

  const toggleDropdown = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
      if (!isOpen) {
        setQuery("");
        setHighlightedIndex(0);
      }
    }
  }, [disabled, isOpen]);

  const showMinCharsHint = query.length === 1 && !activeFilter;

  const getFieldConfigForMatchType = (matchType: TMatchType) =>
    fields.find((f) => f.field === matchType);

  const dropdownContent = isOpen ? (
    <div
      ref={dropdownRef}
      className={twMerge(
        "absolute left-0 right-0 bottom-full mb-1 z-50",
        "bg-white dark:bg-gray-800",
        "border border-gray-200 dark:border-gray-700",
        "rounded-lg shadow-lg",
        "overflow-hidden"
      )}
    >
      {/* Active Filter Tag */}
      {activeFilter && (
        <div className="px-2 pt-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700">
            {getFieldConfigForMatchType(activeFilter.matchType)?.getIcon()}
            <span className="text-xs font-medium text-blue-900 dark:text-blue-100">
              {getFieldConfigForMatchType(activeFilter.matchType)?.getLabel(
                dict
              )}
              : {activeFilter.query}
            </span>
            <button
              type="button"
              onClick={handleClearFilter}
              className="ml-auto p-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors"
              aria-label={tr(
                "pages.planning.sidebar.assignment.clearFilter",
                dict
              )}
            >
              <HiX className="w-3 h-3 text-blue-700 dark:text-blue-300" />
            </button>
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="p-2 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <HiSearch className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={tr(translations.search, dict)}
            className={twMerge(
              "block w-full pl-10 pr-3 py-2 text-sm",
              "border border-gray-300 dark:border-gray-600",
              "rounded-lg",
              "bg-white dark:bg-gray-700",
              "text-gray-900 dark:text-white",
              "placeholder-gray-400 dark:placeholder-gray-500",
              "focus:border-blue-500 dark:focus:border-blue-400",
              "focus:outline-none",
              "transition-colors"
            )}
          />
        </div>
        {showMinCharsHint && (
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 px-1">
            {tr("pages.planning.sidebar.assignment.searchMinChars", dict)}
          </div>
        )}
      </div>

      {/* Content: Grouped Results or Item List */}
      <div
        ref={listRef}
        role="presentation"
        className="max-h-75 overflow-y-auto"
        onMouseLeave={() => setHighlightedIndex(-1)}
      >
        {isGroupedMode ? (
          <GroupedResultsContent
            searchResults={groupedResults}
            selectedIndex={highlightedIndex}
            debouncedQuery={debouncedQuery}
            dict={dict}
            noResultsText={tr(translations.noResults, dict)}
            fields={fields as readonly FieldConfig<BaseOption, TMatchType>[]}
            onMatchTypeSelect={handleMatchTypeSelect}
            onMouseEnter={setHighlightedIndex}
          />
        ) : (
          <FilteredItemsList
            filteredItems={filteredItems}
            selectedId={selectedId}
            highlightedIndex={highlightedIndex}
            dict={dict}
            noResultsText={tr(translations.noResults, dict)}
            canSelect={canSelect}
            renderCard={renderCard}
            onSelect={handleSelect}
            onHighlight={setHighlightedIndex}
          />
        )}
      </div>
    </div>
  ) : null;

  return (
    <div ref={containerRef} className="relative">
      {/* Label */}
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {label}
        </Label>
        {labelRightElement}
      </div>

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={toggleDropdown}
        className={twMerge(
          "w-full text-left bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
          selectedItem && !isOpen ? "p-2" : "px-3 py-2"
        )}
      >
        {selectedItem && !isOpen ? (
          renderSelectedButton(selectedItem, dict)
        ) : (
          <div className="flex items-center justify-between">
            <span
              className={twMerge(
                "font-medium truncate text-sm",
                selectedItem ? "text-gray-900 dark:text-white" : "text-gray-500"
              )}
            >
              {selectedItem ? fields[0]?.getValue(selectedItem) : placeholder}
            </span>
            <HiChevronDown
              className={twMerge(
                "w-4 h-4 text-gray-500 transition-transform shrink-0",
                isOpen && "rotate-180"
              )}
            />
          </div>
        )}
      </button>

      {/* Dropdown */}
      {dropdownContent}
    </div>
  );
}
