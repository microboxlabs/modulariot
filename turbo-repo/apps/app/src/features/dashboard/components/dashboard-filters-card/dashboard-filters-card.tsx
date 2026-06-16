"use client";

import { useState, useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Button } from "flowbite-react";
import { HiAdjustmentsHorizontal } from "react-icons/hi2";
import dayjs from "dayjs";
import ExpandableSection from "@/features/fleet-management/components/vehicle-detail/expandable-section";
import TimeRangePicker from "../dashboard-filter-bar/time-range-picker";
import { useDashboard } from "../../context/dashboard-context";
import { tr } from "@/features/i18n/tr.service";

const INPUT_CLS =
  "h-7 w-full rounded border border-gray-300 bg-white px-2 text-xs text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400";

export function DashboardFiltersCard() {
  const { filters, dictionary } = useDashboard();
  const t = useCallback(
    (key: string, vars?: Record<string, string>) =>
      tr(`dashboard.filterBar.${key}`, dictionary, vars),
    [dictionary]
  );

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const textFilters = useMemo(() => filters.filter((f) => f.type === "text"), [filters]);
  const dateFilters = useMemo(() => filters.filter((f) => f.type === "date_range"), [filters]);

  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of textFilters) {
      const v = searchParams.get(f.key);
      if (v) init[f.key] = v;
    }
    for (const f of dateFilters) {
      const from = searchParams.get(`${f.key}_from`);
      const to = searchParams.get(`${f.key}_to`);
      if (from) init[`${f.key}_from`] = from;
      if (to) init[`${f.key}_to`] = to;
    }
    return init;
  });

  const set = useCallback((key: string, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const unset = useCallback((key: string) => {
    setDraft((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleApply = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    for (const f of textFilters) {
      const v = draft[f.key];
      if (v) params.set(f.key, v); else params.delete(f.key);
    }
    for (const f of dateFilters) {
      const from = draft[`${f.key}_from`];
      const to = draft[`${f.key}_to`];
      if (from) params.set(`${f.key}_from`, from); else params.delete(`${f.key}_from`);
      if (to) params.set(`${f.key}_to`, to); else params.delete(`${f.key}_to`);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [draft, textFilters, dateFilters, searchParams, router, pathname]);

  const handleClear = useCallback(() => {
    const defaultDraft: Record<string, string> = {};
    for (const f of dateFilters) {
      defaultDraft[`${f.key}_from`] = dayjs().subtract(30, "day").startOf("day").format("YYYY-MM-DD");
      defaultDraft[`${f.key}_to`] = dayjs().endOf("day").format("YYYY-MM-DD");
    }
    setDraft(defaultDraft);
    const params = new URLSearchParams(searchParams.toString());
    for (const f of textFilters) params.delete(f.key);
    for (const f of dateFilters) {
      params.delete(`${f.key}_from`);
      params.delete(`${f.key}_to`);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [dateFilters, textFilters, searchParams, router, pathname]);

  const hasValues = Object.values(draft).some(Boolean);

  const totalCount = filters.length;
  const description =
    totalCount === 1
      ? t("filtersDescriptionSingular", { count: "1" })
      : t("filtersDescriptionPlural", { count: String(totalCount) });

  return (
    <ExpandableSection
      customIcon={
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
          <HiAdjustmentsHorizontal className="h-4 w-4 text-gray-600 dark:text-gray-300" />
        </div>
      }
      title={t("filtersTitle")}
      description={description}
      defaultExpanded
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-x-3 gap-y-2">
          {textFilters.map((filter) => (
            <div key={filter.key} className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-400 dark:text-gray-500">
                {filter.label}
              </label>
              <input
                type="text"
                placeholder={t("filterByPlaceholder", { label: filter.label.toLowerCase() })}
                value={draft[filter.key] ?? ""}
                onChange={(e) =>
                  e.target.value ? set(filter.key, e.target.value) : unset(filter.key)
                }
                className={INPUT_CLS}
              />
            </div>
          ))}
          {dateFilters.map((filter) => (
            <div key={filter.key} className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-400 dark:text-gray-500">
                {filter.label}
              </label>
              <TimeRangePicker
                dictionary={dictionary}
                mode="date"
                ranges="date"
                fullWidth
                from={draft[`${filter.key}_from`]}
                to={draft[`${filter.key}_to`]}
                onDateChange={(from, to) => {
                  if (from) set(`${filter.key}_from`, from); else unset(`${filter.key}_from`);
                  if (to) set(`${filter.key}_to`, to); else unset(`${filter.key}_to`);
                }}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button size="xs" color="light" onClick={handleClear} disabled={!hasValues}>
            {t("clearFilters")}
          </Button>
          <Button size="xs" color="blue" onClick={handleApply}>
            {t("applyFilters")}
          </Button>
        </div>
      </div>
    </ExpandableSection>
  );
}
