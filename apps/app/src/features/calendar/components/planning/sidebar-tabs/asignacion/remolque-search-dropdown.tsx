"use client";

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  type KeyboardEvent,
} from "react";
import { Label } from "flowbite-react";
import {
  HiSearch,
  HiChevronDown,
  HiCheck,
  HiExclamation,
  HiX,
  HiTruck,
  HiLocationMarker,
  HiClock,
  HiStatusOnline,
  HiScale,
} from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

const DEBOUNCE_MS = 300;
const MIN_CHARACTERS = 2;

export type RemolqueTipo =
  | "ARFJ"
  | "BAT"
  | "C100"
  | "CB20"
  | "CB40"
  | "CB60"
  | "CB70"
  | "CB80"
  | "CBJ"
  | "CBJE"
  | "CFX"
  | "EST"
  | "FURG"
  | "PNE6"
  | "R10T"
  | "R15T"
  | "R28T"
  | "RBAJ"
  | "RDRO"
  | "REM"
  | "REXT"
  | "RGEN"
  | "RMOD"
  | "RPAL"
  | "RPNE"
  | "S32"
  | "SI20"
  | "SI40"
  | "SIDE"
  | "SIL";

export interface RemolqueOption {
  id: string;
  plate: string;
  tipo: RemolqueTipo;
  estado: "disponible" | "ocupado";
  gpsIntegrado: boolean;
  estadoGps: "online" | "offline";
  capacidadKg: number;
  ultimoMantenimiento: string;
  kilometraje: number;
  problemasReportados: number;
}

// Match types for remolque search
type RemolqueMatchType =
  | "plate"
  | "tipo"
  | "estado"
  | "gpsIntegrado"
  | "capacidadKg"
  | "kilometraje";

interface GroupedSearchResult {
  matchType: RemolqueMatchType;
  count: number;
}

interface ActiveFilter {
  matchType: RemolqueMatchType;
  query: string;
}

