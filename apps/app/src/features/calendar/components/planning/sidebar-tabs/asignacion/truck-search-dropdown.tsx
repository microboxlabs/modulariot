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
} from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

const DEBOUNCE_MS = 300;
const MIN_CHARACTERS = 2;

export interface CamionOption {
  id: string;
  plate: string;
  marca: string;
  tipo: "camion" | "furgon" | "camioneta";
  estado: "disponible" | "ocupado";
  gpsIntegrado: boolean;
  estadoGps: "online" | "offline";
  viajesPrevios: number;
  ultimoViaje: string;
  perdidasSenal: number;
  latitude: number | null;
  longitude: number | null;
  heading: number;
}

// Match types for truck search
type TruckMatchType =
  | "plate"
  | "marca"
  | "tipo"
  | "estado"
  | "gpsIntegrado"
  | "viajesPrevios";

interface GroupedSearchResult {
  matchType: TruckMatchType;
  count: number;
}

interface ActiveFilter {
  matchType: TruckMatchType;
  query: string;
}

interface TruckSearchDropdownProps {
  readonly label: string;
  readonly trucks: CamionOption[];
  readonly selectedTruckId: string;
  readonly onSelect: (truckId: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly dict: I18nRecord;
  readonly labelRightElement?: React.ReactNode;
}

interface TruckCardProps {
  readonly truck: CamionOption;
  readonly isSelected: boolean;
  readonly isHighlighted: boolean;
  readonly dict: I18nRecord;
  readonly onClick: () => void;
  readonly onMouseEnter: () => void;
}

const SEARCHABLE_FIELDS: readonly TruckMatchType[] = [
  "plate",
  "marca",
  "tipo",
  "estado",
  "gpsIntegrado",
  "viajesPrevios",
] as const;

function getFieldValue(truck: CamionOption, field: TruckMatchType): string {
  switch (field) {
    case "plate":
      return truck.plate;
    case "marca":
      return truck.marca;
    case "tipo":
      return truck.tipo;
    case "estado":
      return truck.estado;
    case "gpsIntegrado":
      return truck.gpsIntegrado ? "gps integrado" : "no integrado";
    case "viajesPrevios":
      return String(truck.viajesPrevios);
    default:
      return "";
  }
}

function getMatchTypeLabel(
  matchType: TruckMatchType,
  dict: I18nRecord
): string {
  const labels: Record<TruckMatchType, string> = {
    plate: tr(
      "pages.planning.sidebar.assignment.truckSearchFields.plate",
      dict
    ),
    marca: tr(
      "pages.planning.sidebar.assignment.truckSearchFields.brand",
      dict
    ),
    tipo: tr("pages.planning.sidebar.assignment.truckSearchFields.type", dict),
    estado: tr(
      "pages.planning.sidebar.assignment.truckSearchFields.status",
      dict
    ),
    gpsIntegrado: tr(
      "pages.planning.sidebar.assignment.truckSearchFields.gps",
      dict
    ),
    viajesPrevios: tr(
      "pages.planning.sidebar.assignment.truckSearchFields.trips",
      dict
    ),
  };
  return labels[matchType];
}

function getMatchTypeIcon(matchType: TruckMatchType): React.ReactNode {
  const iconClassName = "w-4 h-4 text-gray-600 dark:text-gray-400";
  const icons: Record<TruckMatchType, React.ReactNode> = {
    plate: <HiTruck className={iconClassName} />,
    marca: <HiTruck className={iconClassName} />,
    tipo: <HiTruck className={iconClassName} />,
    estado: <HiStatusOnline className={iconClassName} />,
    gpsIntegrado: <HiLocationMarker className={iconClassName} />,
    viajesPrevios: <HiClock className={iconClassName} />,
  };
  return icons[matchType];
}

/**
 * Calculate grouped search results showing count per field type
 */
function calculateGroupedResults(
  trucks: CamionOption[],
  query: string
): GroupedSearchResult[] {
  if (query.length < MIN_CHARACTERS) {
    return [];
  }

  const lowerQuery = query.toLowerCase();
  const matchCounts = new Map<TruckMatchType, Set<string>>();

  for (const truck of trucks) {
    for (const field of SEARCHABLE_FIELDS) {
      const fieldValue = getFieldValue(truck, field);
      if (fieldValue.toLowerCase().includes(lowerQuery)) {
        if (!matchCounts.has(field)) {
          matchCounts.set(field, new Set());
        }
        matchCounts.get(field)!.add(truck.id);
      }
    }
  }

  return Array.from(matchCounts.entries())
    .map(([matchType, truckIds]) => ({
      matchType,
      count: truckIds.size,
    }))
    .filter((result) => result.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * Filter trucks by a specific field type
 */
function filterTrucksByField(
  trucks: CamionOption[],
  query: string,
  matchType: TruckMatchType
): CamionOption[] {
  if (!query.trim()) {
    return trucks;
  }

  const lowerQuery = query.toLowerCase();

  return trucks.filter((truck) => {
    const fieldValue = getFieldValue(truck, matchType);
    return fieldValue.toLowerCase().includes(lowerQuery);
  });
}

function TruckCard({
  truck,
  isSelected,
  isHighlighted,
  dict,
  onClick,
  onMouseEnter,
}: TruckCardProps) {
  const isAvailable = truck.estado === "disponible";
  const isGpsIntegrado = truck.gpsIntegrado;
  const isOnline = truck.estadoGps === "online";

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
      {/* Header: Plate + Brand + Type + GPS Status */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isSelected && (
              <HiCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            )}
            <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
              {truck.plate}
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {truck.marca} ·{" "}
            {tr(
              `pages.planning.sidebar.assignment.truckType.${truck.tipo}`,
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
            {tr("pages.planning.sidebar.assignment.previousTrips", dict)}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {truck.viajesPrevios}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tr("pages.planning.sidebar.assignment.lastTrip", dict)}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {truck.ultimoViaje}
          </span>
        </div>
      </div>

      {/* Signal losses - only show if there are any */}
      {truck.perdidasSenal > 0 && (
        <div className="flex flex-wrap items-center gap-1 mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700">
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            <HiExclamation className="w-3 h-3" />
            {tr("pages.planning.sidebar.assignment.signalLosses", dict)} (
            {truck.perdidasSenal})
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
        <div>{tr("pages.planning.sidebar.assignment.noTrucksFound", dict)}</div>
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

export function TruckSearchDropdown({
  label,
  trucks,
  selectedTruckId,
  onSelect,
  placeholder,
  disabled = false,
  dict,
  labelRightElement,
}: TruckSearchDropdownProps) {
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
    () => calculateGroupedResults(trucks, debouncedQuery),
    [trucks, debouncedQuery]
  );

  // Filter trucks when a field filter is active
  const filteredTrucks = useMemo(() => {
    if (!activeFilter) {
      return trucks;
    }
    return filterTrucksByField(
      trucks,
      activeFilter.query,
      activeFilter.matchType
    );
  }, [trucks, activeFilter]);

  // Determine if we're in "grouped mode" (showing field types) or "list mode" (showing trucks)
  const isGroupedMode =
    debouncedQuery.length >= MIN_CHARACTERS && !activeFilter;

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [groupedResults.length, filteredTrucks.length, isGroupedMode]);

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
    (truckId: string) => {
      onSelect(truckId);
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
        if (filteredTrucks.length === 0) {
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
              prev < filteredTrucks.length - 1 ? prev + 1 : prev
            );
            break;
          case "ArrowUp":
            e.preventDefault();
            isKeyboardNavigation.current = true;
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
            break;
          case "Enter":
            e.preventDefault();
            if (filteredTrucks[highlightedIndex]) {
              const truck = filteredTrucks[highlightedIndex];
              if (truck.estado === "disponible") {
                handleSelect(truck.id);
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
            if (filteredTrucks[highlightedIndex]) {
              const truck = filteredTrucks[highlightedIndex];
              if (truck.estado === "disponible") {
                handleSelect(truck.id);
              }
            }
            break;
        }
      }
    },
    [
      isGroupedMode,
      groupedResults,
      filteredTrucks,
      highlightedIndex,
      activeFilter,
      handleSelect,
      handleMatchTypeSelect,
      handleClearFilter,
    ]
  );

  const selectedTruck = trucks.find((t) => t.id === selectedTruckId);

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
              "pages.planning.sidebar.assignment.searchTruck",
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

      {/* Content: Grouped Results or Truck List */}
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
            {filteredTrucks.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {tr("pages.planning.sidebar.assignment.noTrucksFound", dict)}
              </div>
            ) : (
              filteredTrucks.map((truck, index) => (
                <div key={truck.id} data-index={index}>
                  <TruckCard
                    truck={truck}
                    isSelected={truck.id === selectedTruckId}
                    isHighlighted={index === highlightedIndex}
                    dict={dict}
                    onClick={() => {
                      if (truck.estado === "disponible") {
                        handleSelect(truck.id);
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
            selectedTruck && !isOpen ? "p-2" : "px-3 py-2"
          )}
        >
          {selectedTruck && !isOpen ? (
            /* Show truck info inside button when selected */
            <div className="flex flex-col">
              {/* Header with plate, brand, type, GPS status, and chevron */}
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <HiCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
                      {selectedTruck.plate}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedTruck.marca} ·{" "}
                    {tr(
                      `pages.planning.sidebar.assignment.truckType.${selectedTruck.tipo}`,
                      dict
                    )}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-center gap-1.5">
                    {selectedTruck.gpsIntegrado && (
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
                  {selectedTruck.gpsIntegrado && (
                    <span className="flex items-center gap-1 text-[10px]">
                      <span
                        className={twMerge(
                          "w-2 h-2 rounded-full",
                          selectedTruck.estadoGps === "online"
                            ? "bg-green-500"
                            : "bg-gray-400"
                        )}
                      />
                      <span
                        className={twMerge(
                          "font-medium",
                          selectedTruck.estadoGps === "online"
                            ? "text-green-600 dark:text-green-400"
                            : "text-gray-500 dark:text-gray-400"
                        )}
                      >
                        {selectedTruck.estadoGps === "online"
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
                    {tr(
                      "pages.planning.sidebar.assignment.previousTrips",
                      dict
                    )}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {selectedTruck.viajesPrevios}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">
                    {tr("pages.planning.sidebar.assignment.lastTrip", dict)}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {selectedTruck.ultimoViaje}
                  </span>
                </div>
              </div>

              {/* Signal losses - only show if there are any */}
              {selectedTruck.perdidasSenal > 0 && (
                <div className="flex flex-wrap items-center gap-1 mt-1 pt-1 border-t border-gray-100 dark:border-gray-700">
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                    <HiExclamation className="w-3 h-3" />
                    {tr(
                      "pages.planning.sidebar.assignment.signalLosses",
                      dict
                    )}{" "}
                    ({selectedTruck.perdidasSenal})
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
                  selectedTruck
                    ? "text-gray-900 dark:text-white"
                    : "text-gray-500"
                )}
              >
                {selectedTruck?.plate ?? placeholder}
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
