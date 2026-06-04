"use client";

import { useState } from "react";
import {
  HiCog6Tooth,
  HiDocumentDuplicate,
  HiPlus,
  HiTrash,
} from "react-icons/hi2";
import type { Widget } from "../../types/dashboard.types";
import { useDashboard } from "../../context/dashboard-context";
import { getDashlet } from "../../dashlets";
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
    <div className="widget-controls absolute right-2 top-2 z-[60] flex gap-1">
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
// WidgetRenderer - Main component
// ============================================================================

interface WidgetRendererProps {
  widget: Widget;
  /** Whether this widget is at root level (not inside another widget) */
  isRoot?: boolean;
}

/**
 * Recursive widget renderer
 * Renders the appropriate dashlet component based on widget.componentId
 * Includes edit/delete controls and settings modal integration
 */
export function WidgetRenderer({
  widget,
  isRoot = false,
}: Readonly<WidgetRendererProps>) {
  const {
    editMode,
    updateWidgetConfig,
    deleteWidget,
    duplicateWidget,
    dictionary,
  } = useDashboard();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAddChildModalOpen, setIsAddChildModalOpen] = useState(false);

  const dashlet = getDashlet(widget.componentId);

  const handleDelete = () => setIsDeleteModalOpen(true);
  const handleConfirmDelete = () => {
    deleteWidget(widget.id);
    setIsDeleteModalOpen(false);
  };

  // Handle unknown widget type
  if (!dashlet) {
    return (
      <div className="relative flex h-full items-center justify-center rounded-lg border border-red-300 bg-red-50 p-4 text-red-600 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400">
        {editMode && (
          <button
            type="button"
            onClick={handleDelete}
            onMouseDown={(e) => e.stopPropagation()}
            className="no-drag cursor-pointer absolute right-2 top-2 rounded bg-red-100 p-1.5 text-red-500 hover:bg-red-200 hover:text-red-700 dark:bg-red-900/50 dark:text-red-400 dark:hover:bg-red-800 dark:hover:text-red-300"
            title="Delete"
          >
            <HiTrash className="h-4 w-4" />
          </button>
        )}
        <span className="text-center text-sm">
          Widget not found
          <br />
          <span className="text-xs opacity-70">({widget.componentId})</span>
        </span>
        <DeleteWidgetModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleConfirmDelete}
          widgetName={widget.componentId}
        />
      </div>
    );
  }

  const { Component, SettingsModal, meta } = dashlet;

  const handleOpenAddChild = () => setIsAddChildModalOpen(true);
  const handleOpenSettings = () => setIsSettingsOpen(true);
  const handleDuplicate = () => duplicateWidget(widget.id);

  const handleSaveSettings = (config: Record<string, unknown>) => {
    updateWidgetConfig(widget.id, config);
  };

  // Render children recursively
  const childrenElements = widget.children?.map((child) => (
    <div key={child.id} className="h-full">
      <WidgetRenderer widget={child} />
    </div>
  ));

  return (
    <div id={`widget-${widget.id}`} className="widget-wrapper relative h-full">
      {/* Edit mode controls */}
      {editMode && (
        <WidgetControls
          hasChildren={meta.hasChildren}
          hasSettings={meta.hasSettings && !!SettingsModal}
          duplicateLabel={tr("dashboard.settings.duplicate", dictionary)}
          onAddChild={handleOpenAddChild}
          onOpenSettings={handleOpenSettings}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
        />
      )}

      {/* Dashlet component */}
      <Component
        widget={widget}
        editMode={editMode}
        isRoot={isRoot}
        onAddChild={meta.hasChildren ? handleOpenAddChild : undefined}
        onOpenSettings={meta.hasSettings ? handleOpenSettings : undefined}
        onDelete={handleDelete}
      >
        {childrenElements}
      </Component>

      {/* Add child widget modal (for container types) */}
      {meta.hasChildren && (
        <AddWidgetModal
          isOpen={isAddChildModalOpen}
          onClose={() => setIsAddChildModalOpen(false)}
          parentId={widget.id}
          parentComponentId={widget.componentId}
        />
      )}

      {/* Settings modal */}
      {SettingsModal && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          config={widget.config}
          onSave={handleSaveSettings}
          dictionary={dictionary}
          dashletName={trDynamic(meta.name, dictionary)}
          widgetId={widget.id}
        />
      )}

      {/* Delete modal */}
      <DeleteWidgetModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        widgetName={(widget.config as { name?: string }).name || meta.name}
      />
    </div>
  );
}
