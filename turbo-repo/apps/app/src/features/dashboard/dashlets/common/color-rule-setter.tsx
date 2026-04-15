"use client";

import { useCallback, useState } from "react";
import { Button, Label, Dropdown, DropdownItem } from "flowbite-react";
import { HiPlus, HiTrash, HiChevronDown } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";
import { AdvancedColorPicker } from "@/features/common/components/advanced-color-picker";
import type { PresetColor } from "@/features/common/components/advanced-color-picker";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { ColorRuleOperator } from "./color-rule-types";
import { COLOR_RULE_OPERATORS, OPERATOR_LABELS } from "./color-rule-types";

// ============================================================================
// Types
// ============================================================================

/** Compare mode: static value or another field */
export type CompareMode = "static" | "field";

/** Option for target toggle */
export interface TargetOption<T extends string = string> {
  value: T;
  label: string;
}

/** Option for compare field dropdown */
export interface CompareFieldOption<T extends string = string> {
  value: T;
  label: string;
}

/** A generic color rule that works with any target type */
export interface ColorRule<
  TTarget extends string = string,
  TCompareField extends string = string,
> {
  operator: ColorRuleOperator;
  /** Static value to compare against (when compareMode is "static") */
  value: string;
  /** Compare mode: static value or field reference */
  compareMode: CompareMode;
  /** Field to compare against (when compareMode is "field") */
  compareField?: TCompareField;
  /** The color to apply (hex without #) */
  color: string;
  /** What to apply the color to (can be multiple) */
  targets: TTarget[];
}

/** Rule with stable ID for list rendering */
export interface ColorRuleItem<
  TTarget extends string = string,
  TCompareField extends string = string,
> extends ColorRule<TTarget, TCompareField> {
  _id: string;
}

/** Configuration stored in DashletConfig */
export interface ColorRulesConfig<
  TTarget extends string = string,
  TCompareField extends string = string,
> {
  rules: ColorRule<TTarget, TCompareField>[];
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_RULE_COLOR = "3b82f6";

const COLOR_RULE_PRESETS: PresetColor[] = [
  { value: "ef4444", label: "Red" },
  { value: "f97316", label: "Orange" },
  { value: "eab308", label: "Yellow" },
  { value: "22c55e", label: "Green" },
  { value: "3b82f6", label: "Blue" },
  { value: "8b5cf6", label: "Purple" },
  { value: "6b7280", label: "Gray" },
];

// ============================================================================
// Normalization helper
// ============================================================================

export interface NormalizeOptions<
  TTarget extends string,
  TCompareField extends string,
> {
  validTargets: Set<string>;
  defaultTarget: TTarget;
  validCompareFields?: Set<string>;
  defaultCompareField?: TCompareField;
}

export function normalizeColorRulesConfig<
  TTarget extends string,
  TCompareField extends string,
>(
  raw: unknown,
  options: NormalizeOptions<TTarget, TCompareField>
): ColorRulesConfig<TTarget, TCompareField> {
  const {
    validTargets,
    defaultTarget,
    validCompareFields,
    defaultCompareField,
  } = options;

  if (raw == null || typeof raw !== "object") {
    return { rules: [] };
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.rules)) {
    return { rules: [] };
  }

  const rules: ColorRule<TTarget, TCompareField>[] = [];
  for (const r of obj.rules) {
    if (r == null || typeof r !== "object") continue;
    const rec = r as Record<string, unknown>;
    if (typeof rec.operator !== "string" || typeof rec.color !== "string")
      continue;

    // Support both legacy `target` and new `targets` array
    let targets: TTarget[];
    if (Array.isArray(rec.targets)) {
      targets = rec.targets.filter(
        (t): t is TTarget => typeof t === "string" && validTargets.has(t)
      );
    } else if (typeof rec.target === "string" && validTargets.has(rec.target)) {
      targets = [rec.target as TTarget];
    } else {
      targets = [defaultTarget];
    }
    if (targets.length === 0) targets = [defaultTarget];

    // Handle compare mode (default to static for backwards compatibility)
    const compareMode: CompareMode =
      rec.compareMode === "field" ? "field" : "static";

    const compareField: TCompareField | undefined =
      validCompareFields &&
      typeof rec.compareField === "string" &&
      validCompareFields.has(rec.compareField)
        ? (rec.compareField as TCompareField)
        : compareMode === "field"
          ? defaultCompareField
          : undefined;

    const value = typeof rec.value === "string" ? rec.value : "";

    rules.push({
      operator: rec.operator as ColorRuleOperator,
      value,
      compareMode,
      compareField,
      color: rec.color,
      targets,
    });
  }
  return { rules };
}

