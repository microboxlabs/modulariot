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
import { HiSearch, HiChevronDown, HiCheck } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

const DEBOUNCE_MS = 300;

export interface TransportistaOption {
  id: string;
  name: string;
  rut: string;
  estado: "habilitado" | "no habilitado";
}

interface TransportistaSearchDropdownProps {
  readonly label: string;
  readonly transportistas: TransportistaOption[];
  readonly selectedTransportistaId: string;
  readonly onSelect: (transportistaId: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly dict: I18nRecord;
}

interface TransportistaCardProps {
  readonly transportista: TransportistaOption;
  readonly isSelected: boolean;
  readonly isHighlighted: boolean;
  readonly dict: I18nRecord;
  readonly onClick: () => void;
  readonly onMouseEnter: () => void;
}

function TransportistaCard({
  transportista,
  isSelected,
  isHighlighted,
  dict,
  onClick,
  onMouseEnter,
}: TransportistaCardProps) {
  const isEnabled = transportista.estado === "habilitado";

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={twMerge(
        "w-full text-left p-3 transition-colors",
        isHighlighted && "bg-blue-50 dark:bg-blue-900/30",
        isSelected && !isHighlighted && "bg-gray-50 dark:bg-gray-700/50",
        !isEnabled && "opacity-60"
      )}
    >
      {/* Header: Name + RUT + Status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isSelected && (
              <HiCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            )}
            <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
              {transportista.name}
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {transportista.rut}
          </span>
        </div>
        {isEnabled && (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 inline-flex items-center gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-green-200 dark:bg-green-800/50">
              <HiCheck className="w-2.5 h-2.5" />
            </span>
            {tr("pages.planning.sidebar.assignment.enabled", dict)}
          </span>
        )}
      </div>
    </button>
  );
}

function filterTransportistas(
  transportistas: TransportistaOption[],
  query: string
): TransportistaOption[] {
  if (!query.trim()) {
    return transportistas;
  }

  const lowerQuery = query.toLowerCase();

  return transportistas.filter((transportista) => {
    const searchableFields = [
      transportista.name,
      transportista.rut,
      transportista.estado,
    ];

    return searchableFields.some((field) =>
      field.toLowerCase().includes(lowerQuery)
    );
  });
}

export function TransportistaSearchDropdown({
  label,
  transportistas,
  selectedTransportistaId,
  onSelect,
  placeholder,
  disabled = false,
  dict,
}: TransportistaSearchDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

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

  // Filter transportistas based on debounced query
  const filteredTransportistas = useMemo(
    () => filterTransportistas(transportistas, debouncedQuery),
    [transportistas, debouncedQuery]
  );

  // Reset highlighted index when filtered results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredTransportistas.length]);

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
    (transportistaId: string) => {
      onSelect(transportistaId);
      setIsOpen(false);
      setQuery("");
    },
    [onSelect]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (filteredTransportistas.length === 0) {
        if (e.key === "Escape") {
          setIsOpen(false);
          setQuery("");
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          isKeyboardNavigation.current = true;
          setHighlightedIndex((prev) =>
            prev < filteredTransportistas.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          isKeyboardNavigation.current = true;
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredTransportistas[highlightedIndex]) {
            const transportista = filteredTransportistas[highlightedIndex];
            if (transportista.estado === "habilitado") {
              handleSelect(transportista.id);
            }
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setQuery("");
          break;
        case "Tab":
          if (filteredTransportistas[highlightedIndex]) {
            const transportista = filteredTransportistas[highlightedIndex];
            if (transportista.estado === "habilitado") {
              handleSelect(transportista.id);
            }
          }
          break;
      }
    },
    [filteredTransportistas, highlightedIndex, handleSelect]
  );

  const selectedTransportista = transportistas.find(
    (t) => t.id === selectedTransportistaId
  );

  const toggleDropdown = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
      if (!isOpen) {
        setQuery("");
        setHighlightedIndex(0);
      }
    }
  }, [disabled, isOpen]);

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
              "pages.planning.sidebar.assignment.searchTransportista",
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
      </div>

      {/* Transportista List */}
      <div
        ref={listRef}
        className="max-h-60 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-600"
        onMouseLeave={() => setHighlightedIndex(-1)}
      >
        {filteredTransportistas.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {tr(
              "pages.planning.sidebar.assignment.noTransportistasFound",
              dict
            )}
          </div>
        ) : (
          filteredTransportistas.map((transportista, index) => (
            <div key={transportista.id} data-index={index}>
              <TransportistaCard
                transportista={transportista}
                isSelected={transportista.id === selectedTransportistaId}
                isHighlighted={index === highlightedIndex}
                dict={dict}
                onClick={() => {
                  if (transportista.estado === "habilitado") {
                    handleSelect(transportista.id);
                  }
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
              />
            </div>
          ))
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
            selectedTransportista && !isOpen ? "p-2" : "px-3 py-2"
          )}
        >
          {selectedTransportista && !isOpen ? (
            /* Show transportista info inside button when selected */
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <HiCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
                    {selectedTransportista.name}
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedTransportista.rut}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {selectedTransportista.estado === "habilitado" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-green-200 dark:bg-green-800/50">
                      <HiCheck className="w-2.5 h-2.5" />
                    </span>
                    {tr("pages.planning.sidebar.assignment.enabled", dict)}
                  </span>
                )}
                <HiChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
              </div>
            </div>
          ) : (
            /* Show simple placeholder or name when not selected or when open */
            <div className="flex items-center justify-between">
              <span
                className={twMerge(
                  "font-medium truncate text-sm",
                  selectedTransportista
                    ? "text-gray-900 dark:text-white"
                    : "text-gray-500"
                )}
              >
                {selectedTransportista?.name ?? placeholder}
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
