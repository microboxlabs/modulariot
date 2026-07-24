/**
 * @microboxlabs/miot-dashboard-ui/charts — chart dashlets entry.
 *
 * Kept as a separate entry so echarts (~1 MB) never lands in the base bundle
 * of a consumer that doesn't use charts. Populated in phase P5c (chart,
 * chart_v2).
 */
export const CHARTS_ENTRY = "@microboxlabs/miot-dashboard-ui/charts";
