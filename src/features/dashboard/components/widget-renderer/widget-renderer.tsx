"use client";

import { useState } from "react";
import { HiCog6Tooth, HiPlus, HiTrash } from "react-icons/hi2";
import type { Widget } from "../../types/dashboard.types";
import { useDashboard } from "../../context/dashboard-context";
import { getDashlet } from "../../dashlets";
import { DeleteWidgetModal } from "../delete-widget-modal";
import { AddWidgetModal } from "../add-widget-modal/add-widget-modal";

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
}: WidgetRendererProps) {
  const { editMode, createWidget, updateWidgetConfig, deleteWidget } =
    useDashboard();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAddChildModalOpen, setIsAddChildModalOpen] = useState(false);

  const dashlet = getDashlet(widget.componentId);

  if (!dashlet) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-red-300 bg-red-50 p-4 text-red-600">
        Unknown widget type: {widget.componentId}
      </div>
    );
  }

  const { Component, SettingsModal, meta } = dashlet;

  const handleOpenAddChild = () => {
    setIsAddChildModalOpen(true);
  };

  const handleAddChild = (componentId: string) => {
    createWidget(componentId, widget.id);
    setIsAddChildModalOpen(false);
  };

  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
  };

  const handleSaveSettings = (config: Record<string, unknown>) => {
    updateWidgetConfig(widget.id, config);
  };

  const handleDelete = () => {
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    deleteWidget(widget.id);
    setIsDeleteModalOpen(false);
  };

  // Handler to stop propagation - prevents parent grid from receiving drag events
  const stopParentDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
  };

  // Render children recursively - each child stops event propagation to prevent parent drag
  const childrenElements = widget.children?.map((child) => (
    <div
      key={child.id}
      className="h-full"
      onMouseDown={stopParentDrag}
      onTouchStart={stopParentDrag}
    >
      <WidgetRenderer widget={child} />
    </div>
  ));

  // For root-level widgets, render with full height wrapper
  if (isRoot) {
    return (
      <div className="widget-wrapper relative h-full">
        {/* Edit mode controls - visibility controlled by CSS */}
        {editMode && (
          <div className="widget-controls absolute right-2 top-2 z-10 flex gap-1">
            {meta.hasChildren && (
              <button
                type="button"
                onClick={handleOpenAddChild}
                onMouseDown={(e) => e.stopPropagation()}
                className="no-drag rounded bg-blue-500 p-1.5 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500"
                title="Add widget"
              >
                <HiPlus className="h-4 w-4" />
              </button>
            )}
            {meta.hasSettings && SettingsModal && (
              <button
                type="button"
                onClick={handleOpenSettings}
                onMouseDown={(e) => e.stopPropagation()}
                className="no-drag rounded bg-gray-100 p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-200"
                title="Settings"
              >
                <HiCog6Tooth className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              onMouseDown={(e) => e.stopPropagation()}
              className="no-drag rounded bg-gray-100 p-1.5 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
              title="Delete"
            >
              <HiTrash className="h-4 w-4" />
            </button>
          </div>
        )}

        <Component
          widget={widget}
          editMode={editMode}
          isRoot={true}
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

  // For non-root widgets (inside a grid), render with controls
  return (
    <div className="widget-wrapper relative h-full">
      {/* Edit mode controls - visibility controlled by CSS */}
      {editMode && (
        <div className="widget-controls absolute right-2 top-2 z-10 flex gap-1">
          {meta.hasChildren && (
            <button
              type="button"
              onClick={handleOpenAddChild}
              onMouseDown={(e) => e.stopPropagation()}
              className="no-drag rounded bg-blue-500 p-1.5 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500"
              title="Add widget"
            >
              <HiPlus className="h-4 w-4" />
            </button>
          )}
          {meta.hasSettings && SettingsModal && (
            <button
              type="button"
              onClick={handleOpenSettings}
              onMouseDown={(e) => e.stopPropagation()}
              className="no-drag rounded bg-gray-100 p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-200"
              title="Settings"
            >
              <HiCog6Tooth className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            onMouseDown={(e) => e.stopPropagation()}
            className="no-drag rounded bg-gray-100 p-1.5 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
            title="Delete"
          >
            <HiTrash className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Dashlet component */}
      <Component
        widget={widget}
        editMode={editMode}
        isRoot={false}
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
