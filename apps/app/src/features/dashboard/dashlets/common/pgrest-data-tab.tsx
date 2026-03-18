"use client";

import { SettingsSelectField } from "./settings-fields";
import { PgrestSettingsSection } from "./pgrest-settings-section";
import type { usePgrestSettingsState } from "./use-pgrest-settings-state";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { buildPgrestContentLabels } from "./pgrest-settings-helpers";

interface PgrestDataTabProps {
  id: string;
  dataMode: string;
  onDataModeChange: (mode: string) => void;
  pgrest: ReturnType<typeof usePgrestSettingsState>;
  dictionary: I18nRecord;
}

/**
 * Reusable data-provider tab content for card-style dashlet settings.
 * Renders a static/pgrest mode selector and, when pgrest is selected,
 * the full PgrestSettingsSection.
 */
export function PgrestDataTab({
  id,
  dataMode,
  onDataModeChange,
  pgrest,
  dictionary,
}: Readonly<PgrestDataTabProps>) {
  const labels = buildPgrestContentLabels(dictionary);

  return (
    <>
      <SettingsSelectField
        id={id}
        label={tr("dashboard.settings.dataSource", dictionary)}
        value={dataMode}
        onChange={onDataModeChange}
        options={[
          {
            value: "static",
            label: tr("dashboard.settings.staticJson", dictionary),
          },
          {
            value: "pgrest",
            label: tr("dashboard.settings.pgrest", dictionary),
          },
        ]}
      />
      {dataMode === "pgrest" && (
        <PgrestSettingsSection pgrest={pgrest} labels={labels} />
      )}
    </>
  );
}
