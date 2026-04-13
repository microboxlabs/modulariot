"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter, useParams, useSearchParams, usePathname } from "next/navigation";
import { Button, TextInput, Textarea, FileInput, Label, Select } from "flowbite-react";
import { FaGear } from "react-icons/fa6";
import { ChevronLeft } from "flowbite-react-icons/outline";
import { HiArrowDownTray, HiLink } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";
import { useDashboard } from "../../context/dashboard-context";
import { PlannerManagerForm } from "../planner-manager/planner-manager";
import { ConfirmModal } from "../confirm-modal";
import { deleteDashboardConfigClient, useUserGroups } from "@/features/common/providers/client-api.provider";
import { ShowNotification } from "@/features/notifications/notification";
import { tr } from "@/features/i18n/tr.service";
import type { DashboardFilterParam, RefreshInterval } from "../../types/dashboard.types";
import { REFRESH_INTERVAL_OPTIONS } from "../../types/dashboard.types";

// ============================================================================
// Types
// ============================================================================

type SettingOption = "share" | "rename" | "order" | "export" | "import" | "planner" | "filters" | "refresh" | "access" | "delete" | null;

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

function getSectionClasses(expanded: boolean, active: boolean, maxHeight = "max-h-[400px]") {
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
        onTransitionEnd={() => { if (active) setAnimationDone(true); }}
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

interface RenameFormProps {
  currentName: string;
  onSave: (name: string) => void;
  onClose: () => void;
}

function RenameForm({
  currentName,
  onSave,
  onClose,
}: Readonly<RenameFormProps>) {
  const [name, setName] = useState(currentName);

  useEffect(() => {
    setName(currentName);
  }, [currentName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
      onClose();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      <div>
        <Label htmlFor="dashboard-name">Dashboard Name</Label>
        <TextInput
          id="dashboard-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter dashboard name"
          className="mt-1"
          autoFocus
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" color="gray" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!name.trim()}>
          Save
        </Button>
      </div>
    </form>
  );
}

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
        Export your dashboard configuration to share or backup.
      </p>
      <div className="flex flex-col gap-2">
        <Button color="light" size="sm" onClick={handleDownload}>
          <HiArrowDownTray className="mr-2 h-4 w-4" />
          Download as JSON file
        </Button>
        <Button color="gray" size="sm" onClick={handleCopy}>
          Copy to clipboard
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Share Form
// ============================================================================

/** CSS selector for the dashboard content area to capture */
const DASHBOARD_CAPTURE_SELECTOR = ".dashboard-root-grid";

interface ShareFormProps {
  dashboardName: string;
  onClose: () => void;
}

function ShareForm({ dashboardName, onClose }: Readonly<ShareFormProps>) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [exporting, setExporting] = useState<"image" | "pdf" | null>(null);

  const handleCopyKioskLink = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("kiosk", "true");
    const kioskUrl = `${globalThis.location.origin}${pathname}?${params.toString()}`;
    navigator.clipboard.writeText(kioskUrl).then(() => {
      ShowNotification({ type: "success", message: "Kiosk link copied to clipboard" });
      onClose();
    }).catch(() => {
      ShowNotification({ type: "error", message: "Failed to copy link" });
    });
  };

  const captureElement = async () => {
    const el = document.querySelector(DASHBOARD_CAPTURE_SELECTOR) as HTMLElement | null;
    if (!el) {
      ShowNotification({ type: "error", message: "Dashboard content not found" });
      return null;
    }
    const { default: html2canvas } = await import("html2canvas-pro");
    return html2canvas(el, {
      useCORS: true,
      scale: 2,
      backgroundColor: null,
      logging: false,
    });
  };

  const handleDownloadImage = async () => {
    setExporting("image");
    try {
      const canvas = await captureElement();
      if (!canvas) return;

      const link = document.createElement("a");
      link.download = `${dashboardName.replaceAll(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      ShowNotification({ type: "success", message: "Image downloaded" });
      onClose();
    } catch {
      ShowNotification({ type: "error", message: "Failed to capture dashboard image" });
    } finally {
      setExporting(null);
    }
  };

  const handleDownloadPdf = async () => {
    setExporting("pdf");
    try {
      const canvas = await captureElement();
      if (!canvas) return;

      const { jsPDF } = await import("jspdf");

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = imgWidth / imgHeight;

      // Use landscape if wider than tall, portrait otherwise
      const orientation = ratio > 1 ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation, unit: "px", format: "a4" });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = contentWidth / ratio;

      // Add title
      pdf.setFontSize(14);
      pdf.text(dashboardName, margin, margin + 10);

      // Add date
      pdf.setFontSize(9);
      pdf.setTextColor(128);
      pdf.text(new Date().toLocaleString(), margin, margin + 22);
      pdf.setTextColor(0);

      const imgY = margin + 30;
      const imgData = canvas.toDataURL("image/png");

      if (imgY + contentHeight <= pageHeight - margin) {
        // Fits on one page
        pdf.addImage(imgData, "PNG", margin, imgY, contentWidth, contentHeight);
      } else {
        // Scale down to fit
        const availableHeight = pageHeight - imgY - margin;
        const scaledWidth = availableHeight * ratio;
        const finalWidth = Math.min(contentWidth, scaledWidth);
        const finalHeight = finalWidth / ratio;
        pdf.addImage(imgData, "PNG", margin, imgY, finalWidth, finalHeight);
      }

      pdf.save(`${dashboardName.replaceAll(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`);
      ShowNotification({ type: "success", message: "PDF downloaded" });
      onClose();
    } catch {
      ShowNotification({ type: "error", message: "Failed to export dashboard as PDF" });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Share your dashboard via link or download a snapshot.
      </p>

      <div className="flex flex-col gap-2">
        {/* Authenticated kiosk link */}
        <Button color="light" size="sm" onClick={handleCopyKioskLink}>
          <HiLink className="mr-2 h-4 w-4" />
          Copy link
        </Button>

        {/* Download as image */}
        <Button
          color="light"
          size="sm"
          onClick={handleDownloadImage}
          disabled={exporting !== null}
        >
          <HiArrowDownTray className="mr-2 h-4 w-4" />
          {exporting === "image" ? "Capturing..." : "Download as image"}
        </Button>

        {/* Download as PDF */}
        <Button
          color="light"
          size="sm"
          onClick={handleDownloadPdf}
          disabled={exporting !== null}
        >
          <HiArrowDownTray className="mr-2 h-4 w-4" />
          {exporting === "pdf" ? "Generating..." : "Download as PDF"}
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
  const [method, setMethod] = useState<ImportMethod>("file");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextImport = () => {
    if (!importText.trim()) {
      setImportError("Paste a valid JSON configuration to import");
      return;
    }
    const result = onImport(importText);
    if (result.success) {
      ShowNotification({
        type: "success",
        message: "Dashboard imported successfully",
      });
      onClose();
    } else {
      setImportError(result.error || "Failed to import dashboard");
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
            message: "Dashboard imported successfully",
          });
          onClose();
        } else {
          setImportError(result.error || "Failed to import dashboard");
        }
      })
      .catch(() => {
        setImportError("Failed to read file");
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
          Upload File
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
          Paste JSON
        </button>
      </div>

      {/* Content based on method */}
      {method === "file" ? (
        <div className="space-y-3">
          <div>
            <Label htmlFor="dashboard-file">Select JSON file</Label>
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
              Cancel
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
            placeholder="Paste your dashboard JSON here..."
            rows={8}
            className="font-mono text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" color="gray" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleTextImport}>
              Import
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
  const [filterIds, setFilterIds] = useState(() =>
    filters.map(() => crypto.randomUUID())
  );

  useEffect(() => {
    setLocalFilters(filters);
    setFilterIds(filters.map(() => crypto.randomUUID()));
  }, [filters]);

  const addFilter = () => {
    setLocalFilters((prev) => [
      ...prev,
      { key: "", label: "", type: "text" },
    ]);
    setFilterIds((prev) => [...prev, crypto.randomUUID()]);
  };

  const updateFilter = (
    index: number,
    field: keyof DashboardFilterParam,
    value: string
  ) => {
    setLocalFilters((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [field]: value } : f))
    );
  };

  const removeFilter = (index: number) => {
    setLocalFilters((prev) => prev.filter((_, i) => i !== index));
    setFilterIds((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const seen = new Set<string>();
    const normalizedFilters = localFilters.map((f) => {
      const trimmedLabel = f.label.trim();
      // Normalize key: trim, lowercase, spaces→underscores, strip unsafe chars
      let key = (f.key.trim() || trimmedLabel)
        .toLowerCase()
        .replaceAll(/\s+/g, "_")
        .replaceAll(/[^a-z0-9_-]/g, "");
      // Ensure key starts with a letter or underscore
      if (key && !/^[a-z_]/i.test(key)) {
        key = `_${key}`;
      }
      return { ...f, key, label: trimmedLabel };
    });

    const hasEmpty = normalizedFilters.some((f) => !f.key || !f.label);
    const keyCount = new Map<string, number>();
    for (const f of normalizedFilters) {
      if (f.key) keyCount.set(f.key, (keyCount.get(f.key) ?? 0) + 1);
    }
    const hasDuplicates = [...keyCount.values()].some((c) => c > 1);

    if (hasEmpty || hasDuplicates) {
      ShowNotification({
        type: "error",
        message: t("filtersValidationError"),
      });
      return;
    }

    const validFilters = normalizedFilters.filter((f) => {
      if (seen.has(f.key)) return false;
      seen.add(f.key);
      return true;
    });
    onSave(validFilters);
    ShowNotification({
      type: "success",
      message: t("filtersUpdated"),
    });
  };

  return (
    <div className="p-4 space-y-3">
      {localFilters.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("noFiltersConfigured")}
        </p>
      )}

      {localFilters.map((filter, index) => (
        <div key={filterIds[index]} className="space-y-1">
          <div className="flex items-start gap-2 rounded-lg border border-gray-200 p-2 dark:border-gray-600">
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <TextInput
                  sizing="sm"
                  placeholder={t("keyPlaceholder")}
                  value={filter.key}
                  onChange={(e) => updateFilter(index, "key", e.target.value)}
                  className="flex-1"
                />
                <TextInput
                  sizing="sm"
                  placeholder={t("labelPlaceholder")}
                  value={filter.label}
                  onChange={(e) => updateFilter(index, "label", e.target.value)}
                  className="flex-1"
                />
                <Select
                  sizing="sm"
                  value={filter.type}
                  onChange={(e) => updateFilter(index, "type", e.target.value)}
                  className="w-32 shrink-0"
                >
                  <option value="text">{t("textSearch")}</option>
                  <option value="date_range">{t("dateRange")}</option>
                </Select>
              </div>
            </div>
            <Button
              type="button"
              color="failure"
              size="xs"
              onClick={() => removeFilter(index)}
            >
              &times;
            </Button>
          </div>
          {filter.type === "date_range" && filter.key && (
            <div className="ml-4 space-y-1">
              {[`${filter.key}_from`, `${filter.key}_to`].map((derived) => (
                <div
                  key={derived}
                  className="flex items-center gap-2 rounded border border-dashed border-gray-200 bg-gray-50 px-2 py-1 dark:border-gray-600 dark:bg-gray-700/50"
                >
                  <code className="flex-1 text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {`{{filter.${derived}}}`}
                  </code>
                  <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                    {t("autoGenerated")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Show default date range keys when no date_range filter is configured */}
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
              <code className="flex-1 text-xs text-gray-500 dark:text-gray-400 font-mono">
                {`{{filter.${derived}}}`}
              </code>
              <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                {t("autoGenerated")}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between gap-2">
        <Button type="button" color="light" size="sm" onClick={addFilter}>
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
        onChange={(e) => setRefreshInterval(Number(e.target.value) as RefreshInterval)}
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
// Allowed Groups Form
// ============================================================================

function AllowedGroupsForm() {
  const { allowedGroups, setAllowedGroups, dictionary } = useDashboard();
  const t = (key: string) => tr(`dashboard.settings.${key}`, dictionary);
  const { data: userGroups, isLoading } = useUserGroups();
  const [localGroups, setLocalGroups] = useState<string[]>(allowedGroups);

  useEffect(() => {
    setLocalGroups(allowedGroups);
  }, [allowedGroups]);

  const toggleGroup = (group: string) => {
    setLocalGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  const handleSave = () => {
    setAllowedGroups(localGroups);
    ShowNotification({
      type: "success",
      message: t("allowedGroupsUpdated"),
    });
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("loadingGroups")}</p>
      </div>
    );
  }

  const availableGroups = userGroups ?? [];

  return (
    <div className="p-4 space-y-3">
      {availableGroups.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("noGroupsAvailable")}
        </p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {availableGroups.map((group) => (
            <label
              key={group}
              className="flex items-center gap-2 cursor-pointer rounded-lg border border-gray-200 dark:border-gray-600 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <input
                type="checkbox"
                checked={localGroups.includes(group)}
                onChange={() => toggleGroup(group)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                {group.replace(/^GROUP_/, "")}
              </span>
            </label>
          ))}
        </div>
      )}

      {localGroups.length === 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
          {t("noGroupRestrictions")}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={handleSave}>
          {tr("common.save", dictionary)}
        </Button>
      </div>
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
// Main Component
// ============================================================================

export default function DashboardSettingsDropdown() {
  const {
    dashboardName,
    setDashboardName,
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
    navigator.clipboard.writeText(json).then(() => {
      ShowNotification({
        type: "success",
        message: "Dashboard copied to clipboard",
      });
    }).catch((error) => {
      console.error("Failed to copy to clipboard:", error);
      ShowNotification({
        type: "error",
        message: "Failed to copy dashboard to clipboard",
      });
    });
  }, [exportDashboard]);

  const handleSaveName = useCallback(
    (name: string) => {
      setDashboardName(name);
      ShowNotification({
        type: "success",
        message: "Dashboard renamed successfully",
      });
    },
    [setDashboardName]
  );

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
        <div className="absolute z-50 right-0 top-full mt-2 h-fit bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-[360px] w-[440px]">
          <SettingsSection
            option="share"
            selected={selected}
            setSelected={setSelected}
            title="Share Dashboard"
            description="Copy link or download snapshot"
          >
            <ShareForm dashboardName={dashboardName} onClose={closePanel} />
          </SettingsSection>

          <SettingsSection
            option="rename"
            selected={selected}
            setSelected={setSelected}
            title="Rename Dashboard"
            description="Change the dashboard display name"
          >
            <RenameForm
              currentName={dashboardName}
              onSave={handleSaveName}
              onClose={closePanel}
            />
          </SettingsSection>

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
            title="Export Dashboard"
            description="Download or copy configuration"
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
            title="Import Dashboard"
            description="Restore from JSON file or text"
          >
            <ImportForm onImport={importDashboard} onClose={closePanel} />
          </SettingsSection>

          <SettingsSection
            option="filters"
            selected={selected}
            setSelected={setSelected}
            title={tr("dashboard.settings.filterBarTitle", dictionary)}
            description={tr("dashboard.settings.filterBarDescription", dictionary)}
          >
            <FilterManagerForm filters={filters} onSave={setFilters} />
          </SettingsSection>

          <SettingsSection
            option="refresh"
            selected={selected}
            setSelected={setSelected}
            title={tr("dashboard.settings.autoRefresh", dictionary)}
            description={tr("dashboard.settings.autoRefreshDescription", dictionary)}
          >
            <RefreshForm />
          </SettingsSection>

          <SettingsSection
            option="planner"
            selected={selected}
            setSelected={setSelected}
            title="Request Planner"
            description="Define shared data queries"
            maxHeight="max-h-[60vh]"
          >
            <PlannerManagerForm />
          </SettingsSection>

          <SettingsSection
            option="access"
            selected={selected}
            setSelected={setSelected}
            title={tr("dashboard.settings.accessControlTitle", dictionary)}
            description={tr("dashboard.settings.accessControlDescription", dictionary)}
          >
            <AllowedGroupsForm />
          </SettingsSection>

          <SettingsSection
            option="delete"
            selected={selected}
            setSelected={setSelected}
            title={tr("dashboard.landing.delete_confirm_title", dictionary)}
            description={tr("dashboard.settings.deleteDescription", dictionary)}
          >
            <div className="p-4">
              <Button
                color="failure"
                size="sm"
                onClick={handleDeleteClick}
              >
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
        description={tr("dashboard.landing.delete_confirm_message", dictionary, {
          name: dashboardName,
        })}
        confirmText={tr("dashboard.landing.delete_confirm_title", dictionary)}
      />
    </div>
  );
}
