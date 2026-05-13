"use client";

import { useState } from "react";
import { TextInput, Label } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import { SettingsShell } from "../common/settings-shell";
import { useSettingsDirty } from "../common/use-settings-dirty";
import { SettingsSelectField } from "../common/settings-fields";
import { PgrestFunctionAutocomplete } from "../common/pgrest-function-autocomplete";
import { useDataSources } from "@/features/data-sources/hooks/use-data-sources";
import { useDashboard } from "../../context/dashboard-context";
import { tr } from "@/features/i18n/tr.service";

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  widgetId,
  dashletName,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const { siteId } = useDashboard();
  const { dataSources } = useDataSources(siteId ?? undefined);
  const activeProviders = dataSources.filter(
    (ds) => ds.isActive === true && ds.lastTestResult === true
  );

  const [title, setTitle] = useState(config.title || "");
  const [pgrestFunctionName, setPgrestFunctionName] = useState(
    config.pgrestFunctionName || ""
  );
  const [dataSourceId, setDataSourceId] = useState(config.dataSourceId || "");
  const [acceptedFileTypes, setAcceptedFileTypes] = useState(
    config.acceptedFileTypes || ""
  );

  const isDirty = useSettingsDirty(isOpen, {
    title,
    pgrestFunctionName,
    dataSourceId,
    acceptedFileTypes,
  });

  const handleSave = () => {
    onSave({
      title: title.trim(),
      pgrestFunctionName: pgrestFunctionName.trim(),
      dataSourceId: dataSourceId || undefined,
      acceptedFileTypes: acceptedFileTypes.trim() || undefined,
    });
    onClose();
  };

  return (
    <SettingsShell
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      dictionary={dictionary}
      widgetId={widgetId}
      title={dashletName}
      isDirty={isDirty}
    >
      <div>
        <Label htmlFor="batch-import-title" className="mb-1 block text-sm">
          {tr("dashboard.settings.batchImport.buttonLabel", dictionary)}
        </Label>
        <TextInput
          id="batch-import-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={tr(
            "dashboard.settings.batchImport.buttonLabelPlaceholder",
            dictionary
          )}
        />
      </div>

      <SettingsSelectField
        id="batch-import-datasource"
        label={tr("dashboard.settings.dataSource", dictionary)}
        value={dataSourceId}
        onChange={(v) => {
          if (v === dataSourceId) return;
          setDataSourceId(v);
          setPgrestFunctionName("");
        }}
        options={[
          {
            value: "",
            label: tr("dashboard.settings.batchImport.defaultEnv", dictionary),
          },
          ...activeProviders.map((ds) => ({ value: ds.id, label: ds.name })),
        ]}
      />

      <div>
        <Label className="mb-1 block text-sm">
          {tr("dashboard.settings.batchImport.endpoint", dictionary)}
        </Label>
        <PgrestFunctionAutocomplete
          value={pgrestFunctionName}
          onChange={setPgrestFunctionName}
          onSelect={setPgrestFunctionName}
          dictionary={dictionary}
          dataSourceId={dataSourceId || undefined}
        />
      </div>

      <div>
        <Label htmlFor="batch-import-accept" className="mb-1 block text-sm">
          {tr("dashboard.settings.batchImport.acceptedFileTypes", dictionary)}
        </Label>
        <TextInput
          id="batch-import-accept"
          value={acceptedFileTypes}
          onChange={(e) => setAcceptedFileTypes(e.target.value)}
          placeholder=".csv,.tsv,.txt"
        />
        <p className="mt-1 text-xs text-gray-500">
          {tr(
            "dashboard.settings.batchImport.acceptedFileTypesHint",
            dictionary
          )}
        </p>
      </div>

    </SettingsShell>
  );
}
