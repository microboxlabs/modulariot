"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { TextInput } from "flowbite-react";
import { useDropdown } from "../common/use-dropdown";
import { DropdownList } from "../common/dropdown-list";
import { buildDataSourceParams } from "./dashlet.utils";

const MIN_CHARACTERS = 3;

interface PgrestFunctionAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (functionName: string) => void;
  placeholder?: string;
  id?: string;
  loading?: boolean;
  dataSourceId?: string;
}

export function PgrestFunctionAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "api_modular_my_function",
  id,
  loading = false,
  dataSourceId,
}: Readonly<PgrestFunctionAutocompleteProps>) {
  const [allFunctions, setAllFunctions] = useState<string[] | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);

  // Reset cached functions when the data source changes
  useEffect(() => {
    setAllFunctions(null);
    setFetchError(false);
  }, [dataSourceId]);

  // Fetch function list once on first interaction
  const fetchFunctions = useCallback(async () => {
    if (allFunctions !== null || fetchError) return;

    try {
      const qs = buildDataSourceParams(dataSourceId).toString();
      const suffix = qs ? `?${qs}` : "";
      const url = `/app/api/dashboard/pgrest/functions${suffix}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { functions: string[] };
      setAllFunctions(data.functions);
    } catch {
      setFetchError(true);
    }
  }, [allFunctions, fetchError, dataSourceId]);

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
