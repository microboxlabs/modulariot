"use client";

import { useState } from "react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import {
  defaultColumns,
  defaultRows,
  defaultSort,
  defaultFilter,
} from "./dashlet";
import { useSettingsState } from "../common/use-settings-state";
import { usePgrestSettingsState } from "../common/use-pgrest-settings-state";
import { PgrestSettingsSection } from "../common/pgrest-settings-section";
import { TableListSettingsShell } from "../common/table-list-settings-shell";
import { fromPgrestParamItems } from "../common/pgrest-types";
import { buildPgrestSettingsConfig, buildPgrestContentLabels } from "../common/pgrest-settings-helpers";
import { tr } from "@/features/i18n/tr.service";
import { useDashboard } from "@/features/dashboard/context/dashboard-context";
import { useDataSources } from "@/features/data-sources/hooks/use-data-sources";

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const { siteId } = useDashboard();
  const { dataSources } = useDataSources(siteId ?? undefined);

  const activeProviders = dataSources.filter(
    (ds) => ds.isActive === true && ds.lastTestResult === true
  );

  const [dataSourceId, setDataSourceId] = useState<string>(
    config.dataSourceId ?? ""
  );

  const s = useSettingsState({
    title: config.title,
    defaultTitle: "Data Table",
    showRowCount: config.showRowCount,
    columns: config.columns,
    defaultColumns,
    rows: config.rows,
    defaultRows,
    filter: config.filter,
    defaultFilter,
    sort: config.sort,
    defaultSort,
    dataMode: config.dataMode === "pgrest" ? "pgrest" : (config.dataMode ?? "static"),
    apiUrl: "",
  });

  const pg = usePgrestSettingsState({
    pgrestFunctionName: config.pgrestFunctionName ?? "",
    pgrestParams: config.pgrestParams ?? [],
    pgrestHttpMethod: config.pgrestHttpMethod ?? "POST",
    dataSourceId: dataSourceId || undefined,
    ...buildPgrestSettingsConfig(s),
  });

  const handleSave = () => {
    const rows = s.parseRows(
      tr("dashboard.settings.mustBeJsonArray", dictionary),
      tr("dashboard.settings.invalidJson", dictionary),
    );
    if (!rows) return;

    const { filter, sort, savedColumns } = s.buildFilterSort();

    onSave({
      title: s.title,
      showRowCount: s.showRowCount,
      dataMode: s.dataMode as "static" | "pgrest",
      columns: savedColumns,
      rows,
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
      filter,
      sort,
      dataSourceId: dataSourceId || undefined,
    });
    onClose();
  };

  const pgrestContent = (
    <PgrestSettingsSection
      pgrest={pg}
      dictionary={dictionary}
      labels={buildPgrestContentLabels(dictionary)}
      dataSourceId={dataSourceId}
      onDataSourceIdChange={setDataSourceId}
      activeProviders={activeProviders}
    />
  );

  return (
    <TableListSettingsShell
      id="dt"
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      state={s}
      dictionary={dictionary}
      dataTabChildren={pgrestContent}
      handlebarsColorKeys
    />
  );
}
