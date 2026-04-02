"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { TextInput } from "flowbite-react";
import { z } from "zod";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useDropdown } from "./use-dropdown";
import { DropdownList } from "./dropdown-list";
import type { PgrestPathMode } from "./pgrest-types";
import { buildDataSourceParams } from "./pgrest-utils";

const functionsResponseSchema = z.object({
  functions: z.array(z.string()),
  tables: z.array(z.string()).optional(),
});

const MIN_CHARACTERS = 3;

interface PgrestFunctionAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (functionName: string) => void;
  dictionary: I18nRecord;
  placeholder?: string;
  id?: string;
  loading?: boolean;
  dataSourceId?: string;
  pathMode?: PgrestPathMode;
}

export function PgrestFunctionAutocomplete({
  value,
  onChange,
  onSelect,
  dictionary,
  placeholder,
  id,
  loading = false,
  dataSourceId,
  pathMode = "rpc",
}: Readonly<PgrestFunctionAutocompleteProps>) {
  const defaultPlaceholder = pathMode === "table" ? "my_table" : "api_modular_my_function";
  const resolvedPlaceholder = placeholder ?? defaultPlaceholder;
  const [allFunctions, setAllFunctions] = useState<string[] | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const isFetchingRef = useRef(false);

  // Guard against out-of-order responses when dataSourceId changes
  const requestIdRef = useRef(0);

  // Reset cached functions when the data source or path mode changes
  useEffect(() => {
    requestIdRef.current += 1;
    setAllFunctions(null);
    setFetchError(null);
  }, [dataSourceId, pathMode]);

  const doFetch = useCallback(async (reqId: number) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    setFetchError(null);
    try {
      const qs = buildDataSourceParams(dataSourceId).toString();
      const suffix = qs ? `?${qs}` : "";
      const url = `/app/api/dashboard/pgrest/functions${suffix}`;
      const res = await fetch(url);
      if (reqId !== requestIdRef.current) return;
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `HTTP ${res.status}`
        );
      }
      const parsed = functionsResponseSchema.safeParse(await res.json());
      if (reqId !== requestIdRef.current) return;
      if (!parsed.success)
        throw new Error(
          tr("dashboard.settings.invalidResponseFormat", dictionary)
        );
      setAllFunctions(
        pathMode === "table"
          ? (parsed.data.tables ?? [])
          : parsed.data.functions
      );
    } catch (err) {
      if (reqId !== requestIdRef.current) return;
      setFetchError(
        err instanceof Error
          ? err.message
          : tr("dashboard.settings.failedToLoadFunctions", dictionary)
      );
    } finally {
      isFetchingRef.current = false;
    }
  }, [dictionary, dataSourceId, pathMode]);

  // Fetch function list on focus – retries automatically after errors
  const fetchFunctions = useCallback(async () => {
    if (isFetchingRef.current) return;
    // Already have data – nothing to do
    if (allFunctions !== null) return;
    // Clear stale error so the dropdown can open after a successful retry
    setFetchError(null);
    await doFetch(requestIdRef.current);
  }, [allFunctions, doFetch]);

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
    requestIdRef.current += 1;
    setAllFunctions(null);
    await doFetch(requestIdRef.current);
  }, [doFetch]);

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
        placeholder={resolvedPlaceholder}
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
            {tr("common.retry", dictionary)}
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
