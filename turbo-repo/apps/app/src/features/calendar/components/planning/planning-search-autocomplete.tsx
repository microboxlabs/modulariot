"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { HiSearch, HiX } from "react-icons/hi";
import { FaTruck, FaMapMarkerAlt, FaCalendarAlt } from "react-icons/fa";
import { twMerge } from "tailwind-merge";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { SelectedService } from "./planning-selection-context";

type MatchType =
  | "id"
  | "cliente"
  | "origen"
  | "destino"
  | "lugarCarguio"
  | "permanencia"
  | "tipoViaje";

interface GroupedSearchResult {
  matchType: MatchType;
  count: number;
}

export interface PlanningSearchAutocompleteProps {
  dict: I18nDictionary;
  services: SelectedService[];
  onSelect?: (service: SelectedService) => void;
  onMatchTypeSelect?: (matchType: MatchType, query: string) => void;
  onClear?: () => void;
  // Fired with the debounced query (after MIN_CHARACTERS threshold; empty
  // string before that). The parent threads this into the tasks request as
  // `q=` so search reaches services beyond the current page.
  onQueryChange?: (q: string) => void;
  hasActiveFilter?: boolean;
  isLoading?: boolean;
}

const DEBOUNCE_MS = 300;
const MIN_CHARACTERS = 2;
const MAX_DROPDOWN_HEIGHT = 300;

/**
 * Searchable fields configuration for service matching.
 *
 * `lugarCarguio` is intentionally omitted: the field is hard-coded to ""
 * in transformTaskToService because it isn't on `KanbanBoardTask`, so it
 * could never produce matches. The MatchType union still includes it for
 * the chip-state path until the workflow surfaces real data.
 */
const SEARCHABLE_FIELDS: readonly MatchType[] = [
  "id",
  "cliente",
  "origen",
  "destino",
  "permanencia",
  "tipoViaje",
] as const;

/**
 * Check if a service field matches the query and add to match counts
 */
function addMatchIfFound(
  service: SelectedService,
  field: MatchType,
  lowerQuery: string,
  matchCounts: Map<MatchType, Set<string>>
): void {
  const fieldValue = service[field];
  if (typeof fieldValue !== "string") return;

  if (fieldValue.toLowerCase().includes(lowerQuery)) {
    if (!matchCounts.has(field)) {
      matchCounts.set(field, new Set());
    }
    matchCounts.get(field)!.add(service.id);
  }
}

/**
 * Convert match counts map to sorted grouped results
 */
