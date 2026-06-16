"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Button,
  TextInput,
  Textarea,
  FileInput,
  Label,
  Select,
  Tooltip,
} from "flowbite-react";
import Markdown from "react-markdown";
import { MARKDOWN_COMPONENTS } from "../../dashlets/common/settings-fields";
import { FaGear } from "react-icons/fa6";
import { ChevronLeft } from "flowbite-react-icons/outline";
import {
  HiArrowDownTray,
  HiChevronDown,
  HiQuestionMarkCircle,
  HiPlus,
  HiTrash,
} from "react-icons/hi2";
import { twMerge } from "tailwind-merge";
import { useDashboard } from "../../context/dashboard-context";
import { PlannerManagerForm } from "../planner-manager/planner-manager";
import { ConfirmModal } from "../confirm-modal";
import { deleteDashboardConfigClient } from "@/features/common/providers/client-api.provider";
import { DashboardPermissionsModal } from "../dashboard-permissions-modal";
import { ShowNotification } from "@/features/notifications/notification";
import { tr } from "@/features/i18n/tr.service";
import type {
  DashboardFilterParam,
  DashboardFilterOption,
  RefreshInterval,
} from "../../types/dashboard.types";
import { REFRESH_INTERVAL_OPTIONS } from "../../types/dashboard.types";

// ============================================================================
// Helpers
// ============================================================================

function MdTooltip({ children }: Readonly<{ children: string }>) {
  return (
    <div className="max-w-72 text-left text-xs">
      <Markdown components={MARKDOWN_COMPONENTS}>{children}</Markdown>
    </div>
  );
}

// ============================================================================
// Types
// ============================================================================

type SettingOption =
  | "order"
  | "export"
  | "import"
  | "planner"
  | "filters"
  | "refresh"
  | "access"
  | "delete"
  | null;

type ImportMethod = "text" | "file";

// ============================================================================
// Helper Functions
// ============================================================================

function isSectionExpanded(
  selected: SettingOption,
  option: SettingOption
): boolean {
  return selected === null || selected === option;
}

function isSectionActive(
  selected: SettingOption,
  option: SettingOption
): boolean {
  return selected === option;
}

function getSectionClasses(
  expanded: boolean,
  active: boolean,
  maxHeight = "max-h-[400px]"
) {
  return {
    headerHeightClass: expanded ? "h-16" : "h-0",
    headerInteractiveClass: active
      ? ""
      : "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 w-full",
    contentMaxHeightClass: active ? maxHeight : "max-h-0",
  };
}

// ============================================================================
// Section Components
// ============================================================================

interface SectionLayoutProps {
  active: boolean;
  title: string;
  description: string;
  children: React.ReactNode;
  classes: ReturnType<typeof getSectionClasses>;
  onSelect: () => void;
  onBack: (e: React.MouseEvent) => void;
}

