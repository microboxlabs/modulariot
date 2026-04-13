"use client";

import type { ReactNode } from "react";
import { useCallback } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { TableColumn } from "./column-types";
import { buildCsvContent, downloadCsv } from "./export-csv";
import { ExportDropdown } from "./export-dropdown";

interface DashletTitleBarProps {
  title: string;
  showRowCount: boolean;
  showExport: boolean;
  /** Rendered text for the row count (each dashlet uses different i18n keys). */
  rowCountLabel: ReactNode;
  columns: TableColumn[];
  displayRows: Record<string, string>[];
  resolveValue: (
    key: string,
    row: Record<string, string>,
    rowIdx: number,
    totalRows: number
  ) => string;
  resolveLabel: (key: string) => string;
  dictionary: I18nRecord;
}

export function DashletTitleBar({
  title,
  showRowCount,
  showExport,
  rowCountLabel,
  columns,
  displayRows,
  resolveValue,
  resolveLabel,
  dictionary,
}: Readonly<DashletTitleBarProps>) {
  const handleExportCsv = useCallback(() => {
    const csv = buildCsvContent(columns, displayRows, resolveValue, resolveLabel);
    downloadCsv(csv, `${title}.csv`);
  }, [columns, displayRows, resolveValue, resolveLabel, title]);

  return (
    <div className="flex shrink-0 items-start justify-between">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
        {title}
      </h3>
      <div className="flex items-center gap-2">
        {showRowCount && (
          <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">
            {rowCountLabel}
          </span>
        )}
        {showExport && displayRows.length > 0 && (
          <ExportDropdown
            ariaLabel={tr("dashboard.settings.exportCsv", dictionary)}
            csvLabel="CSV"
            onExportCsv={handleExportCsv}
          />
        )}
      </div>
    </div>
  );
}
