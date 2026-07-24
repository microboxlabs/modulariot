/**
 * @microboxlabs/miot-dashboard-ui — package entry.
 *
 * P0 scaffold: the public surface is assembled over the extraction phases
 * (P1 contracts/seams → P2 persistence/datasources → P3 core → P4 registry →
 * P5 dashlets → P6 shell). Chart dashlets are exported from the separate
 * "./charts" entry so echarts never lands in this base bundle.
 */
export const PACKAGE_NAME = "@microboxlabs/miot-dashboard-ui";
