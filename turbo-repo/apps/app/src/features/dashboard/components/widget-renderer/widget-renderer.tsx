"use client";

import { useEffect, useState } from "react";
import {
  WidgetRenderer as PortableWidgetRenderer,
  type WidgetFrameProps,
  type WidgetAction,
} from "@microboxlabs/miot-dashboard-ui/react";
import {
  HiCog6Tooth,
  HiDocumentDuplicate,
  HiPlus,
  HiTrash,
} from "react-icons/hi2";
import type { Widget } from "../../types/dashboard.types";
import { useDashboard } from "../../context/dashboard-context";
import { DeleteWidgetModal } from "../delete-widget-modal";
import { AddWidgetModal } from "../add-widget-modal/add-widget-modal";
import { tr, trDynamic } from "@/features/i18n/tr.service";

// ============================================================================
// WidgetControls - Extracted component for edit mode buttons
// ============================================================================

interface WidgetControlsProps {
  hasChildren: boolean;
  hasSettings: boolean;
  duplicateLabel: string;
  onAddChild: () => void;
  onOpenSettings: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/**
 * Edit mode control buttons for widgets (Add, Settings, Duplicate, Delete)
 */
function WidgetControls({
  hasChildren,
  hasSettings,
  duplicateLabel,
  onAddChild,
  onOpenSettings,
  onDuplicate,
  onDelete,
}: Readonly<WidgetControlsProps>) {
  return (
    <div className="widget-controls absolute right-2 top-2 z-50 flex gap-1">
      {hasChildren && (
        <button
          type="button"
          onClick={onAddChild}
          onMouseDown={(e) => e.stopPropagation()}
          className="no-drag cursor-pointer rounded bg-blue-500 p-1.5 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500"
          title="Add widget"
        >
          <HiPlus className="h-4 w-4" />
        </button>
      )}
      {hasSettings && (
        <button
          type="button"
          onClick={onOpenSettings}
          onMouseDown={(e) => e.stopPropagation()}
          className="no-drag cursor-pointer rounded bg-gray-100 p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-200"
          title="Settings"
        >
          <HiCog6Tooth className="h-4 w-4" />
        </button>
      )}
      <button
        type="button"
        onClick={onDuplicate}
        onMouseDown={(e) => e.stopPropagation()}
        className="no-drag cursor-pointer rounded bg-gray-100 p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-200"
        title={duplicateLabel}
        aria-label={duplicateLabel}
      >
        <HiDocumentDuplicate className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        onMouseDown={(e) => e.stopPropagation()}
        className="no-drag cursor-pointer rounded bg-gray-100 p-1.5 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
        title="Delete"
      >
        <HiTrash className="h-4 w-4" />
      </button>
    </div>
  );
}

// ============================================================================
// App controls and dialogs around the shared recursive renderer
// ============================================================================

function AppWidgetFrame({
  widget,
  definition,
  editMode,
  onAction,
  children,
}: Readonly<WidgetFrameProps>) {
  const { dictionary, registry } = useDashboard();
  const dashlet = registry.get(widget.componentId);
  return (
    <>
      {editMode && (
        <WidgetControls
          hasChildren={definition?.meta.hasChildren ?? false}
          hasSettings={
            !!dashlet?.SettingsModal && !!definition?.meta.hasSettings
          }
          duplicateLabel={tr("dashboard.settings.duplicate", dictionary)}
          onAddChild={() => onAction("add")}
          onOpenSettings={() => onAction("settings")}
          onDuplicate={() => onAction("duplicate")}
          onDelete={() => onAction("delete")}
        />
      )}
      {children}
    </>
  );
}

const legacyWidgetDomId = (widget: Widget) => `widget-${widget.id}`;

export function WidgetRenderer({
  widget,
  isRoot = false,
}: Readonly<{ widget: Widget; isRoot?: boolean }>) {
  const {
    registry,
    editMode,
    updateWidgetConfig,
    deleteWidget,
    duplicateWidget,
    findWidget,
    dictionary,
  } = useDashboard();
  const [selection, setSelection] = useState<{
    widgetId: string;
    action: WidgetAction;
  } | null>(null);
  const onAction = (target: Widget, action: WidgetAction) => {
    if (!editMode) return;
    if (action === "duplicate") duplicateWidget(target.id);
    else setSelection({ widgetId: target.id, action });
  };
  const selectedWidget = selection ? findWidget(selection.widgetId) : undefined;
  useEffect(() => {
    if (!editMode || !selectedWidget) setSelection(null);
  }, [editMode, selectedWidget]);
  const selectedDefinition = selectedWidget
    ? registry.get(selectedWidget.componentId)
    : undefined;
  const SettingsModal = selectedDefinition?.SettingsModal;
  const close = () => setSelection(null);
  return (
    <>
      <PortableWidgetRenderer
        widget={widget}
        isRoot={isRoot}
        registry={registry}
        editMode={editMode}
        onAction={onAction}
        Frame={AppWidgetFrame}
        widgetDomId={legacyWidgetDomId}
        unknownWidgetLabel="Widget not found"
      />
      {editMode && selection && selectedWidget && (
        <>
          {selection.action === "add" && (
            <AddWidgetModal
              isOpen
              onClose={close}
              parentId={selectedWidget.id}
              parentComponentId={selectedWidget.componentId}
            />
          )}
          {selection.action === "settings" && SettingsModal && (
            <SettingsModal
              isOpen
              onClose={close}
              config={selectedWidget.config}
              onSave={(config: Record<string, unknown>) => {
                if (editMode) updateWidgetConfig(selectedWidget.id, config);
              }}
              dictionary={dictionary}
              dashletName={trDynamic(selectedDefinition.meta.name, dictionary)}
              widgetId={selectedWidget.id}
            />
          )}
          {selection.action === "delete" && (
            <DeleteWidgetModal
              isOpen
              onClose={close}
              onConfirm={() => {
                if (editMode) deleteWidget(selectedWidget.id);
                close();
              }}
              widgetName={
                (selectedWidget.config as { name?: string }).name ||
                selectedDefinition?.meta.name ||
                selectedWidget.componentId
              }
            />
          )}
        </>
      )}
    </>
  );
}
