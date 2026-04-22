"use client";

import { useState } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { RefreshIntervalSelect } from "./refresh-interval-select";

/**
 * Manages widget-level refresh interval state and provides props for the
 * RefreshIntervalSelect + the save payload.
 *
 * Usage:
 * ```ts
 * const refresh = useWidgetRefreshSettings(config, dictionary);
 * // In save: onSave({ ...myFields, ...refresh.savePayload });
 * // In shell: <SettingsShell footer={refresh.selectNode} ... />
 * ```
 */
export function useWidgetRefreshSettings(
  config: object,
  dictionary: I18nRecord
) {
  const [value, setValue] = useState<number | "inherit">(() => {
    const v = "refreshInterval" in config ? config.refreshInterval : undefined;
    return typeof v === "number" ? v : "inherit";
  });

  const savePayload =
    value === "inherit"
      ? { refreshInterval: undefined }
      : { refreshInterval: value };

  const selectNode = (
    <RefreshIntervalSelect
      value={value}
      onChange={setValue}
      dictionary={dictionary}
    />
  );

  return { value, setValue, savePayload, selectNode };
}
