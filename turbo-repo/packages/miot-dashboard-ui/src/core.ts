/**
 * @microboxlabs/miot-dashboard-ui/core — the React-free logic surface.
 *
 * Everything exported here runs without React or a DOM: rule/threshold
 * engines, handlebars formatting (on an isolated Handlebars environment —
 * the ambient module instance is never mutated), column/filter/pgrest
 * helpers, and grid math. Non-React hosts and server-side consumers can
 * import this entry directly; the root entry re-exports all of it.
 */

// ---- Color rules ----
export * from "./core/color-rule-types";
export * from "./core/color-rule-engine";
export * from "./core/color-rule-evaluation";
export * from "./core/color-rule-helpers";

// ---- Thresholds ----
export * from "./core/threshold-types";
export * from "./core/threshold-engine";
export * from "./core/threshold-helpers";

// ---- Handlebars: isolated environment, formatting, templates, validation ----
export * from "./core/handlebars-format-helpers";
export * from "./core/handlebars-templates";
export * from "./core/handlebars-validation";

// ---- Columns / filters / sorting ----
export * from "./core/column-types";
export * from "./core/column-helpers";
export * from "./core/column-filter-types";
export * from "./core/filter-types";
export * from "./core/filter-helpers";
export * from "./core/resolve-filter-params";

// ---- PgREST ----
export * from "./core/pgrest-types";
export * from "./core/pgrest-utils";
export * from "./core/pgrest-settings-helpers";

// ---- Grid math ----
export * from "./core/grid-sizing";
export * from "./core/get-next-position";
