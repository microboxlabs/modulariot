"use client";

import {
  ColorPickerDropdown,
  type ColorOption,
} from "@/features/common/components/color-picker-dropdown";
import { IconPickerDropdown } from "@/features/common/components/icon-picker-dropdown";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { SettingsPickerRow, SettingsPickerItem } from "./settings-fields";
import { DASHLET_ICON_OPTIONS, type DashletIconKey } from "./icon-options";

interface IconColorPickerRowProps<TColor extends string> {
  icon: DashletIconKey;
  onIconChange: (icon: DashletIconKey) => void;
  colorOptions: ColorOption<TColor>[];
  color: TColor;
  onColorChange: (color: TColor) => void;
  dictionary: I18nRecord;
}

export function IconColorPickerRow<TColor extends string>({
  icon,
  onIconChange,
  colorOptions,
  color,
  onColorChange,
  dictionary,
}: Readonly<IconColorPickerRowProps<TColor>>) {
  return (
    <SettingsPickerRow>
      <SettingsPickerItem label={tr("dashboard.settings.icon", dictionary)}>
        <IconPickerDropdown
          options={DASHLET_ICON_OPTIONS}
          value={icon}
          onChange={onIconChange}
          title={tr("dashboard.settings.icon", dictionary)}
        />
      </SettingsPickerItem>
      <SettingsPickerItem label={tr("dashboard.settings.color", dictionary)}>
        <ColorPickerDropdown
          options={colorOptions}
          value={color}
          onChange={onColorChange}
          title={tr("dashboard.settings.color", dictionary)}
        />
      </SettingsPickerItem>
    </SettingsPickerRow>
  );
}
