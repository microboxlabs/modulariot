"use client";

import { useState } from "react";
import { Label, Checkbox, TextInput } from "flowbite-react";
import { twMerge } from "tailwind-merge";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, CardVariant } from "./dashlet";
import { SimpleDashletSettings } from "../common/simple-dashlet-settings";
import {
  getHandlebarsStatus,
  getFlowbiteColor,
} from "../common/handlebars-helpers";
import { IconPickerDropdown } from "@/features/common/components/icon-picker-dropdown";
import {
  AdvancedColorPicker,
  type PresetColor,
} from "@/features/common/components/advanced-color-picker";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  useValueColorSettings,
  ValueColorRulesEditor,
} from "./value-color-rules";

/** Text-appropriate presets (darker, readable colors) */
const TEXT_PRESETS: PresetColor[] = [
  { value: "111827", label: "Near Black" },
  { value: "1f2937", label: "Dark Gray" },
  { value: "374151", label: "Gray" },
  { value: "4b5563", label: "Medium Gray" },
  { value: "1e3a8a", label: "Dark Blue" },
  { value: "166534", label: "Dark Green" },
  { value: "7c2d12", label: "Dark Orange" },
  { value: "7f1d1d", label: "Dark Red" },
];

const FIELDS = [
  {
    id: "si-title",
    labelKey: "common.title",
    state: "title",
    hbPlaceholder: "{{row.label}}",
    staticPlaceholder: "Orders",
  },
  {
    id: "si-value",
    labelKey: "common.value",
    state: "value",
    hbPlaceholder: "{{row.count}}",
    staticPlaceholder: "156",
  },
  {
    id: "si-unit",
    labelKey: "common.unit",
    state: "unit",
    hbPlaceholder: "{{row.unit}}",
    staticPlaceholder: "",
  },
  {
    id: "si-subtitle",
    labelKey: "common.subtitle",
    state: "subtitle",
    hbPlaceholder: "{{row.subtitle}}",
    staticPlaceholder: "Last 24 hours",
  },
] as const;

const VARIANT_OPTIONS: { value: CardVariant; labelKey: string }[] = [
  { value: "horizontal", labelKey: "dashboard.settings.horizontal" },
  { value: "vertical", labelKey: "dashboard.settings.vertical" },
];

