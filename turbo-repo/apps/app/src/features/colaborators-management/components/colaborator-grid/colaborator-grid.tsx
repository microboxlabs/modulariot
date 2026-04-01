"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { HiArrowUp, HiArrowDown } from "react-icons/hi2";
import type { Colaborator } from "../../types/colaborators.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ColaboratorCard from "./colaborator-card";

const ITEMS_PER_PAGE = 9;

type SortField = "score" | "incidentsCount" | "punctuality" | null;
type SortDirection = "asc" | "desc";
type FilterType = "todos" | "activos" | "en-riesgo" | "destacados" | "con-incidentes";

interface SortState {
  field: SortField;
  direction: SortDirection;
}

interface ColaboratorGridProps {
  readonly colaborators: Colaborator[];
  readonly dict: I18nRecord;
  readonly onSelectColaborator?: (id: string) => void;
}

export default function ColaboratorGrid({
  colaborators,
  dict,
  onSelectColaborator,
}: ColaboratorGridProps) {
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [isLoading, setIsLoading] = useState(false);
  const [sort, setSort] = useState<SortState>({ field: null, direction: "desc" });
  const [filter, setFilter] = useState<FilterType>("todos");
  const loaderRef = useRef<HTMLDivElement>(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSortClick = (field: SortField) => {
    setSort((prev) => {
      if (prev.field !== field) {
        // New field selected - start with desc
        return { field, direction: "desc" };
      }
      if (prev.direction === "desc") {
        // Same field, was desc -> go to asc
        return { field, direction: "asc" };
      }
      // Same field, was asc -> turn off
      return { field: null, direction: "desc" };
    });
  };

  const filteredColaborators = useMemo(() => {
    switch (filter) {
      case "activos":
        return colaborators.filter((c) => c.employmentStatus === "activo");
      case "en-riesgo":
        return colaborators.filter((c) => c.score < 50);
      case "destacados":
        return colaborators.filter((c) => c.score >= 80);
      case "con-incidentes":
        return colaborators.filter((c) => c.incidentsCount > 0);
      default:
        return colaborators;
    }
  }, [colaborators, filter]);

  const sortedColaborators = useMemo(() => {
    if (!sort.field) return filteredColaborators;
    
    return [...filteredColaborators].sort((a, b) => {
      if (!sort.field) return 0;
      const aVal = a[sort.field];
      const bVal = b[sort.field];
      const diff = (aVal as number) - (bVal as number);
      return sort.direction === "asc" ? diff : -diff;
    });
  }, [filteredColaborators, sort]);

  const visibleColaborators = sortedColaborators.slice(0, visibleCount);
  const hasMore = visibleCount < sortedColaborators.length;

  const clearLoadTimeout = useCallback(() => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  }, []);

  // Reset visible count when filter changes
  useEffect(() => {
    clearLoadTimeout();
    setVisibleCount(Math.min(ITEMS_PER_PAGE, sortedColaborators.length));
    setIsLoading(false);
  }, [filter, sortedColaborators.length, clearLoadTimeout]);

  // Reset state when colaborators prop changes
  useEffect(() => {
    clearLoadTimeout();
    setVisibleCount(Math.min(ITEMS_PER_PAGE, colaborators.length));
    setIsLoading(false);
  }, [colaborators, clearLoadTimeout]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return clearLoadTimeout;
  }, [clearLoadTimeout]);

  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    loadTimeoutRef.current = setTimeout(() => {
      setVisibleCount((prev) =>
        Math.min(prev + ITEMS_PER_PAGE, sortedColaborators.length)
      );
      setIsLoading(false);
    }, 300);
  }, [isLoading, hasMore, sortedColaborators.length]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, loadMore]);

  const getFilterButtonClass = (filterType: FilterType) => {
    const isActive = filter === filterType;
    return `px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
      isActive
        ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
    }`;
  };

  const getSortButtonClass = (field: SortField) => {
    const isActive = sort.field === field;
    return `px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
      isActive
        ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
    }`;
  };

  const renderSortIcon = (field: SortField) => {
    if (sort.field !== field) return null;
    return sort.direction === "asc" ? (
      <HiArrowUp className="w-3 h-3" />
    ) : (
      <HiArrowDown className="w-3 h-3" />
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div className="flex items-end gap-2">
          <h2 className="text-sm font-semibold flex items-end text-gray-700 dark:text-gray-300">
            {tr("grid.title", dict)}
          </h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {tr("grid.colaboratorCount", dict, { count: String(sortedColaborators.length) })}
          </span>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          {/* Filter buttons */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setFilter("todos")}
              className={getFilterButtonClass("todos")}
            >
              {tr("filter.all", dict)}
            </button>
            <button
              type="button"
              onClick={() => setFilter("activos")}
              className={getFilterButtonClass("activos")}
            >
              {tr("filter.active", dict)}
            </button>
            <button
              type="button"
              onClick={() => setFilter("en-riesgo")}
              className={getFilterButtonClass("en-riesgo")}
            >
              {tr("filter.atRisk", dict)}
            </button>
            <button
              type="button"
              onClick={() => setFilter("destacados")}
              className={getFilterButtonClass("destacados")}
            >
              {tr("filter.outstanding", dict)}
            </button>
            <button
              type="button"
              onClick={() => setFilter("con-incidentes")}
              className={getFilterButtonClass("con-incidentes")}
            >
              {tr("filter.withIncidents", dict)}
            </button>
          </div>
          {/* Sort buttons */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => handleSortClick("score")}
              className={getSortButtonClass("score")}
            >
              {tr("sort.performance", dict)}
              {renderSortIcon("score")}
            </button>
            <button
              type="button"
              onClick={() => handleSortClick("incidentsCount")}
              className={getSortButtonClass("incidentsCount")}
            >
              {tr("sort.incidents", dict)}
              {renderSortIcon("incidentsCount")}
            </button>
            <button
              type="button"
              onClick={() => handleSortClick("punctuality")}
              className={getSortButtonClass("punctuality")}
            >
              {tr("sort.efficiency", dict)}
              {renderSortIcon("punctuality")}
            </button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {visibleColaborators.map((colaborator) => (
          <ColaboratorCard
            key={colaborator.id}
            colaborator={colaborator}
            dict={dict}
            onSelect={onSelectColaborator}
          />
        ))}
      </div>
      {hasMore && (
        <div ref={loaderRef} className="flex justify-center py-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" />
              <span className="text-xs">{tr("grid.loading", dict)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
