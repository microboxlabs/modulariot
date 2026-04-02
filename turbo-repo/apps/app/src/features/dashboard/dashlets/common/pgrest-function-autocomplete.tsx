"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { TextInput } from "flowbite-react";
import { z } from "zod";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useDropdown } from "./use-dropdown";
import { DropdownList } from "./dropdown-list";
import { buildDataSourceParams } from "./pgrest-utils";

const pathsResponseSchema = z.object({
  paths: z.array(z.string()),
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
}

export function PgrestFunctionAutocomplete({
  value,
  onChange,
  onSelect,
  dictionary,
  placeholder = "rpc/my_function",
  id,
  loading = false,
  dataSourceId,
}: Readonly<PgrestFunctionAutocompleteProps>) {
  const [allPaths, setAllPaths] = useState<string[] | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const isFetchingRef = useRef(false);

  // Guard against out-of-order responses when dataSourceId changes
  const requestIdRef = useRef(0);

  // Reset cached paths when the data source changes
  useEffect(() => {
    requestIdRef.current += 1;
    setAllPaths(null);
    setFetchError(null);
  }, [dataSourceId]);

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
      const parsed = pathsResponseSchema.safeParse(await res.json());
      if (reqId !== requestIdRef.current) return;
      if (!parsed.success)
        throw new Error(
          tr("dashboard.settings.invalidResponseFormat", dictionary)
        );
      setAllPaths(parsed.data.paths);
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
  }, [dictionary, dataSourceId]);

  // Fetch path list on focus – retries automatically after errors
  const fetchPaths = useCallback(async () => {
    if (isFetchingRef.current) return;
    // Already have data – nothing to do
    if (allPaths !== null) return;
    // Clear stale error so the dropdown can open after a successful retry
    setFetchError(null);
    await doFetch(requestIdRef.current);
  }, [allPaths, doFetch]);

  // Client-side filtering
  const filtered = useMemo(() => {
    if (!allPaths || value.length < MIN_CHARACTERS) return [];
    const lower = value.toLowerCase();
    return allPaths.filter((p) => p.toLowerCase().includes(lower));
  }, [allPaths, value]);

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
    setAllPaths(null);
    await doFetch(requestIdRef.current);
  }, [doFetch]);

  const handleSelect = useCallback(
    (path: string) => {
      onChange(path);
      setIsOpen(false);
      onSelect(path);
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
        onFocus={fetchPaths}
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
          getKey={(p) => p}
          renderItem={(p) => p}
          itemClassName="font-mono"
        />
      )}
    </div>
  );
}
