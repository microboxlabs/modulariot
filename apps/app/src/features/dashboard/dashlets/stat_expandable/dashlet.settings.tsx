"use client";

import { useRef, useState } from "react";
import { Button, TextInput, Label } from "flowbite-react";
import { HiPlus, HiTrash } from "react-icons/hi2";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import {
  HbTextFieldList,
  usePgrestSettingsState,
  fromPgrestParamItems,
  buildSimplePgrestConfig,
  PgrestDataTab,
  useActiveProviders,
} from "../common";
import { SettingsModalShell } from "../common/settings-modal-shell";

type SimpleDataMode = "static" | "pgrest";

interface DetailWithId {
  id: string;
  label: string;
  value: string;
}

const FIELDS = [
  { id: "se-title", labelKey: "common.title", state: "title", hbPlaceholder: "{{row.label}}", staticPlaceholder: "Conversion Rate" },
  { id: "se-value", labelKey: "common.value", state: "value", hbPlaceholder: "{{row.rate}}", staticPlaceholder: "3.24" },
  { id: "se-unit", labelKey: "common.unit", state: "unit", hbPlaceholder: "{{row.unit}}", staticPlaceholder: "%" },
] as const;

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const activeProviders = useActiveProviders();

  const [title, setTitle] = useState(config.title || "Conversion Rate");
  const [value, setValue] = useState(String(config.value ?? "3.24"));
  const [unit, setUnit] = useState(config.unit ?? "%");
  const [dataMode, setDataMode] = useState<SimpleDataMode>(
    config.dataMode === "static" || config.dataMode === "pgrest"
      ? config.dataMode
      : "static",
  );
  const [dataSourceId, setDataSourceId] = useState<string>(
    config.dataSourceId ?? ""
  );

  // Initialize details with unique IDs
  const initializeDetails = (): DetailWithId[] => {
    const defaultDetails = [
      { label: "Visitors", value: "12,847" },
      { label: "Conversions", value: "416" },
    ];
    return (config.details || defaultDetails).map((d) => ({
      ...d,
      id: crypto.randomUUID(),
    }));
  };

  const [details, setDetails] = useState(initializeDetails);

  const staticSnapshot = useRef({ title, value, unit });

  const handleDataModeChange = (mode: SimpleDataMode) => {
    if (mode === "pgrest" && dataMode === "static") {
      staticSnapshot.current = { title, value, unit };
    } else if (mode === "static" && dataMode === "pgrest") {
      setTitle(staticSnapshot.current.title);
      setValue(staticSnapshot.current.value);
      setUnit(staticSnapshot.current.unit);
    }
    setDataMode(mode);
  };

  const pg = usePgrestSettingsState({
    ...buildSimplePgrestConfig({ ...config, dataSourceId: dataSourceId || undefined }, (detected) => {
      if (detected.length >= 1) setTitle(`{{row.${detected[0].key}}}`);
      if (detected.length >= 2) setValue(`{{row.${detected[1].key}}}`);
      if (detected.length >= 3) setUnit(`{{row.${detected[2].key}}}`);
    }),
  });

  const handleSave = () => {
    const detailsToSave = details.map(({ label, value }) => ({ label, value }));
    onSave({
      title: title.trim() || "Conversion Rate",
      value: value.trim() || "3.24",
      unit: unit.trim() || "%",
      details: detailsToSave,
      dataMode,
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
      dataSourceId: dataSourceId || undefined,
    });
    onClose();
  };

  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  const addDetail = () =>
    setDetails([...details, { id: crypto.randomUUID(), label: "", value: "" }]);

  const removeDetail = (id: string) =>
    setDetails(details.filter((d) => d.id !== id));

  const updateDetail = (id: string, field: "label" | "value", val: string) => {
    setDetails(details.map((d) => (d.id === id ? { ...d, [field]: val } : d)));
  };

  const isPgrest = dataMode === "pgrest";

  const fieldValues: Record<string, string> = { title, value, unit };
  const fieldSetters: Record<string, (v: string) => void> = {
    title: setTitle,
    value: setValue,
    unit: setUnit,
  };

  const visualizationTab = (
    <>
      <HbTextFieldList
        fields={FIELDS}
        fieldValues={fieldValues}
        fieldSetters={fieldSetters}
        isPgrest={isPgrest}
        dictionary={dictionary}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Expandable Details</Label>
          <Button
            size="xs"
            color="light"
            onClick={addDetail}
            onMouseDown={handleMouseDown}
            className="no-drag"
          >
            <HiPlus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>
        {details.map((d) => (
          <div key={d.id} className="flex items-center gap-2">
            <TextInput
              value={d.label}
              onChange={(e) => updateDetail(d.id, "label", e.target.value)}
              placeholder="Label"
              sizing="sm"
              className="flex-1"
            />
            <TextInput
              value={d.value}
              onChange={(e) => updateDetail(d.id, "value", e.target.value)}
              placeholder="Value"
              sizing="sm"
              className="flex-1"
            />
            <Button
              size="xs"
              color="failure"
              onClick={() => removeDetail(d.id)}
              onMouseDown={handleMouseDown}
              className="no-drag"
            >
              <HiTrash className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </>
  );

  const dataTab = (
    <PgrestDataTab
      id="se-data-mode"
      dataMode={dataMode}
      onDataModeChange={handleDataModeChange}
      pgrest={pg}
      dictionary={dictionary}
      dataSourceId={dataSourceId}
      onDataSourceIdChange={setDataSourceId}
      activeProviders={activeProviders}
    />
  );

  return (
    <SettingsModalShell
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      dictionary={dictionary}
      visualizationTab={visualizationTab}
      dataTab={dataTab}
    />
  );
}
