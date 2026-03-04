"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { TextInput } from "flowbite-react";
import { twMerge } from "tailwind-merge";

const MIN_CHARACTERS = 3;

interface PgrestFunctionAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (functionName: string) => void;
  placeholder?: string;
  id?: string;
  loading?: boolean;
}

export function PgrestFunctionAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "api_modular_my_function",
  id,
  loading = false,
}: Readonly<PgrestFunctionAutocompleteProps>) {
  const [allFunctions, setAllFunctions] = useState<string[] | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [fetchError, setFetchError] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);

  // Fetch function list once on first interaction
  const fetchFunctions = useCallback(async () => {
    if (allFunctions !== null || fetchError) return;

    try {
      const res = await fetch("/app/api/dashboard/pgrest/functions");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { functions: string[] };
      setAllFunctions(data.functions);
    } catch {
      setFetchError(true);
    }
  }, [allFunctions, fetchError]);

  // Client-side filtering
  const filtered = useMemo(() => {
    if (!allFunctions || value.length < MIN_CHARACTERS) return [];
    const lower = value.toLowerCase();
    return allFunctions.filter((fn) => fn.toLowerCase().includes(lower));
  }, [allFunctions, value]);

  // Show/hide dropdown
  useEffect(() => {
    if (value.length >= MIN_CHARACTERS && filtered.length > 0 && !fetchError) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
    setSelectedIndex(0);
  }, [filtered, value, fetchError]);

  // Click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return;
    const item = dropdownRef.current.children[selectedIndex] as HTMLElement;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, isOpen]);

  const handleSelect = useCallback(
    (functionName: string) => {
      onChange(functionName);
      setIsOpen(false);
      onSelect(functionName);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [onChange, onSelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || filtered.length === 0) {
        if (e.key === "Escape") {
          setIsOpen(false);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filtered.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filtered[selectedIndex]) {
            handleSelect(filtered[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          break;
        case "Tab":
          if (filtered[selectedIndex]) {
            handleSelect(filtered[selectedIndex]);
          }
          break;
      }
    },
    [isOpen, filtered, selectedIndex, handleSelect]
  );

  return (
    <div ref={containerRef} className="relative">
      <TextInput
        ref={inputRef}
        id={id}
        sizing="sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={fetchFunctions}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        disabled={loading}
      />
      {loading && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-2.5">
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500 dark:border-gray-600 dark:border-t-blue-400" />
        </div>
      )}
      {isOpen && (
        <ul
          ref={dropdownRef}
          role="listbox"
          className={twMerge(
            "absolute z-50 w-full mt-1",
            "bg-white dark:bg-gray-800",
            "border border-gray-200 dark:border-gray-700",
            "rounded-lg shadow-lg",
            "max-h-48 overflow-y-auto",
            "py-1"
          )}
        >
          {filtered.map((fn, index) => (
            <li key={fn}>
              <button
                type="button"
                tabIndex={index === selectedIndex ? 0 : -1}
                onClick={() => handleSelect(fn)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={twMerge(
                  "w-full text-left px-3 py-1.5 text-sm font-mono cursor-pointer",
                  "transition-colors border-0 bg-transparent",
                  index === selectedIndex
                    ? "bg-blue-50 dark:bg-blue-900/30"
                    : "hover:bg-gray-50 dark:hover:bg-gray-700",
                  "text-gray-900 dark:text-white"
                )}
              >
                {fn}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
