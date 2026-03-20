"use client";

import { useRef, useState } from "react";
import { Label, Textarea, ToggleSwitch } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, TextAlign } from "./dashlet";
import {
  SettingsSelectField,
  getHandlebarsStatus,
  getFlowbiteColor,
  useDataProvider,
  usePgrestSettingsState,
  fromPgrestParamItems,
  buildSimplePgrestConfig,
  PgrestDataTab,
  useActiveProviders,
  DataProviderEntries,
} from "../common";
import { SettingsModalShell } from "../common/settings-modal-shell";

type SimpleDataMode = "static" | "pgrest";

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const activeProviders = useActiveProviders();

  const [text, setText] = useState(config.text ?? "Add your text or quote here...");
  const [italic, setItalic] = useState(config.italic ?? true);
  const [align, setAlign] = useState<TextAlign>(config.align ?? "left");
  const [dataMode, setDataMode] = useState<SimpleDataMode>(
    config.dataMode === "static" || config.dataMode === "pgrest"
      ? config.dataMode
      : "static",
  );
  const [dataSourceId, setDataSourceId] = useState<string>(
    config.dataSourceId ?? ""
  );

  const dp = useDataProvider(config.dataProvider ?? []);

  const staticSnapshot = useRef({ text });

  const handleDataModeChange = (mode: SimpleDataMode) => {
    if (mode === "pgrest" && dataMode === "static") {
      staticSnapshot.current = { text };
    } else if (mode === "static" && dataMode === "pgrest") {
      setText(staticSnapshot.current.text);
    }
    setDataMode(mode);
  };

  const pg = usePgrestSettingsState({
    ...buildSimplePgrestConfig({ ...config, dataSourceId: dataSourceId || undefined }, (detected) => {
      if (detected.length >= 1) setText(`{{row.${detected[0].key}}}`);
    }),
  });

  const handleSave = () => {
    onSave({
      text,
      italic,
      align,
      dataProvider: dp.getCleanEntries(),
      dataMode,
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
      dataSourceId: dataSourceId || undefined,
    } as DashletConfig);
    onClose();
  };

  const textStatus = getHandlebarsStatus(text);

  const visualizationTab = (
    <>
      <div>
        <Label htmlFor="tc-text" className="mb-1 block text-sm font-medium">
          Text
        </Label>
        <Textarea
          id="tc-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add your text or quote here..."
          rows={4}
          className="text-sm"
          color={getFlowbiteColor(textStatus)}
        />
      </div>
      <SettingsSelectField
        id="tc-align"
        label="Alignment"
        value={align}
        onChange={(v) => setAlign(v as TextAlign)}
        options={[
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
          { value: "right", label: "Right" },
        ]}
      />
      <div className="flex items-center justify-between">
        <Label className="text-sm">Italic</Label>
        <ToggleSwitch
          checked={italic}
          onChange={setItalic}
          label=""
        />
      </div>
    </>
  );

  const dataTab = (
    <>
      <PgrestDataTab
        id="tc-data-mode"
        dataMode={dataMode}
        onDataModeChange={handleDataModeChange}
        pgrest={pg}
        dictionary={dictionary}
        dataSourceId={dataSourceId}
        onDataSourceIdChange={setDataSourceId}
        activeProviders={activeProviders}
      />
      <DataProviderEntries dataProvider={dp} dictionary={dictionary} />
    </>
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
