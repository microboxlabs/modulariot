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

  const [title, setTitle] = useState(config.title || "Upload File");
  const [pgrestFunctionName, setPgrestFunctionName] = useState(config.pgrestFunctionName || "");
  const [dataSourceId, setDataSourceId] = useState(config.dataSourceId || "");
  const [acceptedFileTypes, setAcceptedFileTypes] = useState(config.acceptedFileTypes || "");

  const handleSave = () => {
    onSave({
      title: title.trim() || "Upload File",
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
            Button Label
          </Label>
          <TextInput
            id="upload-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Upload File"
          />
        </div>

        <SettingsSelectField
          id="upload-datasource"
          label="Data Source"
          value={dataSourceId}
          onChange={setDataSourceId}
          options={[
            { value: "", label: "Default (env)" },
            ...activeProviders.map((ds) => ({ value: ds.id, label: ds.name })),
          ]}
        />

        <div>
          <Label className="mb-1 block text-sm">
            Upload Endpoint
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
            Accepted File Types
          </Label>
          <TextInput
            id="upload-accept"
            value={acceptedFileTypes}
            onChange={(e) => setAcceptedFileTypes(e.target.value)}
            placeholder=".csv,.xlsx,.json"
          />
          <p className="mt-1 text-xs text-gray-500">
            Comma-separated extensions or MIME types. Leave empty to accept all.
          </p>
        </div>

        <div className="flex w-full justify-end gap-2">
          <Button
            color="gray"
            onClick={onClose}
            className="no-drag w-full"
            onMouseDown={stopPropagation}
          >
            Cancel
          </Button>
          <Button
            color="blue"
            onClick={handleSave}
            className="no-drag w-full"
            onMouseDown={stopPropagation}
          >
            Save
          </Button>
        </div>
      </div>
    </SettingsDrawer>
  );
}
