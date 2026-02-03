/**
 * Default widget sizes by component type
 *
 * Centralized configuration for widget minimum/initial sizes.
 * All grid-related code should import from here.
 */

export interface WidgetSizeDefaults {
  minW: number;
  minH: number;
}

/**
 * Default sizes for each widget type
 * - minW/minH are used as both minimum constraints and initial size
 */
const WIDGET_DEFAULTS: Record<string, WidgetSizeDefaults> = {
  "labeled-container": { minW: 4, minH: 2 },
  card: { minW: 3, minH: 1 },
  container: { minW: 8, minH: 4 },
};

/** Fallback for unknown widget types */
const DEFAULT_SIZE: WidgetSizeDefaults = { minW: 1, minH: 1 };

/**
 * Get default size constraints for a widget type
 * @param componentId - The widget's component ID (e.g., 'card', 'container')
 * @returns Size defaults with minW and minH
 */
export function getWidgetDefaults(componentId: string): WidgetSizeDefaults {
  return WIDGET_DEFAULTS[componentId] ?? DEFAULT_SIZE;
}
