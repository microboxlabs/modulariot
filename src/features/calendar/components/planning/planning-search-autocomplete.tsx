"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { HiSearch, HiX } from "react-icons/hi";
import { FaTruck, FaMapMarkerAlt, FaCalendarAlt } from "react-icons/fa";
import { twMerge } from "tailwind-merge";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { SelectedService } from "./planning-selection-context";

type MatchType = "id" | "cliente" | "origen" | "destino" | "lugarCarguio" | "permanencia" | "tipoViaje";

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
  hasActiveFilter?: boolean;
  isLoading?: boolean;
}

const DEBOUNCE_MS = 300;
const MIN_CHARACTERS = 2;
const MAX_DROPDOWN_HEIGHT = 300;

export function PlanningSearchAutocomplete({
  dict,
  services,
  onSelect,
  onMatchTypeSelect,
  onClear,
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

  // Search logic: group by match type and count matches
  const searchResults = useMemo(() => {
    if (debouncedQuery.length < MIN_CHARACTERS) {
      return [];
    }

    const lowerQuery = debouncedQuery.toLowerCase();
    const matchCounts = new Map<MatchType, Set<string>>();

    for (const service of services) {
      // Search by ID
      if (service.id.toLowerCase().includes(lowerQuery)) {
        if (!matchCounts.has("id")) {
          matchCounts.set("id", new Set());
        }
        matchCounts.get("id")!.add(service.id);
      }

      // Search by cliente
      if (service.cliente.toLowerCase().includes(lowerQuery)) {
        if (!matchCounts.has("cliente")) {
          matchCounts.set("cliente", new Set());
        }
        matchCounts.get("cliente")!.add(service.id);
      }

      // Search by origen
      if (service.origen.toLowerCase().includes(lowerQuery)) {
        if (!matchCounts.has("origen")) {
          matchCounts.set("origen", new Set());
        }
        matchCounts.get("origen")!.add(service.id);
      }

      // Search by destino
      if (service.destino.toLowerCase().includes(lowerQuery)) {
        if (!matchCounts.has("destino")) {
          matchCounts.set("destino", new Set());
        }
        matchCounts.get("destino")!.add(service.id);
      }

      // Search by lugarCarguio
      if (service.lugarCarguio.toLowerCase().includes(lowerQuery)) {
        if (!matchCounts.has("lugarCarguio")) {
          matchCounts.set("lugarCarguio", new Set());
        }
        matchCounts.get("lugarCarguio")!.add(service.id);
      }

      // Search by permanencia
      if (service.permanencia.toLowerCase().includes(lowerQuery)) {
        if (!matchCounts.has("permanencia")) {
          matchCounts.set("permanencia", new Set());
        }
        matchCounts.get("permanencia")!.add(service.id);
      }

      // Search by tipoViaje
      if (service.tipoViaje.toLowerCase().includes(lowerQuery)) {
        if (!matchCounts.has("tipoViaje")) {
          matchCounts.set("tipoViaje", new Set());
        }
        matchCounts.get("tipoViaje")!.add(service.id);
      }
    }

    // Convert to array of grouped results
    const results: GroupedSearchResult[] = Array.from(matchCounts.entries())
      .map(([matchType, serviceIds]) => ({
        matchType,
        count: serviceIds.size,
      }))
      .filter((result) => result.count > 0)
      .sort((a, b) => b.count - a.count); // Sort by count descending

    return results;
  }, [debouncedQuery, services]);

  // Update dropdown visibility
  useEffect(() => {
    if (debouncedQuery.length >= MIN_CHARACTERS && searchResults.length > 0) {
      setIsOpen(true);
    } else if (debouncedQuery.length >= MIN_CHARACTERS && searchResults.length === 0 && !isLoadingState) {
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
      return () => document.removeEventListener("mousedown", handleClickOutside);
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
      lugarCarguio: tr("pages.planning.sidebar.search.matchType.lugarCarguio", dict),
      permanencia: tr("pages.planning.sidebar.search.matchType.permanencia", dict),
      tipoViaje: tr("pages.planning.sidebar.search.matchType.tipoViaje", dict),
    };
    return labels[matchType];
  };

  // Helper to get translated location code or return original if not found
  const getLocationLabel = (code: string): string => {
    const locationKey = `pages.planning.sidebar.search.locationCodes.${code}`;
    const translated = tr(locationKey, dict);
    // If translation exists and is different from key, return it; otherwise return original code
    return translated !== locationKey ? translated : code;
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
  const showClearButton = false; // query.length > 0 || hasActiveFilter;

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
            "focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400",
            "focus:border-blue-500 dark:focus:border-blue-400",
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
          {isLoadingState ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {tr("pages.planning.sidebar.search.loading", dict)}
            </div>
          ) : searchResults.length > 0 ? (
            <ul className="py-1" role="listbox">
              {searchResults.map((result, index) => (
                <li
                  key={result.matchType}
                  role="option"
                  aria-selected={index === selectedIndex}
                  onClick={() => handleMatchTypeSelect(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={twMerge(
                    "px-4 py-2 cursor-pointer flex items-center gap-2",
                    "transition-colors",
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
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              <div>{tr("pages.planning.sidebar.search.noResults", dict)}</div>
              <div className="mt-1 text-xs">
                {tr("pages.planning.sidebar.search.noResultsFor", dict)} "{debouncedQuery}"
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
