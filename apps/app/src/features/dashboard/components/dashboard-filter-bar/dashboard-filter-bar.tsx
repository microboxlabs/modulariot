"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { HiSearch, HiX } from "react-icons/hi";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useDashboard } from "../../context/dashboard-context";
import TimeRangePicker from "./time-range-picker";
import Tags from "./tags";

/**
 * Dashboard filter bar — always renders 3 components inline:
 * 1. Search input
 * 2. Date range picker (calendar button)
 * 3. Tags (active filter badge)
 */
export function DashboardFilterBar() {
  const { filters } = useDashboard();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const textFilters = useMemo(
    () => filters.filter((f) => f.type === "text"),
    [filters]
  );

  const dateFilters = useMemo(
    () => filters.filter((f) => f.type === "date_range"),
    [filters]
  );

  const placeholder = useMemo(() => {
    if (textFilters.length === 0) return "Search...";
    if (textFilters.length === 1)
      return `Search by ${textFilters[0].label}...`;
    return `Search by ${textFilters.map((f) => f.label).join(", ")}...`;
  }, [textFilters]);

  const pushParams = useCallback(
    (params: URLSearchParams) => {
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname]
  );

  const handleSearch = useCallback(
    (term: string, paramKey: string) => {
      const filterConfig = filters.find((f) => f.key === paramKey);
      const isUnique = filterConfig?.unique || false;

      let params: URLSearchParams;
      if (isUnique && term) {
        params = new URLSearchParams();
        params.set(paramKey, term);
      } else {
        params = new URLSearchParams(searchParams.toString());
        if (term) {
          params.set(paramKey, term);
        } else {
          params.delete(paramKey);
        }
      }

      pushParams(params);
      setSearch("");
      setOpen(false);
    },
    [searchParams, filters, pushParams]
  );

  const handleClear = useCallback(() => {
    setSearch("");
    setOpen(false);
    inputRef.current?.focus();
  }, []);

  const handleRemoveParam = useCallback(
    (key: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(key);
      pushParams(params);
    },
    [searchParams, pushParams]
  );

  const handleDateChange = useCallback(
    (paramKey: string, startDate: string, endDate: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (startDate) {
        params.set(`${paramKey}_from`, startDate);
      } else {
        params.delete(`${paramKey}_from`);
      }
      if (endDate) {
        params.set(`${paramKey}_to`, endDate);
      } else {
        params.delete(`${paramKey}_to`);
      }
      pushParams(params);
    },
    [searchParams, pushParams]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        setSearch("");
        inputRef.current?.blur();
        return;
      }

      if (e.key === "Enter" && search.trim()) {
        e.preventDefault();
        if (textFilters.length === 1) {
          handleSearch(search.trim(), textFilters[0].key);
          return;
        }
        if (/^[^:]+:[^:]+$/.test(search)) {
          const [labelPart, valuePart] = search.split(":");
          const matched = textFilters.find(
            (f) =>
              f.label.toUpperCase() === labelPart.trim().toUpperCase() ||
              f.key.toUpperCase() === labelPart.trim().toUpperCase()
          );
          if (matched) {
            handleSearch(valuePart.trim(), matched.key);
          }
        }
      }
    },
    [search, textFilters, handleSearch]
  );

  return (
    <div className="flex items-center gap-2">
      {/* Search Input */}
      <div ref={containerRef} className="relative min-w-[200px] flex-1">
        <div className="relative flex w-full items-center rounded-lg border border-gray-300 bg-white transition-all duration-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700">
          <HiSearch className="absolute left-3 h-4 w-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (e.target.value.length > 0) {
                setOpen(true);
              }
            }}
            onFocus={() => {
              if (search.length > 0) setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full rounded-lg bg-transparent py-2.5 pl-10 pr-10 text-sm text-gray-900 focus:outline-none dark:text-white dark:placeholder-gray-400"
            autoComplete="off"
          />

          {search && (
            <button
              onClick={handleClear}
              type="button"
              className="absolute right-3 rounded p-0.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-600"
              aria-label="Clear search"
            >
              <HiX className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
            </button>
          )}
        </div>

        {open && search.trim() && textFilters.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-700">
            {textFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className="flex w-full items-center gap-1 px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSearch(search.trim(), filter.key);
                }}
              >
                Search
                <span className="max-w-[120px] truncate font-medium text-gray-900 dark:text-white">
                  {search}
                </span>
                as
                <span className="font-medium text-gray-900 dark:text-white">
                  {filter.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Date Range Picker */}
      {dateFilters.map((filter) => (
        <TimeRangePicker
          key={filter.key}
          className="shrink-0"
          mode="date"
          ranges="date"
          onDateChange={(startDate, endDate) =>
            handleDateChange(filter.key, startDate, endDate)
          }
        />
      ))}
      {dateFilters.length === 0 && (
        <TimeRangePicker
          className="shrink-0"
          mode="date"
          ranges="date"
          onDateChange={(startDate, endDate) =>
            handleDateChange("date_range", startDate, endDate)
          }
        />
      )}

      {/* Tags */}
      <Tags
        searchParams={searchParams}
        onRemoveParam={handleRemoveParam}
        filters={filters}
      />
    </div>
  );
}