function toGroupedResults(
  matchCounts: Map<MatchType, Set<string>>
): GroupedSearchResult[] {
  return Array.from(matchCounts.entries())
    .map(([matchType, serviceIds]) => ({
      matchType,
      count: serviceIds.size,
    }))
    .filter((result) => result.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * Dropdown content component - renders loading, results, or empty state
 */
function DropdownContent({
  isLoading,
  searchResults,
  selectedIndex,
  debouncedQuery,
  dict,
  onMatchTypeSelect,
  onMouseEnter,
  getMatchTypeIcon,
  getMatchTypeLabel,
}: Readonly<{
  isLoading: boolean;
  searchResults: GroupedSearchResult[];
  selectedIndex: number;
  debouncedQuery: string;
  dict: I18nDictionary;
  onMatchTypeSelect: (result: GroupedSearchResult) => void;
  onMouseEnter: (index: number) => void;
  getMatchTypeIcon: (matchType: MatchType) => React.ReactNode;
  getMatchTypeLabel: (matchType: MatchType) => string;
}>) {
  if (isLoading) {
    return (
      <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        {tr("pages.planning.sidebar.search.loading", dict)}
      </div>
    );
  }

  if (searchResults.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <div>{tr("pages.planning.sidebar.search.noResults", dict)}</div>
        <div className="mt-1 text-xs">
          {tr("pages.planning.sidebar.search.noResultsFor", dict)} "
          {debouncedQuery}"
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
              {getMatchTypeIcon(result.matchType)}
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {getMatchTypeLabel(result.matchType)}
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

export function PlanningSearchAutocomplete({
  dict,
  services,
  onSelect,
  onMatchTypeSelect,
  onClear,
  onQueryChange,
  hasActiveFilter = false,
  isLoading: externalIsLoading = false,
}: Readonly<PlanningSearchAutocompleteProps>) {
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

  // Surface the debounced query to the parent so it can re-fetch with `q=`.
  useEffect(() => {
    onQueryChange?.(debouncedQuery);
  }, [debouncedQuery, onQueryChange]);

  // Search logic: group by match type and count matches
  const searchResults = useMemo(() => {
    if (debouncedQuery.length < MIN_CHARACTERS) {
      return [];
    }

    const lowerQuery = debouncedQuery.toLowerCase();
    const matchCounts = new Map<MatchType, Set<string>>();

    for (const service of services) {
      for (const field of SEARCHABLE_FIELDS) {
        addMatchIfFound(service, field, lowerQuery, matchCounts);
      }
    }

    return toGroupedResults(matchCounts);
  }, [debouncedQuery, services]);

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
      if (onMatchTypeSelect) {
        onMatchTypeSelect(result.matchType, debouncedQuery);
      }
      // Clear the query and refocus input for next search
      setQuery("");
      setIsOpen(false);
      // Use setTimeout to ensure the input is cleared before focusing
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

  const handleClear = useCallback(() => {
    setQuery("");
    setIsOpen(false);
    if (onClear) onClear();
    inputRef.current?.focus();
  }, [onClear]);

  const getMatchTypeLabel = (matchType: MatchType): string => {
    const labels: Record<MatchType, string> = {
      id: tr("pages.planning.sidebar.search.matchType.id", dict),
      cliente: tr("pages.planning.sidebar.search.matchType.cliente", dict),
      origen: tr("pages.planning.sidebar.search.matchType.origen", dict),
      destino: tr("pages.planning.sidebar.search.matchType.destino", dict),
      lugarCarguio: tr(
        "pages.planning.sidebar.search.matchType.lugarCarguio",
        dict
      ),
      permanencia: tr(
        "pages.planning.sidebar.search.matchType.permanencia",
        dict
      ),
      tipoViaje: tr("pages.planning.sidebar.search.matchType.tipoViaje", dict),
    };
    return labels[matchType];
  };

  const getMatchTypeIcon = (matchType: MatchType): React.ReactNode => {
    const iconClassName = "w-4 h-4 text-gray-600 dark:text-gray-400";
    const icons: Record<MatchType, React.ReactNode> = {
      id: <FaTruck className={iconClassName} />,
      cliente: <FaTruck className={iconClassName} />,
      origen: <FaMapMarkerAlt className={iconClassName} />,
      destino: <FaMapMarkerAlt className={iconClassName} />,
      lugarCarguio: <FaMapMarkerAlt className={iconClassName} />,
      permanencia: <FaCalendarAlt className={iconClassName} />,
      tipoViaje: <FaTruck className={iconClassName} />,
    };
    return icons[matchType];
  };

  const showHint = query.length === 1;
  // Clear button commented out - removal is handled by tag manager only
  const showClearButton = false;

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
          placeholder={tr("pages.planning.sidebar.searchPlaceholder", dict)}
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
        {showClearButton && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
            aria-label={tr("pages.planning.sidebar.search.clear", dict)}
          >
            <HiX className="w-4 h-4" />
          </button>
        )}
        {isLoadingState && !showClearButton && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 dark:border-t-blue-400 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Hint for minimum characters */}
      {showHint && (
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 px-1">
          {tr("pages.planning.sidebar.search.minCharacters", dict)}
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
            dict={dict}
            onMatchTypeSelect={handleMatchTypeSelect}
            onMouseEnter={setSelectedIndex}
            getMatchTypeIcon={getMatchTypeIcon}
            getMatchTypeLabel={getMatchTypeLabel}
          />
        </div>
      )}
    </div>
  );
}
