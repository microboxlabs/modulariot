import { getDashlet } from "../dashlets";
import type { DashletLayoutDefaults } from "../dashlets";

export type WidgetSizeDefaults = DashletLayoutDefaults;

const FALLBACK_DEFAULTS: WidgetSizeDefaults = { minW: 1, minH: 1 };

export function getWidgetDefaults(
  componentId: string,
  config?: Record<string, unknown>
): WidgetSizeDefaults {
  const dashlet = getDashlet(componentId);
  if (!dashlet) {
    return FALLBACK_DEFAULTS;
  }
  return dashlet.getLayoutDefaults(config);
}