function SectionLayout({
  active,
  title,
  description,
  children,
  classes,
  onSelect,
  onBack,
}: Readonly<SectionLayoutProps>) {
  const { headerHeightClass, headerInteractiveClass, contentMaxHeightClass } =
    classes;
  const [animationDone, setAnimationDone] = useState(false);

  useEffect(() => {
    if (!active && animationDone) {
      setAnimationDone(false);
    }
  }, [active, animationDone]);
  const backButtonClass = active
    ? "opacity-100 w-10"
    : "opacity-0 w-0 pointer-events-none";

  const handleClick = (e: React.MouseEvent) => {
    if (active) {
      onBack(e);
    } else {
      onSelect();
    }
  };

  return (
    <div>
      <div
        className={twMerge(
          "transition-all duration-300 overflow-hidden",
          headerHeightClass
        )}
      >
        <Button
          type="button"
          color="alternative"
          onClick={handleClick}
          className={twMerge(
            "w-full border-0 bg-transparent p-0 m-0 text-left font-inherit",
            "flex flex-row h-full items-center transition-all duration-300",
            "border-b border-gray-200 dark:border-gray-700 rounded-none",
            headerInteractiveClass
          )}
        >
          <span
            className={twMerge(
              "h-8 ml-3 mr-3 shrink-0 flex items-center justify-center",
              "text-gray-700 dark:text-gray-300 transition-all duration-300 overflow-hidden",
              backButtonClass
            )}
          >
            <ChevronLeft />
          </span>
          <span className="flex items-center gap-3 flex-1 py-2 pr-3 min-w-0">
            <span className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white text-left">
                {title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-left truncate">
                {description}
              </p>
            </span>
          </span>
        </Button>
      </div>
      <div
        className={`${contentMaxHeightClass} transition-all duration-300 ${animationDone ? "overflow-y-auto" : "overflow-hidden"}`}
        onTransitionEnd={() => {
          if (active) setAnimationDone(true);
        }}
      >
        {children}
      </div>
    </div>
  );
}

interface SettingsSectionProps {
  option: NonNullable<SettingOption>;
  selected: SettingOption;
  setSelected: (v: SettingOption) => void;
  title: string;
  description: string;
  children: React.ReactNode;
  maxHeight?: string;
}

function SettingsSection({
  option,
  selected,
  setSelected,
  title,
  description,
  children,
  maxHeight,
}: Readonly<SettingsSectionProps>) {
  const active = isSectionActive(selected, option);
  const expanded = isSectionExpanded(selected, option);
  const classes = getSectionClasses(expanded, active, maxHeight);

  const handleSelect = () => {
    if (!active) setSelected(option);
  };

  const handleBack = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(null);
  };

  return (
    <SectionLayout
      active={active}
      title={title}
      description={description}
      classes={classes}
      onSelect={handleSelect}
      onBack={handleBack}
    >
      {children}
    </SectionLayout>
  );
}

// ============================================================================
// Form Components
// ============================================================================

interface ExportFormProps {
  onExport: () => void;
  onDownload: () => void;
  onClose: () => void;
}

