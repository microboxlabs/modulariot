/**
 * Threshold vocabulary — moved to @microboxlabs/miot-dashboard-ui (P3).
 *
 * This shim keeps existing app import paths working during the extraction;
 * new code should import from the package directly.
 */

export type {
  ThresholdTarget,
  ThresholdRule,
  ThresholdConfig,
  ThresholdRuleItem,
} from "@microboxlabs/miot-dashboard-ui";

export {
  THRESHOLD_TARGETS,
  THRESHOLD_TARGET_LABELS,
} from "@microboxlabs/miot-dashboard-ui";