interface RemolqueSearchDropdownProps {
  readonly label: string;
  readonly remolques: RemolqueOption[];
  readonly selectedRemolqueId: string;
  readonly onSelect: (remolqueId: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly dict: I18nRecord;
}

interface RemolqueCardProps {
  readonly remolque: RemolqueOption;
  readonly isSelected: boolean;
  readonly isHighlighted: boolean;
  readonly dict: I18nRecord;
  readonly onClick: () => void;
  readonly onMouseEnter: () => void;
}

const SEARCHABLE_FIELDS: readonly RemolqueMatchType[] = [
  "plate",
  "tipo",
  "estado",
  "gpsIntegrado",
  "capacidadKg",
  "kilometraje",
] as const;

function getFieldValue(
  remolque: RemolqueOption,
  field: RemolqueMatchType
): string {
  switch (field) {
    case "plate":
      return remolque.plate;
    case "tipo":
      return remolque.tipo;
    case "estado":
      return remolque.estado;
    case "gpsIntegrado":
      return remolque.gpsIntegrado ? "gps integrado" : "no integrado";
    case "capacidadKg":
      return String(remolque.capacidadKg);
    case "kilometraje":
      return String(remolque.kilometraje);
    default:
      return "";
  }
}

function getMatchTypeLabel(
  matchType: RemolqueMatchType,
  dict: I18nRecord
): string {
  const labels: Record<RemolqueMatchType, string> = {
    plate: tr(
      "pages.planning.sidebar.assignment.remolqueSearchFields.plate",
      dict
    ),
    tipo: tr(
      "pages.planning.sidebar.assignment.remolqueSearchFields.type",
      dict
    ),
    estado: tr(
      "pages.planning.sidebar.assignment.remolqueSearchFields.status",
      dict
    ),
    gpsIntegrado: tr(
      "pages.planning.sidebar.assignment.remolqueSearchFields.gps",
      dict
    ),
    capacidadKg: tr(
      "pages.planning.sidebar.assignment.remolqueSearchFields.capacity",
      dict
    ),
    kilometraje: tr(
      "pages.planning.sidebar.assignment.remolqueSearchFields.mileage",
      dict
    ),
  };
  return labels[matchType];
}

function getMatchTypeIcon(matchType: RemolqueMatchType): React.ReactNode {
  const iconClassName = "w-4 h-4 text-gray-600 dark:text-gray-400";
  const icons: Record<RemolqueMatchType, React.ReactNode> = {
    plate: <HiTruck className={iconClassName} />,
    tipo: <HiTruck className={iconClassName} />,
    estado: <HiStatusOnline className={iconClassName} />,
    gpsIntegrado: <HiLocationMarker className={iconClassName} />,
    capacidadKg: <HiScale className={iconClassName} />,
    kilometraje: <HiClock className={iconClassName} />,
  };
  return icons[matchType];
}

/**
 * Calculate grouped search results showing count per field type
 */
function calculateGroupedResults(
  remolques: RemolqueOption[],
  query: string
): GroupedSearchResult[] {
  if (query.length < MIN_CHARACTERS) {
    return [];
  }

  const lowerQuery = query.toLowerCase();
  const matchCounts = new Map<RemolqueMatchType, Set<string>>();

  for (const remolque of remolques) {
    for (const field of SEARCHABLE_FIELDS) {
      const fieldValue = getFieldValue(remolque, field);
      if (fieldValue.toLowerCase().includes(lowerQuery)) {
        if (!matchCounts.has(field)) {
          matchCounts.set(field, new Set());
        }
        matchCounts.get(field)!.add(remolque.id);
      }
    }
  }

  return Array.from(matchCounts.entries())
    .map(([matchType, remolqueIds]) => ({
      matchType,
      count: remolqueIds.size,
    }))
    .filter((result) => result.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * Filter remolques by a specific field type
 */
function filterRemolquesByField(
  remolques: RemolqueOption[],
  query: string,
  matchType: RemolqueMatchType
): RemolqueOption[] {
  if (!query.trim()) {
    return remolques;
  }

  const lowerQuery = query.toLowerCase();

  return remolques.filter((remolque) => {
    const fieldValue = getFieldValue(remolque, matchType);
    return fieldValue.toLowerCase().includes(lowerQuery);
  });
}

function RemolqueCard({
  remolque,
  isSelected,
  isHighlighted,
  dict,
  onClick,
  onMouseEnter,
}: RemolqueCardProps) {
  const isAvailable = remolque.estado === "disponible";
  const isGpsIntegrado = remolque.gpsIntegrado;
  const isOnline = remolque.estadoGps === "online";

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={twMerge(
        "w-full text-left p-3 transition-colors",
        isHighlighted && "bg-blue-50 dark:bg-blue-900/30",
        isSelected && !isHighlighted && "bg-gray-50 dark:bg-gray-700/50",
        !isAvailable && "opacity-60"
      )}
    >
      {/* Header: Plate + Type + GPS Status */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isSelected && (
              <HiCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            )}
            <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
              {remolque.plate}
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {tr(
              `pages.planning.sidebar.assignment.remolqueType.${remolque.tipo}`,
              dict
            )}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isGpsIntegrado && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 inline-flex items-center gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-green-200 dark:bg-green-800/50">
                <HiCheck className="w-2.5 h-2.5" />
              </span>
              {tr("pages.planning.sidebar.assignment.gpsIntegrated", dict)}
            </span>
          )}
          {isGpsIntegrado && (
            <span className="flex items-center gap-1 text-[10px]">
              <span
                className={twMerge(
                  "w-2 h-2 rounded-full",
                  isOnline ? "bg-green-500" : "bg-gray-400"
                )}
              />
              <span
                className={twMerge(
                  "font-medium",
                  isOnline
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-500 dark:text-gray-400"
                )}
              >
                {isOnline
                  ? tr("pages.planning.sidebar.assignment.online", dict)
                  : tr("pages.planning.sidebar.assignment.offline", dict)}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Stats Column */}
      <div className="flex flex-col gap-0.5 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tr("pages.planning.sidebar.assignment.capacity", dict)}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {remolque.capacidadKg.toLocaleString()} kg
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tr("pages.planning.sidebar.assignment.lastMaintenance", dict)}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {remolque.ultimoMantenimiento}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tr("pages.planning.sidebar.assignment.mileage", dict)}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {remolque.kilometraje.toLocaleString()} km
          </span>
        </div>
      </div>

      {/* Reported problems - only show if there are any */}
      {remolque.problemasReportados > 0 && (
        <div className="flex flex-wrap items-center gap-1 mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700">
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            <HiExclamation className="w-3 h-3" />
            {tr("pages.planning.sidebar.assignment.reportedProblems", dict)} (
            {remolque.problemasReportados})
          </span>
        </div>
      )}
    </button>
  );
}