// ============================================================================
// Hook for settings state
// ============================================================================

let nextId = 0;

export interface UseColorRuleSettingsOptions<
  TTarget extends string,
  TCompareField extends string,
> {
  config: { valueColorRules?: ColorRulesConfig<TTarget, TCompareField> };
  validTargets: Set<string>;
  defaultTarget: TTarget;
  validCompareFields?: Set<string>;
  defaultCompareField?: TCompareField;
}

export function useColorRuleSettings<
  TTarget extends string,
  TCompareField extends string,
>({
  config,
  validTargets,
  defaultTarget,
  validCompareFields,
  defaultCompareField,
}: UseColorRuleSettingsOptions<TTarget, TCompareField>) {
  const normalized = normalizeColorRulesConfig<TTarget, TCompareField>(
    config.valueColorRules,
    { validTargets, defaultTarget, validCompareFields, defaultCompareField }
  );

  const [rules, setRules] = useState<ColorRuleItem<TTarget, TCompareField>[]>(
    normalized.rules.map((rule, i) => ({
      ...rule,
      _id: `vcr-${i}-${rule.value}`,
    }))
  );

  const addRule = useCallback(() => {
    setRules((prev) => [
      ...prev,
      {
        _id: `vcr-new-${nextId++}`,
        operator: "greater_than",
        value: "",
        compareMode: "static",
        compareField: undefined,
        color: DEFAULT_RULE_COLOR,
        targets: [defaultTarget],
      },
    ]);
  }, [defaultTarget]);

  const removeRule = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r._id !== id));
  }, []);

  const updateRule = useCallback(
    (id: string, field: string, value: string | TTarget[]) => {
      setRules((prev) =>
        prev.map((r) => {
          if (r._id !== id) return r;
          const updated = { ...r, [field]: value };
          // When switching to field mode, ensure compareField has a default value
          if (
            field === "compareMode" &&
            value === "field" &&
            !r.compareField &&
            defaultCompareField
          ) {
            updated.compareField = defaultCompareField;
          }
          return updated;
        })
      );
    },
    [defaultCompareField]
  );

  const toggleTarget = useCallback((id: string, target: TTarget) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r._id !== id) return r;
        const has = r.targets.includes(target);
        // If removing and it's the last one, keep it (at least one must be selected)
        if (has && r.targets.length === 1) return r;
        const newTargets = has
          ? r.targets.filter((t) => t !== target)
          : [...r.targets, target];
        return { ...r, targets: newTargets };
      })
    );
  }, []);

  const buildSavePayload = (): {
    valueColorRules: ColorRulesConfig<TTarget, TCompareField>;
  } => ({
    valueColorRules: {
      rules: rules.map((item) => ({
        operator: item.operator,
        value: item.value,
        compareMode: item.compareMode,
        compareField: item.compareField,
        color: item.color,
        targets: item.targets,
      })),
    },
  });

  return {
    rules,
    addRule,
    removeRule,
    updateRule,
    toggleTarget,
    buildSavePayload,
  };
}

// ============================================================================
// Editor Component
// ============================================================================

export interface ColorRuleSetterProps<
  TTarget extends string,
  TCompareField extends string,
> {
  /** The rules to display */
  rules: ColorRuleItem<TTarget, TCompareField>[];
  /** i18n dictionary */
  dictionary: I18nRecord;
  /** Available target options for the toggle */
  targetOptions: TargetOption<TTarget>[];
  /** Whether to show the Value/Field compare mode toggle */
  enableCompareMode?: boolean;
  /** Available fields to compare against (required if enableCompareMode is true) */
  compareFieldOptions?: CompareFieldOption<TCompareField>[];
  /** Callback when add rule button is clicked */
  onAdd: () => void;
  /** Callback when remove button is clicked */
  onRemove: (id: string) => void;
  /** Callback when a rule field is updated */
  onUpdate: (id: string, field: string, value: string) => void;
  /** Callback when a target is toggled */
  onToggleTarget: (id: string, target: TTarget) => void;
  /** Optional custom label for the section */
  label?: string;
  /** Whether to show the separator line at the top */
  showSeparator?: boolean;
}

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

export function ColorRuleSetter<
  TTarget extends string,
  TCompareField extends string,
