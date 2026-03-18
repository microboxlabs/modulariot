"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { TextInput } from "flowbite-react";
import { z } from "zod";
import { useDropdown } from "./use-dropdown";
import { DropdownList } from "./dropdown-list";

const functionsResponseSchema = z.object({
  functions: z.array(z.string()),
});

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
  const [fetchError, setFetchError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);

  // Fetch function list once on first interaction
  const fetchFunctions = useCallback(async () => {
    if (allFunctions !== null) return;

    setFetchError(null);
    try {
      const res = await fetch("/app/api/dashboard/pgrest/functions");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = functionsResponseSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error("Invalid response format");
      setAllFunctions(parsed.data.functions);
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : "Failed to load functions"
      );
    }
  }, [allFunctions]);

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
  }, [filtered, value, fetchError]);

  const retryFetch = useCallback(async () => {
    setFetchError(null);
    setAllFunctions(null);
    try {
      const res = await fetch("/app/api/dashboard/pgrest/functions");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = functionsResponseSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error("Invalid response format");
      setAllFunctions(parsed.data.functions);
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : "Failed to load functions"
      );
    }
  }, []);

  const handleSelect = useCallback(
    (functionName: string) => {
      onChange(functionName);
      setIsOpen(false);
      onSelect(functionName);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [onChange, onSelect]
  );

  const close = useCallback(() => setIsOpen(false), []);

  const { selectedIndex, setSelectedIndex, handleKeyDown } = useDropdown({
    items: filtered,
    isOpen,
    onClose: close,
    onSelect: handleSelect,
    containerRef,
    dropdownRef,
  });

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
      {fetchError && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          {fetchError}{" "}
          <button
            type="button"
            className="underline hover:no-underline"
            onClick={retryFetch}
          >
            Retry
          </button>
        </p>
      )}
      {isOpen && (
        <DropdownList
          items={filtered}
          selectedIndex={selectedIndex}
          onSelect={handleSelect}
          onHover={setSelectedIndex}
          dropdownRef={dropdownRef}
          getKey={(fn) => fn}
          renderItem={(fn) => fn}
          itemClassName="font-mono"
        />
      )}
    </div>
  );
}
