"use client";

import { Select, Label } from "flowbite-react";
import { REFRESH_INTERVAL_OPTIONS } from "../../types/dashboard.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

interface RefreshIntervalSelectProps {
  /** Current value: number (seconds) or "inherit" (use dashboard setting) */
  value: number | "inherit" | undefined;
  onChange: (value: number | "inherit") => void;
  dictionary: I18nRecord;
}

export function RefreshIntervalSelect({
  value,
  onChange,
  dictionary,
}: Readonly<RefreshIntervalSelectProps>) {
  const t = (key: string) => tr(`dashboard.settings.${key}`, dictionary);
  const current = value === undefined || value === "inherit" ? "inherit" : String(value);

  return (
    <div className="flex items-center gap-2 shrink-0">
      <Label className="text-xs whitespace-nowrap text-gray-500 dark:text-gray-400">
        {t("autoRefresh")}
      </Label>
      <Select
        sizing="sm"
        value={current}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "inherit" ? "inherit" : Number(v));
        }}
        className="w-44"
      >
        <option value="inherit">{t("widgetRefreshInherit")}</option>
        {REFRESH_INTERVAL_OPTIONS.map((opt) => (
          <option key={opt.value} value={String(opt.value)}>
            {t(opt.labelKey)}
          </option>
        ))}
      </Select>
    </div>
  );
}
