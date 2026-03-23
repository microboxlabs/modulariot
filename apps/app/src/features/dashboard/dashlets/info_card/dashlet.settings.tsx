"use client";

import { useRef, useState } from "react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, InfoCardIcon } from "./dashlet";
import { ICON_OPTIONS } from "./dashlet";
import { tr } from "@/features/i18n/tr.service";
import {
  IconPickerDropdown,
  type IconOption,
} from "@/features/common/components/icon-picker-dropdown";
import {
  SettingsPickerRow,
  SettingsPickerItem,
  HbTextField,
  HbTextareaField,
  useDataProvider,
  usePgrestSettingsState,
  fromPgrestParamItems,
  buildSimplePgrestConfig,
  PgrestDataTab,
  useActiveProviders,
  DataProviderEntries,
  type SimpleDataMode,
} from "../common";
import { SettingsModalShell } from "../common/settings-modal-shell";

/** Convert ICON_OPTIONS to IconPickerDropdown format */
const ICON_PICKER_OPTIONS: IconOption<InfoCardIcon>[] = ICON_OPTIONS.map(
  (opt) => ({
    value: opt.id,
    label: opt.label,
    icon: opt.component,
  })
);

const DEFAULT_DATA_ENTRIES = [
  { key: "title", value: "Example Title" },
  { key: "value", value: "100" },
];

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const activeProviders = useActiveProviders();

  const [title, setTitle] = useState(config.title || "Metric");
  const [icon, setIcon] = useState<InfoCardIcon>(config.icon || "chart");
  const [value, setValue] = useState(config.value || "100%");
  const [descriptor, setDescriptor] = useState(
    config.descriptor || "Percentage of tasks completed"
  );
  const [aiPlaceholder, setAiPlaceholder] = useState(
    config.aiPlaceholder || "AI summary will appear here"
  );
  const [viewMoreUrl, setViewMoreUrl] = useState(config.viewMoreUrl || "");
  const [dataMode, setDataMode] = useState<SimpleDataMode>(
    config.dataMode === "static" || config.dataMode === "pgrest"
      ? config.dataMode
      : "static",
  );
  const [dataSourceId, setDataSourceId] = useState<string>(
    config.dataSourceId ?? ""
  );

  const dp = useDataProvider(
    (config as DashletConfig & { dataProvider?: import("../types").DataProviderEntry[] })
      .dataProvider || DEFAULT_DATA_ENTRIES
  );

  const staticSnapshot = useRef({ title, value, descriptor, aiPlaceholder, viewMoreUrl });

  const handleDataModeChange = (mode: SimpleDataMode) => {
    if (mode === "pgrest" && dataMode === "static") {
      staticSnapshot.current = { title, value, descriptor, aiPlaceholder, viewMoreUrl };
    } else if (mode === "static" && dataMode === "pgrest") {
      setTitle(staticSnapshot.current.title);
      setValue(staticSnapshot.current.value);
      setDescriptor(staticSnapshot.current.descriptor);
      setAiPlaceholder(staticSnapshot.current.aiPlaceholder);
      setViewMoreUrl(staticSnapshot.current.viewMoreUrl);
    }
    setDataMode(mode);
  };

  const pg = usePgrestSettingsState({
    ...buildSimplePgrestConfig({ ...config, dataSourceId: dataSourceId || undefined }, (detected) => {
      if (detected.length >= 1) setTitle(`{{row.${detected[0].key}}}`);
      if (detected.length >= 2) setValue(`{{row.${detected[1].key}}}`);
      if (detected.length >= 3) setDescriptor(`{{row.${detected[2].key}}}`);
    }),
  });

  const handleSave = () => {
    onSave({
      title,
      icon,
      value,
      descriptor,
      aiPlaceholder,
      viewMoreUrl,
      dataProvider: dp.getCleanEntries(),
      dataMode,
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
      dataSourceId: dataSourceId || undefined,
    } as DashletConfig);
    onClose();
  };

  const visualizationTab = (
    <>
      <HbTextField
        id="title"
        label={tr("common.title", dictionary)}
        value={title}
        onChange={setTitle}
        placeholder={tr("dashboard.settings.titlePlaceholder", dictionary)}
      />

      <SettingsPickerRow>
        <SettingsPickerItem label={tr("dashboard.settings.icon", dictionary)}>
          <IconPickerDropdown
            options={ICON_PICKER_OPTIONS}
            value={icon}
            onChange={setIcon}
            title={tr("dashboard.settings.selectIcon", dictionary)}
          />
        </SettingsPickerItem>
      </SettingsPickerRow>

      <HbTextField
        id="value"
        label={tr("common.value", dictionary)}
        value={value}
        onChange={setValue}
        placeholder={tr("dashboard.settings.valuePlaceholder", dictionary)}
      />

      <HbTextareaField
        id="descriptor"
        label={tr("dashboard.settings.descriptor", dictionary)}
        value={descriptor}
        onChange={setDescriptor}
        placeholder={tr("dashboard.settings.descriptorPlaceholder", dictionary)}
        rows={2}
      />

      <HbTextareaField
        id="aiPlaceholder"
        label={tr("dashboard.settings.aiPlaceholder", dictionary)}
        value={aiPlaceholder}
        onChange={setAiPlaceholder}
        placeholder={tr("dashboard.settings.aiPlaceholderPlaceholder", dictionary)}
        rows={2}
      />

      <HbTextField
        id="viewMoreUrl"
        label={tr("dashboard.settings.viewMoreUrl", dictionary)}
        value={viewMoreUrl}
        onChange={setViewMoreUrl}
        placeholder="https://example.com/details"
      />
    </>
  );

  const dataTab = (
    <>
      <PgrestDataTab
        id="ic-data-mode"
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
