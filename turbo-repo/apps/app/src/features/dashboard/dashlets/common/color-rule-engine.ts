/**
 * Color rule engine — moved to @microboxlabs/miot-dashboard-ui (P3).
 *
 * This shim keeps existing app import paths working during the extraction;
 * new code should import from the package directly.
 */

export {
  evaluateRule,
  findMatchingColor,
  getRowColorClasses,
  getRowColorStyles,
  getBadgeColorClassesByRule,
  getBadgeColorStyles,
  getColorDotClass,
  getColorDotStyles,
} from "@microboxlabs/miot-dashboard-ui";
