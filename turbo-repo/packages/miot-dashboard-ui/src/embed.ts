export {
  mountDashboard,
  DashboardMountError,
  type DashboardMount,
  type DashboardMountOptions,
} from "./embed/mount-dashboard";

export { createTextCardRegistry, type TextCardRegistryOptions } from "@microboxlabs/miot-dashboard-ui/react";

export { createPercentageValueRegistry, type PercentageValueRegistryOptions } from "@microboxlabs/miot-dashboard-ui/react";

export { createCircularStatRegistry, type CircularStatRegistryOptions } from "@microboxlabs/miot-dashboard-ui/react";

export { createProgressStatRegistry, type ProgressStatRegistryOptions } from "./react/progress-stat-registry";

export { createDataTableRegistry, createDataListRegistry, createResizableDataTableRegistry, type ResizableDataTableRegistryOptions, type DataTableRegistryOptions } from "./react/data-table-registry";

export { createStatusStatRegistry, type StatusStatRegistryOptions } from "./react/status-stat-registry";

export { createIconStatRegistry, type IconStatRegistryOptions } from "./react/icon-stat-registry";

export { createSensitiveStatRegistry, type SensitiveStatRegistryOptions } from "./react/sensitive-stat-registry";

export { createStackedStatRegistry, type StackedStatRegistryOptions } from "./react/stacked-stat-registry";

export { createExpandableStatRegistry, type ExpandableStatRegistryOptions } from "./react/expandable-stat-registry";

export { createDetailedStatRegistry, type DetailedStatRegistryOptions } from "./react/detailed-stat-registry";

export { createSparklineStatRegistry, type SparklineStatRegistryOptions } from "./react/sparkline-stat-registry";
