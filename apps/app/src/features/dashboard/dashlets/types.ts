/**
 * Dashlet Type Definitions
 *
 * Types for self-contained dashlet components with metadata,
 * rendering component, and optional settings modal.
 */

import type { ComponentType, ReactNode } from "react";
import type { Widget, DashletCategory } from "../types/dashboard.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

export interface DashletLayoutDefaults {
  minW: number;
  minH: number;
}

/** Shared data provider entry used by dashlets that support Handlebars templates */
export interface DataProviderEntry {
  key: string;
  value: string;
  _id?: number;
}

/**
 * Dashlet metadata for registry and selector
 */
export interface DashletMeta {
  /** Unique dashlet identifier (e.g., 'container', 'card') */
  id: string;
  /** Display name for selector */
  name: string;
  /** Short description for selector */
  description: string;
  /** Icon component for selector */
  icon: ComponentType<{ className?: string }>;
  /** Category for grouping in selector */
  category: DashletCategory;
  /**
   * Which parent types this dashlet can be nested in
   * Empty array = can be placed anywhere
   * e.g., ['container', 'labeled-container'] = can be placed inside those
   * @deprecated Use isRootOnly instead for simpler logic
   */
  canNestIn: string[];
  /** If true, this dashlet can ONLY be placed at root level (not inside other widgets) */
  isRootOnly?: boolean;
  /** Whether this dashlet has a settings modal */
  hasSettings: boolean;
  /** Whether this dashlet can contain children */
  hasChildren: boolean;
}

/**
 * Props passed to dashlet components
 */
export interface DashletComponentProps {
  /** The widget data */
  widget: Widget;
  /** Whether edit mode is active */
  editMode: boolean;
  /** Whether this widget is at root level (affects styling like backgrounds) */
  isRoot?: boolean;
  /** Callback to add a child widget (for container types) */
  onAddChild?: (componentId: string) => void;
  /** Callback to open settings modal */
  onOpenSettings?: () => void;
  /** Callback to delete this widget */
  onDelete?: () => void;
  /** Children rendered inside (for container types) */
  children?: ReactNode;
}

/**
 * Props passed to dashlet settings modals
 */
export interface DashletSettingsProps<
  TConfig extends object = Record<string, unknown>,
> {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Current configuration values */
  config: TConfig;
  /** Callback to save updated configuration */
  onSave: (config: Partial<TConfig>) => void;
  /** Dictionary for internationalization */
  dictionary: I18nRecord;
}

/**
 * Complete dashlet definition including component and metadata
 */
export interface DashletDefinition {
  /** Dashlet metadata */
  meta: DashletMeta;
  /** The dashlet component to render */
  Component: ComponentType<DashletComponentProps>;
  /** Optional settings modal component */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SettingsModal?: ComponentType<DashletSettingsProps<any>>;
  /** Default configuration values */
  defaultConfig: Record<string, unknown>;
  /** Resolver for default layout constraints */
  getLayoutDefaults: (
    config?: Record<string, unknown>
  ) => DashletLayoutDefaults;
}