function ExportForm({
  onExport,
  onDownload,
  onClose,
}: Readonly<ExportFormProps>) {
  const { dictionary } = useDashboard();

  const handleCopy = () => {
    onExport();
    onClose();
  };

  const handleDownload = () => {
    onDownload();
    onClose();
  };

  return (
    <div className="p-4 space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {tr("dashboard.settings.exportInfo", dictionary)}
      </p>
      <div className="flex flex-col gap-2">
        <Button color="light" size="sm" onClick={handleDownload}>
          <HiArrowDownTray className="mr-2 h-4 w-4" />
          {tr("dashboard.settings.exportDownloadJson", dictionary)}
        </Button>
        <Button color="gray" size="sm" onClick={handleCopy}>
          {tr("dashboard.settings.exportCopyToClipboard", dictionary)}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Import Form
// ============================================================================

interface ImportFormProps {
  onImport: (json: string) => { success: boolean; error?: string };
  onClose: () => void;
}

function ImportForm({ onImport, onClose }: Readonly<ImportFormProps>) {
  const { dictionary } = useDashboard();
  const t = (key: string) => tr(`dashboard.settings.${key}`, dictionary);

  const [method, setMethod] = useState<ImportMethod>("file");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextImport = () => {
    if (!importText.trim()) {
      setImportError(t("importPasteError"));
      return;
    }
    const result = onImport(importText);
    if (result.success) {
      ShowNotification({
        type: "success",
        message: t("importSuccess"),
      });
      onClose();
    } else {
      setImportError(result.error || t("importFailed"));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    file
      .text()
      .then((content) => {
        const result = onImport(content);
        if (result.success) {
          ShowNotification({
            type: "success",
            message: t("importSuccess"),
          });
          onClose();
        } else {
          setImportError(result.error || t("importFailed"));
        }
      })
      .catch(() => {
        setImportError(t("importFileError"));
      });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Method tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => setMethod("file")}
          className={twMerge(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            method === "file"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
          )}
        >
          {t("importUploadFile")}
        </button>
        <button
          type="button"
          onClick={() => setMethod("text")}
          className={twMerge(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            method === "text"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
          )}
        >
          {t("importPasteJson")}
        </button>
      </div>

      {/* Content based on method */}
      {method === "file" ? (
        <div className="space-y-3">
          <div>
            <Label htmlFor="dashboard-file">{t("importSelectFile")}</Label>
            <FileInput
              ref={fileInputRef}
              id="dashboard-file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="mt-1"
            />
          </div>
          <div className="flex justify-end">
            <Button type="button" color="gray" size="sm" onClick={onClose}>
              {tr("common.cancel", dictionary)}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Textarea
            value={importText}
            onChange={(e) => {
              setImportText(e.target.value);
              setImportError(null);
            }}
            placeholder={t("importPastePlaceholder")}
            rows={8}
            className="font-mono text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" color="gray" size="sm" onClick={onClose}>
              {tr("common.cancel", dictionary)}
            </Button>
            <Button size="sm" onClick={handleTextImport}>
              {tr("common.import", dictionary)}
            </Button>
          </div>
        </div>
      )}

      {importError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Error: {importError}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Filter Manager Form — pure helpers (module-level to avoid deep nesting)
// ============================================================================

function patchOption(
  options: DashboardFilterOption[],
  optIndex: number,
  field: keyof DashboardFilterOption,
  value: string
): DashboardFilterOption[] {
  return options.map((o, j) => (j === optIndex ? { ...o, [field]: value } : o));
}

function withoutOption(options: DashboardFilterOption[], optIndex: number): DashboardFilterOption[] {
  return options.filter((_, j) => j !== optIndex);
}

// ============================================================================
// Filter Manager Form
// ============================================================================

interface FilterManagerFormProps {
  filters: DashboardFilterParam[];
  onSave: (filters: DashboardFilterParam[]) => void;
}

function FilterManagerForm({
  filters,
  onSave,
}: Readonly<FilterManagerFormProps>) {
  const { dictionary } = useDashboard();
  const t = (key: string) => tr(`dashboard.settings.${key}`, dictionary);

  const [localFilters, setLocalFilters] = useState<DashboardFilterParam[]>(filters);
  const [filterIds, setFilterIds] = useState(() => filters.map(() => crypto.randomUUID()));
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [optionIds, setOptionIds] = useState<Record<string, string[]>>(() => {
    const result: Record<string, string[]> = {};
    filters.forEach((f, i) => {
      result[filterIds[i]] = (f.options ?? []).map(() => crypto.randomUUID());
    });
    return result;
  });

  useEffect(() => {
    // Intentionally read stale closure values (previous render's state) to
    // build the key→id map for matching. Adding them to deps would loop.
    const prevKeyToId = new Map(localFilters.map((f, i) => [f.key, filterIds[i]]));
    const prevKeyToOptIds = new Map(localFilters.map((f, i) => [f.key, optionIds[filterIds[i]] ?? []]));

    const ids = filters.map((f) => prevKeyToId.get(f.key) ?? crypto.randomUUID());
    const opts: Record<string, string[]> = {};
    filters.forEach((f, i) => {
      const prevOptIds = prevKeyToOptIds.get(f.key) ?? [];
      opts[ids[i]] = (f.options ?? []).map((_, j) => prevOptIds[j] ?? crypto.randomUUID());
    });

    setLocalFilters(filters);
    setFilterIds(ids);
    setOptionIds(opts);
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const addFilter = () => {
    const id = crypto.randomUUID();
    setLocalFilters((prev) => [...prev, { key: "", label: "", type: "text" }]);
    setFilterIds((prev) => [...prev, id]);
    setOptionIds((prev) => ({ ...prev, [id]: [] }));
    setExpandedIds((prev) => new Set([...prev, id]));
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const updateFilter = (index: number, patch: Partial<DashboardFilterParam>) => {
    setLocalFilters((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  const removeFilter = (index: number) => {
    const filterId = filterIds[index];
    setLocalFilters((prev) => prev.filter((_, i) => i !== index));
    setFilterIds((prev) => prev.filter((_, i) => i !== index));
    setOptionIds((prev) => {
      const next = { ...prev };
      delete next[filterId];
      return next;
    });
  };

  const addOption = (index: number) => {
    const filterId = filterIds[index];
    const optId = crypto.randomUUID();
    setLocalFilters((prev) =>
      prev.map((f, i) =>
        i === index
          ? { ...f, options: [...(f.options ?? []), { label: "", value: "" }] }
          : f
      )
    );
    setOptionIds((prev) => ({
      ...prev,
      [filterId]: [...(prev[filterId] ?? []), optId],
    }));
  };

  const updateOption = (
    filterIndex: number,
    optIndex: number,
    field: keyof DashboardFilterOption,
    value: string
  ) => {
    setLocalFilters((prev) =>
      prev.map((f, i) =>
        i === filterIndex
          ? { ...f, options: patchOption(f.options ?? [], optIndex, field, value) }
          : f
      )
    );
  };

  const removeOption = (filterIndex: number, optIndex: number) => {
    const filterId = filterIds[filterIndex];
    setLocalFilters((prev) =>
      prev.map((f, i) =>
        i === filterIndex
          ? { ...f, options: withoutOption(f.options ?? [], optIndex) }
          : f
      )
    );
    setOptionIds((prev) => ({
      ...prev,
      [filterId]: (prev[filterId] ?? []).filter((_, j) => j !== optIndex),
    }));
  };

  const handleSave = () => {
    const seen = new Set<string>();
    const normalizedFilters = localFilters.map((f) => {
      const trimmedLabel = f.label.trim();
      let key = (f.key.trim() || trimmedLabel)
        .toLowerCase()
        .replaceAll(/\s+/g, "_")
        .replaceAll(/[^a-z0-9_-]/g, "");
      if (key && !/^[a-z_]/i.test(key)) key = `_${key}`;
      return { ...f, key, label: trimmedLabel };
    });

    const hasEmpty = normalizedFilters.some((f) => !f.key || !f.label);
    const keyCount = new Map<string, number>();
    for (const f of normalizedFilters) {
      if (f.key) keyCount.set(f.key, (keyCount.get(f.key) ?? 0) + 1);
    }
    const hasDuplicates = [...keyCount.values()].some((c) => c > 1);

    if (hasEmpty || hasDuplicates) {
      ShowNotification({ type: "error", message: t("filtersValidationError") });
      return;
    }

    const validFilters = normalizedFilters.filter((f) => {
      if (seen.has(f.key)) return false;
      seen.add(f.key);
      return true;
    });
    onSave(validFilters);
    ShowNotification({ type: "success", message: t("filtersUpdated") });
  };

  const TYPE_LABEL: Record<DashboardFilterParam["type"], string> = {
    text: t("textSearch"),
    date_range: t("dateRange"),
    select: t("selectType"),
  };

  return (
    <div className="flex flex-col">
      {/* Scrollable filter list */}
      <div className="overflow-y-auto p-4 space-y-3">
        {localFilters.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("noFiltersConfigured")}
          </p>
        )}

        {localFilters.map((filter, index) => {
          const id = filterIds[index];
          const isOpen = expandedIds.has(id);
          const title = filter.label || t("newFilter");

          return (
            <div
              key={id}
              className="rounded-lg border border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800 overflow-hidden"
            >
              {/* Card header */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleExpanded(id)}
                  className="flex flex-1 items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <HiChevronDown
                    className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                  <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {title}
                  </span>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                    {TYPE_LABEL[filter.type]}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => removeFilter(index)}
                  className="mr-2 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors"
                  title={t("removeFilter")}
                >
                  <HiTrash className="h-4 w-4" />
                </button>
              </div>

              {/* Card body */}
              {isOpen && (
                <div className="border-t border-gray-200 dark:border-gray-600 px-4 py-3 space-y-3">

                  {/* Type */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Label htmlFor={`type-${id}`}>{t("filterType")}</Label>
                      <Tooltip content={<MdTooltip>{t("filterTypeTooltip")}</MdTooltip>}>
                        <HiQuestionMarkCircle className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                      </Tooltip>
                    </div>
                    <Select
                      id={`type-${id}`}
                      sizing="sm"
                      value={filter.type}
                      onChange={(e) =>
                        updateFilter(index, {
                          type: e.target.value as DashboardFilterParam["type"],
                          options: e.target.value === "select" ? (filter.options ?? []) : undefined,
                        })
                      }
                    >
                      <option value="text">{t("textSearch")}</option>
                      <option value="date_range">{t("dateRange")}</option>
                      <option value="select">{t("selectType")}</option>
                    </Select>
                  </div>

                  {/* Label */}
                  <div className="space-y-1">
                    <Label htmlFor={`label-${id}`}>{t("displayLabel")}</Label>
                    <TextInput
                      id={`label-${id}`}
                      sizing="sm"
                      placeholder={t("displayLabelPlaceholder")}
                      value={filter.label}
                      onChange={(e) => updateFilter(index, { label: e.target.value })}
                    />
                  </div>

                  {/* Key */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Label htmlFor={`key-${id}`}>{t("parameterKey")}</Label>
                      <Tooltip content={<MdTooltip>{t("parameterKeyTooltip")}</MdTooltip>}>
                        <HiQuestionMarkCircle className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                      </Tooltip>
                    </div>
                    <TextInput
                      id={`key-${id}`}
                      sizing="sm"
                      placeholder={t("parameterKeyPlaceholder")}
                      value={filter.key}
                      onChange={(e) => updateFilter(index, { key: e.target.value })}
                    />
                  </div>

                  {/* Select options */}
                  {filter.type === "select" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <Label>{t("selectOptionsLabel")}</Label>
                        <Tooltip content={<MdTooltip>{t("selectOptionsTooltip")}</MdTooltip>}>
                          <HiQuestionMarkCircle className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                        </Tooltip>
                      </div>
                      {(filter.options ?? []).length === 0 && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">{t("noOptionsYet")}</p>
                      )}
                      {(filter.options ?? []).map((opt, optIdx) => (
                        <div key={(optionIds[id] ?? [])[optIdx] ?? optIdx} className="flex items-center gap-2">
                          <TextInput
                            sizing="sm"
                            placeholder={t("optionLabelPlaceholder")}
                            value={opt.label}
                            onChange={(e) => updateOption(index, optIdx, "label", e.target.value)}
                            className="flex-1"
                          />
                          <TextInput
                            sizing="sm"
                            placeholder={t("optionValuePlaceholder")}
                            value={opt.value}
                            onChange={(e) => updateOption(index, optIdx, "value", e.target.value)}
                            className="flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => removeOption(index, optIdx)}
                            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <HiTrash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        size="xs"
                        color="light"
                        onClick={() => addOption(index)}
                      >
                        <HiPlus className="mr-1 h-3 w-3" />
                        {t("addOption")}
                      </Button>
                    </div>
                  )}

                  {/* Date range auto-generated param info */}
                  {filter.type === "date_range" && filter.key && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          {t("autoGeneratedParams")}
                        </p>
                        <Tooltip content={<MdTooltip>{t("autoGeneratedParamsTooltip")}</MdTooltip>}>
                          <HiQuestionMarkCircle className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                        </Tooltip>
                      </div>
                      {[`${filter.key}_from`, `${filter.key}_to`].map((derived) => (
                        <div
                          key={derived}
                          className="flex items-center gap-2 rounded border border-dashed border-gray-200 bg-gray-50 px-2 py-1 dark:border-gray-600 dark:bg-gray-700/50"
                        >
                          <code className="flex-1 text-xs font-mono text-gray-500 dark:text-gray-400">
                            {`{{filter.${derived}}}`}
                          </code>
                          <span className="text-xs italic text-gray-400 dark:text-gray-500">
                            {t("autoGenerated")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Default date range info */}
        {!localFilters.some((f) => f.type === "date_range") && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t("builtInDateRange")}
            </p>
            {["date_range_from", "date_range_to"].map((derived) => (
              <div
                key={derived}
                className="flex items-center gap-2 rounded border border-dashed border-gray-200 bg-gray-50 px-2 py-1 dark:border-gray-600 dark:bg-gray-700/50"
              >
                <code className="flex-1 text-xs font-mono text-gray-500 dark:text-gray-400">
                  {`{{filter.${derived}}}`}
                </code>
                <span className="text-xs italic text-gray-400 dark:text-gray-500">
                  {t("autoGenerated")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Always-visible action bar */}
      <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex justify-between gap-2">
        <Button type="button" color="light" size="sm" onClick={addFilter}>
          <HiPlus className="mr-1 h-4 w-4" />
          {t("addFilterButton")}
        </Button>
        <Button type="button" size="sm" onClick={handleSave}>
          {tr("common.save", dictionary)}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Auto-Refresh Form
// ============================================================================

function RefreshForm() {
  const { refreshInterval, setRefreshInterval, dictionary } = useDashboard();
  const t = (key: string) => tr(`dashboard.settings.${key}`, dictionary);

  return (
    <div className="p-4 space-y-3">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t("autoRefreshDescription")}
      </p>
      <Select
        sizing="sm"
        value={String(refreshInterval)}
        onChange={(e) =>
          setRefreshInterval(Number(e.target.value) as RefreshInterval)
        }
        className="[&>select]:cursor-pointer"
      >
        {REFRESH_INTERVAL_OPTIONS.map((opt) => (
          <option key={opt.value} value={String(opt.value)}>
            {t(opt.labelKey)}
          </option>
        ))}
      </Select>
    </div>
  );
}

// ============================================================================
// Order Form
// ============================================================================

function OrderForm() {
  const { order, setOrder, dictionary } = useDashboard();
  const [localOrder, setLocalOrder] = useState<string>(
    order === undefined ? "" : String(order)
  );

  useEffect(() => {
    setLocalOrder(order === undefined ? "" : String(order));
  }, [order]);

  const handleSave = () => {
    const parsed = Number.parseInt(localOrder, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      setOrder(parsed);
      ShowNotification({
        type: "success",
        message: tr("dashboard.settings.orderUpdated", dictionary),
      });
    } else {
      ShowNotification({
        type: "error",
        message: tr("dashboard.settings.orderInvalid", dictionary),
      });
    }
  };

  return (
    <div className="p-4 space-y-3">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {tr("dashboard.settings.orderDescription", dictionary)}
      </p>
      <div className="flex items-center gap-2">
        <TextInput
          type="number"
          sizing="sm"
          min={0}
          value={localOrder}
          onChange={(e) => setLocalOrder(e.target.value)}
          placeholder="0"
          className="w-24"
        />
        <Button size="sm" onClick={handleSave}>
          {tr("common.save", dictionary)}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Manage Permissions Button
// ============================================================================

interface ManagePermissionsFormProps {
  onOpenModal: () => void;
}

function ManagePermissionsForm({
  onOpenModal,
}: Readonly<ManagePermissionsFormProps>) {
  const { dictionary } = useDashboard();
  const t = (key: string) => tr(`dashboard.permissions.${key}`, dictionary);

  return (
    <div className="p-4 space-y-3">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t("manageButtonDescription")}
      </p>
      <Button type="button" size="sm" onClick={onOpenModal}>
        {t("manageButton")}
      </Button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface DashboardSettingsDropdownProps {
  /**
   * Whether the current user can manage node permissions (Alfresco
   * `updatePermissions`, i.e. Coordinator). Controls visibility of the
   * Access Control section and the underlying permissions modal.
   */
  canManagePermissions: boolean;
}

export default function DashboardSettingsDropdown({
  canManagePermissions,
}: Readonly<DashboardSettingsDropdownProps>) {
  const {
    dashboardName,
    filters,
    setFilters,
    exportDashboard,
    importDashboard,
    downloadDashboard,
    dictionary,
    siteId,
  } = useDashboard();

  const router = useRouter();
  const params = useParams<{ lang: string; slug: string }>();

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SettingOption>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const togglePanel = () => {
    setSelected(null);
    setOpen((prev) => !prev);
  };

  const closePanel = useCallback(() => {
    setOpen(false);
    setSelected(null);
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        closePanel();
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, closePanel]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel();
      }
    };

    if (open) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, closePanel]);

  const handleExportToClipboard = useCallback(() => {
    const json = exportDashboard();
    navigator.clipboard
      .writeText(json)
      .then(() => {
        ShowNotification({
          type: "success",
          message: tr("dashboard.settings.copySuccess", dictionary),
        });
      })
      .catch((error) => {
        console.error("Failed to copy to clipboard:", error);
        ShowNotification({
          type: "error",
          message: tr("dashboard.settings.copyError", dictionary),
        });
      });
  }, [exportDashboard, dictionary]);

  const handleDeleteClick = useCallback(() => {
    setShowDeleteConfirm(true);
    closePanel();
  }, [closePanel]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!siteId || !params.slug) return;

    try {
      await deleteDashboardConfigClient(siteId, params.slug);

      ShowNotification({
        type: "success",
        message: tr("dashboard.landing.deleteSuccess", dictionary),
      });
      router.push(`/${params.lang}/home`);
    } catch {
      ShowNotification({
        type: "error",
        message: tr("dashboard.landing.deleteError", dictionary),
      });
    }
  }, [siteId, params.slug, params.lang, dictionary, router]);

  return (
    <div ref={dropdownRef} className="relative">
      <Button
        color="alternative"
        size="sm"
        onClick={togglePanel}
        title="Dashboard settings"
      >
        <FaGear />
      </Button>

      {open && (
        <div className="absolute z-50 right-0 top-full mt-2 h-fit bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-90 w-110">
          <SettingsSection
            option="order"
            selected={selected}
            setSelected={setSelected}
            title={tr("dashboard.settings.orderTitle", dictionary)}
            description={tr("dashboard.settings.orderDescription", dictionary)}
          >
            <OrderForm />
          </SettingsSection>

          <SettingsSection
            option="export"
            selected={selected}
            setSelected={setSelected}
            title={tr("dashboard.settings.exportDashboardTitle", dictionary)}
            description={tr(
              "dashboard.settings.exportDashboardDescription",
              dictionary
            )}
          >
            <ExportForm
              onExport={handleExportToClipboard}
              onDownload={downloadDashboard}
              onClose={closePanel}
            />
          </SettingsSection>

          <SettingsSection
            option="import"
            selected={selected}
            setSelected={setSelected}
            title={tr("dashboard.settings.importDashboardTitle", dictionary)}
            description={tr(
              "dashboard.settings.importDashboardDescription",
              dictionary
            )}
          >
            <ImportForm onImport={importDashboard} onClose={closePanel} />
          </SettingsSection>

          <SettingsSection
            option="filters"
            selected={selected}
            setSelected={setSelected}
            title={tr("dashboard.settings.filterBarTitle", dictionary)}
            description={tr(
              "dashboard.settings.filterBarDescription",
              dictionary
            )}
            maxHeight="max-h-[70vh]"
          >
            <FilterManagerForm filters={filters} onSave={setFilters} />
          </SettingsSection>

          <SettingsSection
            option="refresh"
            selected={selected}
            setSelected={setSelected}
            title={tr("dashboard.settings.autoRefresh", dictionary)}
            description={tr(
              "dashboard.settings.autoRefreshDescription",
              dictionary
            )}
          >
            <RefreshForm />
          </SettingsSection>

          <SettingsSection
            option="planner"
            selected={selected}
            setSelected={setSelected}
            title={tr("dashboard.settings.plannerTitle", dictionary)}
            description={tr(
              "dashboard.settings.plannerDescription",
              dictionary
            )}
            maxHeight="max-h-[60vh]"
          >
            <PlannerManagerForm />
          </SettingsSection>

          {canManagePermissions && (
            <SettingsSection
              option="access"
              selected={selected}
              setSelected={setSelected}
              title={tr("dashboard.settings.accessControlTitle", dictionary)}
              description={tr(
                "dashboard.settings.accessControlDescription",
                dictionary
              )}
            >
              <ManagePermissionsForm
                onOpenModal={() => {
                  setShowPermissionsModal(true);
                  closePanel();
                }}
              />
            </SettingsSection>
          )}

          <SettingsSection
            option="delete"
            selected={selected}
            setSelected={setSelected}
            title={tr("dashboard.landing.delete_confirm_title", dictionary)}
            description={tr("dashboard.settings.deleteDescription", dictionary)}
          >
            <div className="p-4">
              <Button color="failure" size="sm" onClick={handleDeleteClick}>
                {tr("dashboard.landing.delete_confirm_title", dictionary)}
              </Button>
            </div>
          </SettingsSection>
        </div>
      )}

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title={tr("dashboard.landing.delete_confirm_title", dictionary)}
        description={tr(
          "dashboard.landing.delete_confirm_message",
          dictionary,
          {
            name: dashboardName,
          }
        )}
        confirmText={tr("dashboard.landing.delete_confirm_title", dictionary)}
      />

      {canManagePermissions && siteId && params.slug && (
        <DashboardPermissionsModal
          isOpen={showPermissionsModal}
          onClose={() => setShowPermissionsModal(false)}
          site={siteId}
          slug={params.slug}
          dashboardName={dashboardName}
          dictionary={dictionary}
        />
      )}
    </div>
  );
}
