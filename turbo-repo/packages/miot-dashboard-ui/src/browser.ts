/** Self-contained browser build: React stays internal to the embedding runtime. */
export { mountDashboard, DashboardMountError, type DashboardMount, type DashboardMountOptions } from "./embed";
export { defineDashboardElement, DashboardElementRegistrationError, type DashboardElement, type DashboardElementConstructor } from "./web-component";

export { createTextCardRegistry, type TextCardRegistryOptions } from "./embed";

export { createPercentageValueRegistry, type PercentageValueRegistryOptions } from "./embed";

export { createCircularStatRegistry, type CircularStatRegistryOptions } from "./embed";

export { createProgressStatRegistry, type ProgressStatRegistryOptions } from "./embed";

export { createDataTableRegistry, createDataListRegistry, createResizableDataTableRegistry, type ResizableDataTableRegistryOptions, type DataTableRegistryOptions } from "./embed";

export { createStatusStatRegistry, type StatusStatRegistryOptions } from "./embed";

export { createIconStatRegistry, type IconStatRegistryOptions } from "./embed";

export { createSensitiveStatRegistry, type SensitiveStatRegistryOptions } from "./embed";