>({
  rules,
  dictionary,
  targetOptions,
  enableCompareMode = false,
  compareFieldOptions = [],
  onAdd,
  onRemove,
  onUpdate,
  onToggleTarget,
  label,
  showSeparator = true,
}: Readonly<ColorRuleSetterProps<TTarget, TCompareField>>) {
  const compareModeOptions = [
    {
      value: "static" as const,
      label: tr("dashboard.settings.compareModeValue", dictionary),
    },
    {
      value: "field" as const,
      label: tr("dashboard.settings.compareModeField", dictionary),
    },
  ];

  return (
    <>
      {showSeparator && <hr className="border-gray-200 dark:border-gray-700" />}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          {label ?? tr("dashboard.settings.valueColorRules", dictionary)}
        </Label>

        {/* Rules */}
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule._id}
              className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1.5 dark:border-gray-600 dark:bg-gray-700/50"
            >
              {/* Compare mode toggle (Value/Field) - only if enabled */}
              {enableCompareMode && (
                <div className="flex h-7 shrink-0 items-center overflow-hidden rounded-md border border-gray-200 dark:border-gray-600">
                  {compareModeOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        onUpdate(rule._id, "compareMode", opt.value)
                      }
                      className={twMerge(
                        "h-7 cursor-pointer px-1.5 text-[10px] font-medium transition-colors",
                        rule.compareMode === opt.value
                          ? "bg-primary-600 text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Operator */}
              <Dropdown
                label=""
                dismissOnClick
                renderTrigger={() => (
                  <button
                    type="button"
                    className="flex h-7 w-16 shrink-0 cursor-pointer items-center justify-between gap-0.5 rounded-lg border border-gray-300 bg-gray-50 px-1.5 text-xs text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                  >
                    <span className="truncate">
                      {OPERATOR_LABELS[rule.operator]}
                    </span>
                    <HiChevronDown className="h-3 w-3 shrink-0" />
                  </button>
                )}
              >
                {COLOR_RULE_OPERATORS.map((op) => (
                  <DropdownItem
                    key={op}
                    onClick={() => onUpdate(rule._id, "operator", op)}
                    className="text-xs"
                  >
                    {OPERATOR_LABELS[op]}
                  </DropdownItem>
                ))}
              </Dropdown>

              {/* Value input OR Field selector */}
              {enableCompareMode && rule.compareMode === "field" ? (
                <Dropdown
                  label=""
                  dismissOnClick
                  renderTrigger={() => (
                    <button
                      type="button"
                      className="flex h-7 min-w-0 flex-1 cursor-pointer items-center justify-between gap-0.5 rounded-lg border border-gray-300 bg-gray-50 px-1.5 text-xs text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                    >
                      <span className="truncate">
                        {compareFieldOptions.find(
                          (o) =>
                            o.value ===
                            (rule.compareField ?? compareFieldOptions[0]?.value)
                        )?.label ?? compareFieldOptions[0]?.label}
                      </span>
                      <HiChevronDown className="h-3 w-3 shrink-0" />
                    </button>
                  )}
                >
                  {compareFieldOptions.map((opt) => (
                    <DropdownItem
                      key={opt.value}
                      onClick={() =>
                        onUpdate(rule._id, "compareField", opt.value)
                      }
                      className="text-xs"
                    >
                      {opt.label}
                    </DropdownItem>
                  ))}
                </Dropdown>
              ) : (
                <input
                  type="text"
                  className="no-drag h-7 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="100"
                  value={rule.value}
                  onChange={(e) => onUpdate(rule._id, "value", e.target.value)}
                />
              )}

              {/* Target multi-toggle - only if there are options */}
              {targetOptions.length > 0 && (
                <div className="flex h-7 shrink-0 items-center overflow-hidden rounded-md border border-gray-200 dark:border-gray-600">
                  {targetOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onToggleTarget(rule._id, opt.value)}
                      className={twMerge(
                        "h-7 cursor-pointer px-1.5 text-[10px] font-medium transition-colors",
                        rule.targets.includes(opt.value)
                          ? "bg-primary-600 text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Color */}
              <AdvancedColorPicker
                value={rule.color}
                onChange={(c) => onUpdate(rule._id, "color", c)}
                presets={COLOR_RULE_PRESETS}
                title={tr("dashboard.settings.selectRuleColor", dictionary)}
              />

              {/* Delete */}
              <button
                type="button"
                onClick={() => onRemove(rule._id)}
                onMouseDown={stopPropagation}
                className="no-drag flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                aria-label="Delete rule"
              >
                <HiTrash className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <Button
          color="light"
          size="xs"
          onClick={onAdd}
          onMouseDown={stopPropagation}
          className="no-drag"
        >
          <HiPlus className="mr-1 h-3 w-3" />
          {tr("dashboard.settings.addRule", dictionary)}
        </Button>
      </div>
    </>
  );
}
