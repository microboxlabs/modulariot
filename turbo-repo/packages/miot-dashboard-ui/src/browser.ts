/** Self-contained browser build: React stays internal to the embedding runtime. */
export { mountDashboard, DashboardMountError, type DashboardMount, type DashboardMountOptions } from "./embed";
export { defineDashboardElement, DashboardElementRegistrationError, type DashboardElement, type DashboardElementConstructor } from "./web-component";

export { createTextCardRegistry, type TextCardRegistryOptions } from "./embed";

export { createPercentageValueRegistry, type PercentageValueRegistryOptions } from "./embed";
