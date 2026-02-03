"use client";

import { useState, useMemo } from "react";
import { Modal, ModalHeader, TextInput } from "flowbite-react";
import { HiMagnifyingGlass } from "react-icons/hi2";
import { createPortal } from "react-dom";
import { useDashboard } from "../../context/dashboard-context";
import {
  getValidDashletsForParent,
  getDashletsByCategory,
  getCategories,
  getCategoryLabel,
  type DashletMeta,
} from "../../dashlets";

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Parent widget ID, or null for root level */
  parentId: string | null;
  /** Parent's componentId for filtering valid dashlets */
  parentComponentId: string | null;
}

/**
 * Component selector modal with search and categorized list
 * Filters available dashlets based on nesting rules
 */
export function AddWidgetModal({
  isOpen,
  onClose,
  parentId,
  parentComponentId,
}: AddWidgetModalProps) {
  const { createWidget } = useDashboard();
  const [searchQuery, setSearchQuery] = useState("");

  // Get valid dashlets for this parent
  const validDashlets = useMemo(
    () => getValidDashletsForParent(parentComponentId),
    [parentComponentId]
  );

  // Filter by search query
  const filteredDashlets = useMemo(() => {
    if (!searchQuery.trim()) return validDashlets;
    const query = searchQuery.toLowerCase();
    return validDashlets.filter(
      (d) =>
        d.meta.name.toLowerCase().includes(query) ||
        d.meta.description.toLowerCase().includes(query)
    );
  }, [validDashlets, searchQuery]);

  // Group by category
  const categories = useMemo(() => {
    const cats = getCategories();
    return cats
      .map((cat) => ({
        id: cat,
        label: getCategoryLabel(cat),
        dashlets: filteredDashlets.filter((d) => d.meta.category === cat),
      }))
      .filter((cat) => cat.dashlets.length > 0);
  }, [filteredDashlets]);

  const handleSelect = (componentId: string) => {
    createWidget(componentId, parentId);
    setSearchQuery("");
    onClose();
  };

  const handleClose = () => {
    setSearchQuery("");
    onClose();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (typeof window === "undefined") return null;

  const modalContent = (
    <Modal
      show={isOpen}
      onClose={handleClose}
      size="lg"
      onMouseDown={handleMouseDown}
    >
      {/* Header with close button */}
      <ModalHeader>Add Widget</ModalHeader>

      {/* Search input */}
      <div className="border-b border-gray-200 p-4 dark:border-gray-700">
        <TextInput
          icon={HiMagnifyingGlass}
          placeholder="Search components..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
          sizing="lg"
          className="w-full"
        />
      </div>

      {/* Scrollable content */}
      <div className="max-h-[400px] overflow-y-auto p-4">
        {categories.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-gray-500 dark:text-gray-400">
            <p>No components found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {categories.map((category) => (
              <div key={category.id}>
                {/* Category header */}
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {category.label}
                </h3>

                {/* Dashlet grid */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {category.dashlets.map((dashlet) => (
                    <DashletOption
                      key={dashlet.meta.id}
                      meta={dashlet.meta}
                      onSelect={() => handleSelect(dashlet.meta.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );

  return createPortal(modalContent, document.body);
}

interface DashletOptionProps {
  meta: DashletMeta;
  onSelect: () => void;
}

/**
 * Single dashlet option in the selector grid
 */
function DashletOption({ meta, onSelect }: DashletOptionProps) {
  const Icon = meta.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseDown={(e) => e.stopPropagation()}
      className="no-drag flex flex-col items-center rounded-lg border border-gray-200 p-4 text-center transition-all hover:border-blue-400 hover:bg-blue-50 dark:border-gray-700 dark:hover:border-blue-500 dark:hover:bg-blue-900/20"
    >
      <Icon className="mb-2 h-8 w-8 text-gray-500 dark:text-gray-400" />
      <span className="text-sm font-medium text-gray-900 dark:text-white">
        {meta.name}
      </span>
      <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {meta.description}
      </span>
    </button>
  );
}
