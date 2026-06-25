"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { DashboardFilterParam } from "@/features/dashboard/types/dashboard.types";
import { TextFilterBadge } from "@/features/dashboard/components/dashboard-filters-card/text-filter-badge";
import { SelectFilterBadge } from "@/features/dashboard/components/dashboard-filters-card/select-filter-badge";
import { DateFilterBadge } from "@/features/dashboard/components/dashboard-filters-card/date-filter-badge";
import { getCategories } from "./parametrized-searchbar";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { NavParam } from "./navegation_params";

interface ParametrizedFilterBarProps {
  readonly dict: I18nRecord;
  readonly navegation_params: NavParam[];
  readonly className?: string;
}

export default function ParametrizedFilterBar({
  dict,
  navegation_params,
  className,
}: ParametrizedFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const push = useCallback(
    (params: URLSearchParams) => {
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname]
  );

  const filters: DashboardFilterParam[] = navegation_params.map((p) => ({
    key: p.param.key,
    label: p.label,
    type:
      p.param.type === "selector" || p.param.type === "bool"
        ? "select"
        : (p.param.type as "text" | "date_range"),
    unique: p.unique,
    options:
      p.param.type === "bool"
        ? getCategories(dict)
        : (p.options as DashboardFilterParam["options"]),
  }));

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
      if (from) params.set(`${key}_from`, from);
      else params.delete(`${key}_from`);
      if (to) params.set(`${key}_to`, to);
      else params.delete(`${key}_to`);
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

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      {filters.map((f) => {
        if (f.type === "text") {
          return (
            <TextFilterBadge
              key={f.key}
              filter={f}
              value={searchParams.get(f.key) ?? undefined}
              onApply={(v) => applyText(f.key, v)}
              onClear={() => clearFilter(f.key, f.type)}
              dictionary={dict}
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
              dictionary={dict}
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
              dictionary={dict}
            />
          );
        }
        return null;
      })}
    </div>
  );
}
