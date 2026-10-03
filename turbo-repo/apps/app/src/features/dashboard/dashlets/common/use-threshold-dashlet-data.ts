import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import {
  useDashletPgrest,
  type PgrestDashletFields,
} from "./use-dashlet-pgrest";
import { useRowThreshold } from "./use-threshold";
import type { ThresholdConfig } from "./threshold-types";

/** Resolved fields plus row threshold state for scalar dashlets. */
export function useThresholdDashletData<
  C extends PgrestDashletFields & { thresholds?: ThresholdConfig },
>(
  widgetConfig: Record<string, unknown>,
  config: C,
  fieldDefaults: Record<string, string>
) {
  const refreshIntervalMs = useEffectiveRefreshInterval(widgetConfig);
  const { resolved, loading, fetchError, firstRow } = useDashletPgrest(
    config,
    fieldDefaults,
    refreshIntervalMs
  );
  const { color: thresholdColor, appliesTo } = useRowThreshold(
    config.thresholds,
    firstRow
  );
  return { resolved, loading, fetchError, thresholdColor, appliesTo };
}
