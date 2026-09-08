"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { DashboardFilterParam } from "@/features/dashboard/types/dashboard.types";
import { TextFilterBadge } from "@/features/dashboard/components/dashboard-filters-card/text-filter-badge";
import { SelectFilterBadge } from "@/features/dashboard/components/dashboard-filters-card/select-filter-badge";
import { DateFilterBadge } from "@/features/dashboard/components/dashboard-filters-card/date-filter-badge";
import { getCategories } from "./parametrized-searchbar";
import { useSymptomNames, toSymptomOptions } from "@/features/symptoms/hooks/use-symptom-names";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { NavParam } from "./navegation_params";
import { FILTER_ANY } from "@/features/layout/services/kanban-default-filters";

/** Selector whose options are aggregated from data rather than declared statically. */
const SYMPTOM_NAME_KEY = "symptom_name";

/**
 * What the badge shows as picked. `FILTER_ANY` is the operator asking for every
 * value, so nothing is picked.
 *
 * `guarded` params are written by this bar and normalized on the way in, so a
 * value outside their options can only come from a hand-edited URL: the API
 * ignores it, and the badge must not claim to be filtering by it. Params whose
 * options arrive asynchronously are left alone — there, an unknown value means
 * the options have not loaded yet.
 */
function selectedValues(
  filter: DashboardFilterParam,
  raw: string | null,
  guarded: boolean
): string[] {
  if (!raw || raw === FILTER_ANY) return [];

  const values = raw.split(",").filter(Boolean);
  if (!guarded) return values;

  const allowed = new Set((filter.options ?? []).map((o) => o.value));
  return values.filter((v) => allowed.has(v));
}

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

  const symptomNames = useSymptomNames();

  const optionsFor = (p: NavParam): DashboardFilterParam["options"] => {
    if (p.param.key === SYMPTOM_NAME_KEY) return toSymptomOptions(symptomNames, dict);
    if (p.param.type === "bool") return getCategories(dict);
    return p.options as DashboardFilterParam["options"];
  };

  const filters: DashboardFilterParam[] = navegation_params.map((p) => {
    const isSelect = p.param.type === "selector" || p.param.type === "bool";
    return {
      key: p.param.key,
      label: p.label,
      type: isSelect ? "select" : (p.param.type as "text" | "date_range"),
      unique: p.unique,
      options: optionsFor(p),
      // Every selector here maps to a single-valued API argument — the RPCs
      // match one exact string, so a comma-joined pair returns nothing. This is
      // what the old CustomSelector offered before the badge bar replaced it.
      single: isSelect,
    };
  });

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

  const keysWithDefault = useMemo(
    () =>
      new Set(
        navegation_params.filter((p) => p.defaultValue).map((p) => p.param.key)
      ),
    [navegation_params]
  );

  const clearFilter = useCallback(
    (key: string, type: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (type === "date_range") {
        params.delete(`${key}_from`);
        params.delete(`${key}_to`);
      } else if (keysWithDefault.has(key)) {
        // Dropping it would read as "not chosen yet" and land the default
        // straight back; `all` is the operator saying every value.
        params.set(key, FILTER_ANY);
      } else {
        params.delete(key);
      }
      push(params);
    },
    [searchParams, push, keysWithDefault]
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
          const values = selectedValues(
            f,
            searchParams.get(f.key),
            keysWithDefault.has(f.key)
          );
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
