"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button, TextInput, Textarea, FileInput, Label } from "flowbite-react";
import { FaGear } from "react-icons/fa6";
import { ChevronLeft } from "flowbite-react-icons/outline";
import { HiArrowDownTray } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";
import { useDashboard } from "../../context/dashboard-context";
import { ShowNotification } from "@/features/notifications/notification";

// ============================================================================
// Types
// ============================================================================

type SettingOption = "rename" | "export" | "import" | null;

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

function getSectionClasses(expanded: boolean, active: boolean) {
  return {
    headerHeightClass: expanded ? "h-16" : "h-0",
    headerInteractiveClass: active
      ? ""
      : "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 w-full",
    contentMaxHeightClass: active ? "max-h-[400px]" : "max-h-0",
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
        className={`${contentMaxHeightClass} transition-all duration-300 overflow-hidden`}
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
}

function SettingsSection({
  option,
  selected,
  setSelected,
  title,
  description,
  children,
}: Readonly<SettingsSectionProps>) {
  const active = isSectionActive(selected, option);
  const expanded = isSectionExpanded(selected, option);
  const classes = getSectionClasses(expanded, active);

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

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
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
      }
    };
    reader.onerror = () => {
      setImportError("Failed to read file");
    };
    reader.readAsText(file);
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
// Main Component
// ============================================================================

export default function DashboardSettingsDropdown() {
  const {
    dashboardName,
    setDashboardName,
    exportDashboard,
    importDashboard,
    downloadDashboard,
  } = useDashboard();

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SettingOption>(null);
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
        <div className="absolute z-50 right-0 top-full mt-2 h-fit bg-white dark:bg-gray-800 overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-[320px] w-[380px]">
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
        </div>
      )}
    </div>
  );
}
