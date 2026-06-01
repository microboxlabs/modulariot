"use client";

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { HiSearch, HiX } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import { useCalendarHost } from "../../context/calendar-provider";

/**
 * A searchable attribute the autocomplete groups matches by. The host supplies
 * one entry per field it wants searchable, keeping all domain field knowledge
 * (which keys exist, their labels and icons) out of the package.
 */
export interface SearchAutocompleteField<T> {
  /** Stable key for this attribute (e.g. "cliente"). */
  matchType: string;
  /** Read the comparable string off an item (undefined → not searchable). */
  get: (item: T) => string | undefined;
  /** Display label for the grouped result row (resolved by the host). */
  label: string;
  /** Optional leading icon for the grouped result row. */
  icon?: ReactNode;
}

interface GroupedSearchResult {
  matchType: string;
  count: number;
}

export interface PlanningSearchAutocompleteProps<T extends { id: string }> {
  services: T[];
  fields: ReadonlyArray<SearchAutocompleteField<T>>;
  onMatchTypeSelect?: (matchType: string, query: string) => void;
  onClear?: () => void;
  // Fired with the debounced query (after MIN_CHARACTERS threshold; empty
  // string before that). The host threads this into its data request so search
  // reaches items beyond the current page.
  onQueryChange?: (q: string) => void;
  isLoading?: boolean;
}

const DEBOUNCE_MS = 300;
const MIN_CHARACTERS = 2;

/**
 * Convert match counts map to sorted grouped results.
 */
