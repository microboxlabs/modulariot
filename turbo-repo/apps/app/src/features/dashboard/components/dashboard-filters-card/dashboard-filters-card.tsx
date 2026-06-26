"use client";

import { useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useDashboard } from "../../context/dashboard-context";
import type { DashboardFilterParam } from "../../types/dashboard.types";
import { TextFilterBadge } from "./text-filter-badge";
import { SelectFilterBadge } from "./select-filter-badge";
import { DateFilterBadge } from "./date-filter-badge";
import { tr } from "@/features/i18n/tr.service";

export function DashboardFilterBadges() {
  const { filters, dictionary } = useDashboard();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const hasDateFilter = useMemo(() => filters.some((f) => f.type === "date_range"), [filters]);

  const push = useCallback(
    (params: URLSearchParams) => {
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname]
  );

  const applyText = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      push(params);
    },
    [searchParams, push]
  );

  const applySelect = useCallback(
    (key: string, values: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (values.length) params.set(key, values.join(","));
      else params.delete(key);
      push(params);
    },
    [searchParams, push]
  );

  const applyDate = useCallback(
    (key: string, from: string, to: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (from) params.set(`${key}_from`, from); else params.delete(`${key}_from`);
      if (to) params.set(`${key}_to`, to); else params.delete(`${key}_to`);
      push(params);
    },
    [searchParams, push]
  );

  const clearFilter = useCallback(
    (key: string, type: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (type === "date_range") {
        params.delete(`${key}_from`);
        params.delete(`${key}_to`);
      } else {
        params.delete(key);
      }
      push(params);
    },
    [searchParams, push]
  );

  const renderFilter = (f: DashboardFilterParam) => {
    if (f.type === "text") {
      return (
        <TextFilterBadge
          key={f.key}
          filter={f}
          value={searchParams.get(f.key) ?? undefined}
          onApply={(v) => applyText(f.key, v)}
          onClear={() => clearFilter(f.key, f.type)}
          dictionary={dictionary}
        />
      );
    }
    if (f.type === "select") {
      const raw = searchParams.get(f.key);
      const values = raw ? raw.split(",").filter(Boolean) : [];
      return (
        <SelectFilterBadge
          key={f.key}
          filter={f}
          values={values}
          onApply={(vals) => applySelect(f.key, vals)}
          onClear={() => clearFilter(f.key, f.type)}
          dictionary={dictionary}
        />
      );
    }
    if (f.type === "date_range") {
      return (
        <DateFilterBadge
          key={f.key}
          filter={f}
          from={searchParams.get(`${f.key}_from`) ?? undefined}
          to={searchParams.get(`${f.key}_to`) ?? undefined}
          onChange={(from, to) => applyDate(f.key, from, to)}
          onClear={() => clearFilter(f.key, f.type)}
          dictionary={dictionary}
        />
      );
    }
    return null;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map(renderFilter)}
      {!hasDateFilter && (
        <DateFilterBadge
          filter={{ key: "date_range", label: tr("dashboard.settings.dateFilterLabel", dictionary), type: "date_range" }}
          from={searchParams.get("date_range_from") ?? undefined}
          to={searchParams.get("date_range_to") ?? undefined}
          onChange={(from, to) => applyDate("date_range", from, to)}
          onClear={() => clearFilter("date_range", "date_range")}
          dictionary={dictionary}
        />
      )}
    </div>
  );
}
