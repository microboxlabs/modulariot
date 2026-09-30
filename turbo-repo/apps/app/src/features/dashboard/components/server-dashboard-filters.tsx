"use client";
import { DashboardFilterEditor } from "@microboxlabs/miot-dashboard-ui/react";
import { useDashboard } from "../context/dashboard-context";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
/** Filter definitions for the gear menu; options may come from saved queries. */
export function ServerDashboardFilters({
  dictionary,
}: Readonly<{ dictionary: I18nRecord }>) {
  const { filters, setFilterDefinitions, queries } = useDashboard();
  const t = (key: string) => tr(`dashboard.server.settings.${key}`, dictionary);
  return (
    <div className="space-y-3 p-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t("filters.hint")}
      </p>
      <DashboardFilterEditor
        sources={{
          queries,
          labels: {
            source: t("filters.source"),
            static: t("filters.static"),
            columns: t("filters.columns"),
            unavailable: t("filters.unavailable"),
            valueField: t("filters.valueField"),
            labelField: t("filters.labelField"),
            single: t("filters.single"),
          },
        }}
        value={filters}
        editable
        onApply={setFilterDefinitions}
        labels={{
          key: t("filters.key"),
          label: t("filters.label"),
          type: t("filters.type"),
          unique: t("filters.unique"),
          add: t("filters.add"),
          remove: t("filters.remove"),
          optionLabel: t("filters.optionLabel"),
          optionValue: t("filters.optionValue"),
          addOption: t("filters.addOption"),
          removeOption: t("filters.removeOption"),
          apply: t("filters.apply"),
          invalid: t("filters.invalid"),
          rejected: t("rejected"),
          empty: t("filters.empty"),
          types: {
            text: t("filters.text"),
            date_range: t("filters.dateRange"),
            select: t("filters.select"),
          },
        }}
      />
    </div>
  );
}
