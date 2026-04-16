"use client";

import { useState } from "react";
import { Button, TextInput, Label } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import { SettingsDrawer } from "../common/settings-drawer";
import { SettingsSelectField } from "../common/settings-fields";
import { PgrestFunctionAutocomplete } from "../common/pgrest-function-autocomplete";
import { useDataSources } from "@/features/data-sources/hooks/use-data-sources";
import { useDashboard } from "../../context/dashboard-context";
import { tr } from "@/features/i18n/tr.service";

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

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

  const [title, setTitle] = useState(config.title || "");
  const [pgrestFunctionName, setPgrestFunctionName] = useState(config.pgrestFunctionName || "");
  const [dataSourceId, setDataSourceId] = useState(config.dataSourceId || "");
  const [acceptedFileTypes, setAcceptedFileTypes] = useState(config.acceptedFileTypes || "");

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
    <SettingsDrawer open={isOpen} onClose={onClose}>
      <div className="flex h-full flex-col gap-3">
        <div>
          <Label htmlFor="upload-title" className="mb-1 block text-sm">
            {tr("dashboard.settings.fileUpload.buttonLabel", dictionary)}
          </Label>
          <TextInput
            id="upload-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={tr("dashboard.settings.fileUpload.buttonLabelPlaceholder", dictionary)}
          />
        </div>

        <SettingsSelectField
          id="upload-datasource"
          label={tr("dashboard.settings.dataSource", dictionary)}
          value={dataSourceId}
          onChange={setDataSourceId}
          options={[
            { value: "", label: tr("dashboard.settings.fileUpload.defaultEnv", dictionary) },
            ...activeProviders.map((ds) => ({ value: ds.id, label: ds.name })),
          ]}
        />

        <div>
          <Label className="mb-1 block text-sm">
            {tr("dashboard.settings.fileUpload.uploadEndpoint", dictionary)}
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
          <Label htmlFor="upload-accept" className="mb-1 block text-sm">
            {tr("dashboard.settings.fileUpload.acceptedFileTypes", dictionary)}
          </Label>
          <TextInput
            id="upload-accept"
            value={acceptedFileTypes}
            onChange={(e) => setAcceptedFileTypes(e.target.value)}
            placeholder=".csv,.xlsx,.json"
          />
          <p className="mt-1 text-xs text-gray-500">
            {tr("dashboard.settings.fileUpload.acceptedFileTypesHint", dictionary)}
          </p>
        </div>

        <div className="flex w-full justify-end gap-2">
          <Button
            color="gray"
            onClick={onClose}
            className="no-drag w-full"
            onMouseDown={stopPropagation}
          >
            {tr("common.cancel", dictionary)}
          </Button>
          <Button
            color="blue"
            onClick={handleSave}
            className="no-drag w-full"
            onMouseDown={stopPropagation}
          >
            {tr("common.save", dictionary)}
          </Button>
        </div>
      </div>
    </SettingsDrawer>
  );
}