export function DashletSettings(
  props: Readonly<DashletSettingsProps<DashletConfig>>
) {
  const { dictionary } = props;
  const [cardVariant, setCardVariant] = useState<CardVariant>(
    props.config.cardVariant ?? "horizontal"
  );
  const [showIcon, setShowIcon] = useState(props.config.showIcon !== false);
  const [icon, setIcon] = useState<string>(props.config.icon ?? "cart");
  const [iconColor, setIconColor] = useState<string>(
    props.config.iconColor ?? "3b82f6"
  );
  const [showBgColor, setShowBgColor] = useState(
    props.config.showBgColor === true
  );
  const [bgColor, setBgColor] = useState<string>(
    props.config.bgColor ?? "3b82f6"
  );
  const [valueColor, setValueColor] = useState<string>(
    props.config.valueColor ?? "1f2937"
  );
  const [showValueColor, setShowValueColor] = useState(
    props.config.showValueColor === true
  );
  const [secondaryColor, setSecondaryColor] = useState<string>(
    props.config.secondaryColor ?? "6b7280"
  );
  const [showSecondaryColor, setShowSecondaryColor] = useState(
    props.config.showSecondaryColor === true
  );
  const [expandable, setExpandable] = useState(
    props.config.expandable === true
  );
  const [showGoTo, setShowGoTo] = useState(props.config.showGoTo === true);
  const [goToUrl, setGoToUrl] = useState<string>(props.config.goToUrl ?? "");

  const valueColorRules = useValueColorSettings(props.config);

  return (
    <SimpleDashletSettings
      fields={FIELDS}
      idPrefix="si"
      settingsProps={props}
      extraSaveFields={{
        cardVariant,
        showIcon,
        icon,
        iconColor,
        showBgColor,
        bgColor,
        valueColor,
        showValueColor,
        secondaryColor,
        showSecondaryColor,
        expandable,
        showGoTo,
        goToUrl,
        ...valueColorRules.buildSavePayload(),
      }}
      extraVisualization={
        <div className="space-y-3">
          {/* Variant selector - toggle buttons */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">
              {tr("dashboard.settings.cardLayout", dictionary)}
            </Label>
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
              {VARIANT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCardVariant(opt.value)}
                  className={twMerge(
                    "flex-1 px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
                    cardVariant === opt.value
                      ? "bg-primary-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  )}
                >
                  {trDynamic(opt.labelKey, dictionary)}
                </button>
              ))}
            </div>
          </div>

          {/* Separator */}
          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Expandable toggle */}
          <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700">
            <div className="flex items-center gap-2">
              <Checkbox
                id="si-expandable"
                checked={expandable}
                onChange={(e) => setExpandable(e.target.checked)}
              />
              <Label
                htmlFor="si-expandable"
                className="text-sm font-medium cursor-pointer"
              >
                {tr("dashboard.settings.expandable", dictionary)}
              </Label>
            </div>
          </div>

          {/* Icon settings row: checkbox + icon picker + color picker */}
          <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700">
            <div className="flex items-center gap-2">
              <Checkbox
                id="si-show-icon"
                checked={showIcon}
                onChange={(e) => setShowIcon(e.target.checked)}
              />
              <Label
                htmlFor="si-show-icon"
                className="text-sm font-medium cursor-pointer"
              >
                {tr("dashboard.settings.icon", dictionary)}
              </Label>
            </div>
            <div
              className={`flex items-center gap-2 ${showIcon ? "" : "opacity-40 pointer-events-none"}`}
            >
              <IconPickerDropdown
                value={icon}
                onChange={setIcon}
                title={tr("dashboard.settings.selectIcon", dictionary)}
                searchPlaceholder={tr(
                  "dashboard.settings.searchIcons",
                  dictionary
                )}
                emptyMessage={tr("dashboard.settings.noIconsFound", dictionary)}
              />
              <AdvancedColorPicker
                value={iconColor}
                onChange={setIconColor}
                title={tr("dashboard.settings.selectColor", dictionary)}
              />
            </div>
          </div>

          {/* Background color settings row */}
          <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700">
            <div className="flex items-center gap-2">
              <Checkbox
                id="si-show-bg-color"
                checked={showBgColor}
                onChange={(e) => setShowBgColor(e.target.checked)}
              />
              <Label
                htmlFor="si-show-bg-color"
                className="text-sm font-medium cursor-pointer"
              >
                {tr("dashboard.settings.backgroundColor", dictionary)}
              </Label>
            </div>
            <div
              className={`flex items-center gap-2 ${showBgColor ? "" : "opacity-40 pointer-events-none"}`}
            >
              <AdvancedColorPicker
                value={bgColor}
                onChange={setBgColor}
                title={tr("dashboard.settings.selectColor", dictionary)}
              />
            </div>
          </div>

          {/* Primary value color */}
          <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700">
            <div className="flex items-center gap-2">
              <Checkbox
                id="si-show-value-color"
                checked={showValueColor}
                onChange={(e) => setShowValueColor(e.target.checked)}
              />
              <Label
                htmlFor="si-show-value-color"
                className="text-sm font-medium cursor-pointer"
              >
                {tr("dashboard.settings.valueColor", dictionary)}
              </Label>
            </div>
            <div
              className={`flex items-center gap-2 ${showValueColor ? "" : "opacity-40 pointer-events-none"}`}
            >
              <AdvancedColorPicker
                value={valueColor}
                onChange={setValueColor}
                presets={TEXT_PRESETS}
                title={tr("dashboard.settings.selectColor", dictionary)}
              />
            </div>
          </div>

          {/* Secondary text color (title/description) */}
          <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700">
            <div className="flex items-center gap-2">
              <Checkbox
                id="si-show-secondary-color"
                checked={showSecondaryColor}
                onChange={(e) => setShowSecondaryColor(e.target.checked)}
              />
              <Label
                htmlFor="si-show-secondary-color"
                className="text-sm font-medium cursor-pointer"
              >
                {tr("dashboard.settings.secondaryTextColor", dictionary)}
              </Label>
            </div>
            <div
              className={`flex items-center gap-2 ${showSecondaryColor ? "" : "opacity-40 pointer-events-none"}`}
            >
              <AdvancedColorPicker
                value={secondaryColor}
                onChange={setSecondaryColor}
                presets={TEXT_PRESETS}
                title={tr("dashboard.settings.selectColor", dictionary)}
              />
            </div>
          </div>

          {/* Go to (navigation) settings row */}
          <div className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700">
            <div className="flex items-center gap-2">
              <Checkbox
                id="si-show-go-to"
                checked={showGoTo}
                onChange={(e) => setShowGoTo(e.target.checked)}
              />
              <Label
                htmlFor="si-show-go-to"
                className="text-sm font-medium cursor-pointer"
              >
                {tr("dashboard.settings.goTo", dictionary)}
              </Label>
            </div>
            <div
              className={`flex-1 ${showGoTo ? "" : "opacity-40 pointer-events-none"}`}
            >
              <TextInput
                id="si-go-to-url"
                type="text"
                sizing="sm"
                value={goToUrl}
                onChange={(e) => setGoToUrl(e.target.value)}
                placeholder={tr(
                  "dashboard.settings.goToUrlPlaceholder",
                  dictionary
                )}
                color={getFlowbiteColor(getHandlebarsStatus(goToUrl))}
              />
            </div>
          </div>
          {/* Value Color Rules */}
          <ValueColorRulesEditor
            rules={valueColorRules.rules}
            dictionary={dictionary}
            onAdd={valueColorRules.addRule}
            onRemove={valueColorRules.removeRule}
            onUpdate={valueColorRules.updateRule}
            onToggleTarget={valueColorRules.toggleTarget}
          />
        </div>
      }
    />
  );
}