function toGroupedResults(
  matchCounts: Map<string, Set<string>>
): GroupedSearchResult[] {
  return Array.from(matchCounts.entries())
    .map(([matchType, ids]) => ({ matchType, count: ids.size }))
    .filter((result) => result.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * Dropdown content component - renders loading, results, or empty state.
 */
function DropdownContent({
  isLoading,
  searchResults,
  selectedIndex,
  debouncedQuery,
  loadingText,
  noResultsText,
  noResultsForText,
  onMatchTypeSelect,
  onMouseEnter,
  labelFor,
  iconFor,
}: Readonly<{
  isLoading: boolean;
  searchResults: GroupedSearchResult[];
  selectedIndex: number;
  debouncedQuery: string;
  loadingText: string;
  noResultsText: string;
  noResultsForText: string;
  onMatchTypeSelect: (result: GroupedSearchResult) => void;
  onMouseEnter: (index: number) => void;
  labelFor: (matchType: string) => string;
  iconFor: (matchType: string) => ReactNode;
}>) {
  if (isLoading) {
    return (
      <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        {loadingText}
      </div>
    );
  }

  if (searchResults.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <div>{noResultsText}</div>
        <div className="mt-1 text-xs">
          {noResultsForText} "{debouncedQuery}"
        </div>
      </div>
    );
  }

  return (
    <ul className="py-1" role="listbox">
      {searchResults.map((result, index) => (
        <li key={result.matchType}>
          <button
            type="button"
            tabIndex={index === selectedIndex ? 0 : -1}
            onClick={() => onMatchTypeSelect(result)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onMatchTypeSelect(result);
              }
            }}
            onMouseEnter={() => onMouseEnter(index)}
            onFocus={() => onMouseEnter(index)}
            onBlur={() => {}}
            className={twMerge(
              "w-full text-left px-4 py-2 cursor-pointer flex items-center gap-2",
              "transition-colors border-0 bg-transparent",
              index === selectedIndex
                ? "bg-blue-50 dark:bg-blue-900/30"
                : "hover:bg-gray-50 dark:hover:bg-gray-700"
            )}
          >
            <div className="flex items-center justify-center w-5 h-5 shrink-0">
              {iconFor(result.matchType)}
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {labelFor(result.matchType)}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ({result.count})
              </span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Generic, domain-agnostic search box with grouped autocomplete. Matches are
 * grouped by the {@link SearchAutocompleteField} entries the host supplies;
 * generic chrome strings come from the host i18n contract. Faithful to the
 * freight planning-search-autocomplete look.
 */
export function PlanningSearchAutocomplete<T extends { id: string }>({
  services,
  fields,
  onMatchTypeSelect,
  onClear,
  onQueryChange,
  isLoading: externalIsLoading = false,
}: Readonly<PlanningSearchAutocompleteProps<T>>) {
  const host = useCalendarHost();
  const t = useCallback(
    (path: string) => host.i18n.tr(path, host.i18n.dict),
    [host]
  );

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Combine external loading state with internal debounce loading
  const isLoadingState = externalIsLoading || isLoading;
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fieldByType = useMemo(() => {
    const map = new Map<string, SearchAutocompleteField<T>>();
    for (const field of fields) map.set(field.matchType, field);
    return map;
  }, [fields]);

  // Debounce the query
  useEffect(() => {
    if (query.length < MIN_CHARACTERS) {
      setDebouncedQuery("");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setIsLoading(false);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  // Surface the debounced query to the host so it can re-fetch.
  useEffect(() => {
    onQueryChange?.(debouncedQuery);
  }, [debouncedQuery, onQueryChange]);

  // Search logic: group by match type and count matching items.
  const searchResults = useMemo(() => {
    if (debouncedQuery.length < MIN_CHARACTERS) {
      return [];
    }

    const lowerQuery = debouncedQuery.toLowerCase();
    const matchCounts = new Map<string, Set<string>>();

    for (const service of services) {
      for (const field of fields) {
        const value = field.get(service);
        if (typeof value !== "string") continue;
        if (value.toLowerCase().includes(lowerQuery)) {
          let set = matchCounts.get(field.matchType);
          if (!set) {
            set = new Set();
            matchCounts.set(field.matchType, set);
          }
          set.add(service.id);
        }
      }
    }

    return toGroupedResults(matchCounts);
  }, [debouncedQuery, services, fields]);

  // Update dropdown visibility
  useEffect(() => {
    if (debouncedQuery.length >= MIN_CHARACTERS && searchResults.length > 0) {
      setIsOpen(true);
    } else if (
      debouncedQuery.length >= MIN_CHARACTERS &&
      searchResults.length === 0 &&
      !isLoadingState
    ) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
    setSelectedIndex(0);
  }, [debouncedQuery, searchResults.length, isLoadingState]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Handle match type selection
  const handleMatchTypeSelect = useCallback(
    (result: GroupedSearchResult) => {
      onMatchTypeSelect?.(result.matchType, debouncedQuery);
      // Clear the query and refocus input for next search
      setQuery("");
      setIsOpen(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    },
    [onMatchTypeSelect, debouncedQuery]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || searchResults.length === 0) {
        if (e.key === "Escape") {
          setQuery("");
          if (onClear) onClear();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < searchResults.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter":
          e.preventDefault();
          if (searchResults[selectedIndex]) {
            handleMatchTypeSelect(searchResults[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setQuery("");
          if (onClear) onClear();
          break;
        case "Tab":
          if (searchResults[selectedIndex]) {
            handleMatchTypeSelect(searchResults[selectedIndex]);
          }
          break;
      }
    },
    [isOpen, searchResults, selectedIndex, onClear, handleMatchTypeSelect]
  );

  const labelFor = useCallback(
    (matchType: string) => fieldByType.get(matchType)?.label ?? matchType,
    [fieldByType]
  );
  const iconFor = useCallback(
    (matchType: string): ReactNode => fieldByType.get(matchType)?.icon ?? null,
    [fieldByType]
  );

  const showHint = query.length === 1;

  return (
    <div ref={containerRef} className="relative">
      {/* Search Input */}
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
          onFocus={() => {
            if (debouncedQuery.length >= MIN_CHARACTERS) {
              setIsOpen(true);
            }
          }}
          placeholder={t("pages.planning.sidebar.searchPlaceholder")}
          className={twMerge(
            "block w-full pl-10 pr-10 py-2 text-sm",
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
        {isLoadingState && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 dark:border-t-blue-400 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Hint for minimum characters */}
      {showHint && (
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 px-1">
          {t("pages.planning.sidebar.search.minCharacters")}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={twMerge(
            "absolute z-50 w-full mt-1",
            "bg-white dark:bg-gray-800",
            "border border-gray-200 dark:border-gray-700",
            "rounded-lg shadow-lg",
            "max-h-[300px] overflow-y-auto"
          )}
        >
          <DropdownContent
            isLoading={isLoadingState}
            searchResults={searchResults}
            selectedIndex={selectedIndex}
            debouncedQuery={debouncedQuery}
            loadingText={t("pages.planning.sidebar.search.loading")}
            noResultsText={t("pages.planning.sidebar.search.noResults")}
            noResultsForText={t("pages.planning.sidebar.search.noResultsFor")}
            onMatchTypeSelect={handleMatchTypeSelect}
            onMouseEnter={setSelectedIndex}
            labelFor={labelFor}
            iconFor={iconFor}
          />
        </div>
      )}
    </div>
  );
}