/**
 * Grouped results dropdown content - shows match types with counts
 */
function GroupedResultsContent({
  searchResults,
  selectedIndex,
  debouncedQuery,
  dict,
  onMatchTypeSelect,
  onMouseEnter,
}: Readonly<{
  searchResults: GroupedSearchResult[];
  selectedIndex: number;
  debouncedQuery: string;
  dict: I18nRecord;
  onMatchTypeSelect: (result: GroupedSearchResult) => void;
  onMouseEnter: (index: number) => void;
}>) {
  if (searchResults.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <div>
          {tr("pages.planning.sidebar.assignment.noRemolquesFound", dict)}
        </div>
        <div className="mt-1 text-xs">
          {tr("pages.planning.sidebar.assignment.searchNoResultsFor", dict)}{" "}
          &ldquo;{debouncedQuery}&rdquo;
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
              {getMatchTypeIcon(result.matchType)}
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {getMatchTypeLabel(result.matchType, dict)}
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

export function RemolqueSearchDropdown({
  label,
  remolques,
  selectedRemolqueId,
  onSelect,
  placeholder,
  disabled = false,
  dict,
}: RemolqueSearchDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter | null>(null);

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
    () => calculateGroupedResults(remolques, debouncedQuery),
    [remolques, debouncedQuery]
  );

  // Filter remolques when a field filter is active
  const filteredRemolques = useMemo(() => {
    if (!activeFilter) {
      return remolques;
    }
    return filterRemolquesByField(
      remolques,
      activeFilter.query,
      activeFilter.matchType
    );
  }, [remolques, activeFilter]);

  // Determine if we're in "grouped mode" (showing field types) or "list mode" (showing remolques)
  const isGroupedMode =
    debouncedQuery.length >= MIN_CHARACTERS && !activeFilter;

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [groupedResults.length, filteredRemolques.length, isGroupedMode]);

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
    (remolqueId: string) => {
      onSelect(remolqueId);
      setIsOpen(false);
      setQuery("");
      setActiveFilter(null);
    },
    [onSelect]
  );

  const handleMatchTypeSelect = useCallback(
    (result: GroupedSearchResult) => {
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
      if (isGroupedMode) {
        // Keyboard navigation in grouped mode
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
      } else {
        // Keyboard navigation in list mode
        if (filteredRemolques.length === 0) {
          if (e.key === "Escape") {
            if (activeFilter) {
              handleClearFilter();
            } else {
              setIsOpen(false);
              setQuery("");
            }
          }
          return;
        }

        switch (e.key) {
          case "ArrowDown":
            e.preventDefault();
            isKeyboardNavigation.current = true;
            setHighlightedIndex((prev) =>
              prev < filteredRemolques.length - 1 ? prev + 1 : prev
            );
            break;
          case "ArrowUp":
            e.preventDefault();
            isKeyboardNavigation.current = true;
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
            break;
          case "Enter":
            e.preventDefault();
            if (filteredRemolques[highlightedIndex]) {
              const remolque = filteredRemolques[highlightedIndex];
              if (remolque.estado === "disponible") {
                handleSelect(remolque.id);
              }
            }
            break;
          case "Escape":
            e.preventDefault();
            if (activeFilter) {
              handleClearFilter();
            } else {
              setIsOpen(false);
              setQuery("");
            }
            break;
          case "Tab":
            if (filteredRemolques[highlightedIndex]) {
              const remolque = filteredRemolques[highlightedIndex];
              if (remolque.estado === "disponible") {
                handleSelect(remolque.id);
              }
            }
            break;
        }
      }
    },
    [
      isGroupedMode,
      groupedResults,
      filteredRemolques,
      highlightedIndex,
      activeFilter,
      handleSelect,
      handleMatchTypeSelect,
      handleClearFilter,
    ]
  );

  const selectedRemolque = remolques.find((r) => r.id === selectedRemolqueId);

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
            {getMatchTypeIcon(activeFilter.matchType)}
            <span className="text-xs font-medium text-blue-900 dark:text-blue-100">
              {getMatchTypeLabel(activeFilter.matchType, dict)}:{" "}
              {activeFilter.query}
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
            placeholder={tr(
              "pages.planning.sidebar.assignment.searchRemolque",
              dict
            )}
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

      {/* Content: Grouped Results or Remolque List */}
      <div
        ref={listRef}
        className="max-h-75 overflow-y-auto"
        onMouseLeave={() => setHighlightedIndex(-1)}
      >
        {isGroupedMode ? (
          <GroupedResultsContent
            searchResults={groupedResults}
            selectedIndex={highlightedIndex}
            debouncedQuery={debouncedQuery}
            dict={dict}
            onMatchTypeSelect={handleMatchTypeSelect}
            onMouseEnter={setHighlightedIndex}
          />
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-600">
            {filteredRemolques.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {tr("pages.planning.sidebar.assignment.noRemolquesFound", dict)}
              </div>
            ) : (
              filteredRemolques.map((remolque, index) => (
                <div key={remolque.id} data-index={index}>
                  <RemolqueCard
                    remolque={remolque}
                    isSelected={remolque.id === selectedRemolqueId}
                    isHighlighted={index === highlightedIndex}
                    dict={dict}
                    onClick={() => {
                      if (remolque.estado === "disponible") {
                        handleSelect(remolque.id);
                      }
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  />
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <div ref={containerRef} className="relative">
        {/* Label */}
        <div className="flex items-center justify-between mb-1">
          <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {label}
          </Label>
        </div>

        {/* Trigger Button */}
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={toggleDropdown}
          className={twMerge(
            "w-full text-left bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
            selectedRemolque && !isOpen ? "p-2" : "px-3 py-2"
          )}
        >
          {selectedRemolque && !isOpen ? (
            /* Show remolque info inside button when selected */
            <div className="flex flex-col">
              {/* Header with plate, type, GPS status, and chevron */}
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <HiCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
                      {selectedRemolque.plate}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {tr(
                      `pages.planning.sidebar.assignment.remolqueType.${selectedRemolque.tipo}`,
                      dict
                    )}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-center gap-1.5">
                    {selectedRemolque.gpsIntegrado && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-green-200 dark:bg-green-800/50">
                          <HiCheck className="w-2.5 h-2.5" />
                        </span>
                        {tr(
                          "pages.planning.sidebar.assignment.gpsIntegrated",
                          dict
                        )}
                      </span>
                    )}
                    <HiChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                  </div>
                  {selectedRemolque.gpsIntegrado && (
                    <span className="flex items-center gap-1 text-[10px]">
                      <span
                        className={twMerge(
                          "w-2 h-2 rounded-full",
                          selectedRemolque.estadoGps === "online"
                            ? "bg-green-500"
                            : "bg-gray-400"
                        )}
                      />
                      <span
                        className={twMerge(
                          "font-medium",
                          selectedRemolque.estadoGps === "online"
                            ? "text-green-600 dark:text-green-400"
                            : "text-gray-500 dark:text-gray-400"
                        )}
                      >
                        {selectedRemolque.estadoGps === "online"
                          ? tr("pages.planning.sidebar.assignment.online", dict)
                          : tr(
                              "pages.planning.sidebar.assignment.offline",
                              dict
                            )}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex flex-col gap-0.5 text-[11px] pt-1 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">
                    {tr("pages.planning.sidebar.assignment.capacity", dict)}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {selectedRemolque.capacidadKg.toLocaleString()} kg
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">
                    {tr(
                      "pages.planning.sidebar.assignment.lastMaintenance",
                      dict
                    )}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {selectedRemolque.ultimoMantenimiento}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">
                    {tr("pages.planning.sidebar.assignment.mileage", dict)}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {selectedRemolque.kilometraje.toLocaleString()} km
                  </span>
                </div>
              </div>

              {/* Reported problems - only show if there are any */}
              {selectedRemolque.problemasReportados > 0 && (
                <div className="flex flex-wrap items-center gap-1 mt-1 pt-1 border-t border-gray-100 dark:border-gray-700">
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                    <HiExclamation className="w-3 h-3" />
                    {tr(
                      "pages.planning.sidebar.assignment.reportedProblems",
                      dict
                    )}{" "}
                    ({selectedRemolque.problemasReportados})
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* Show simple placeholder or plate when not selected or when open */
            <div className="flex items-center justify-between">
              <span
                className={twMerge(
                  "font-medium truncate text-sm",
                  selectedRemolque
                    ? "text-gray-900 dark:text-white"
                    : "text-gray-500"
                )}
              >
                {selectedRemolque?.plate ?? placeholder}
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
    </>
  );
}
