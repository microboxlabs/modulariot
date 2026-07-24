/**
 * Threshold engine — moved to @microboxlabs/miot-dashboard-ui (P3).
 *
 * This shim keeps existing app import paths working during the extraction;
 * new code should import from the package directly.
 */

export {
  isLegacyColor,
  isHexColor,
  evaluateThreshold,
  getThresholdBgClasses,
  getThresholdTextClasses,
  getThresholdTextStyle,
  getThresholdIconClasses,
  getThresholdBorderClasses,
  getThresholdStrokeClass,
  getThresholdStrokeStyle,
  getThresholdBarClass,
  getThresholdBarStyle,
  getThresholdGradientClasses,
} from "@microboxlabs/miot-dashboard-ui";
