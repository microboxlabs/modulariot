import { I18nRecord } from "@/features/i18n/i18n.service.types";

export type KanbanBoard = {
  id: number;
  title: string;
  title2?: string;
  title3?: string;
  tasks: KanbanBoardTask[];
  finished: boolean;
};

export type KanbanBoardTaskResponse = {
  total: number;
  data: Record<string, KanbanBoard>;
  /**
   * Flat task list in the order the backend returned them, before being
   * binned by `taskFormKey` into `data`. Populated when the proxy issues a
   * single combined backend call (e.g. the calendar planner sidebar). The
   * board-binned `data` map loses the cross-board order via
   * `Object.values(...)` iteration, so consumers that rely on the global
   * sort (calendarPlanningPriority preset) should prefer this list.
   */
  orderedTasks?: KanbanBoardTask[];
};

export type Task = {
  id: string;
};

export type KanbanBoardTask = {
  id: string;
  name: string;
  /**
   * Stable business identifier for the service. Unlike `id` (which is the
   * Alfresco task instance id and changes on every workflow stage advance)
   * and `name` (a derived display label), this value is the same across the
   * service's whole lifecycle and is the only safe key to correlate kanban
   * tasks with calendar bookings or other persisted state.
   */
  mintral_serviceCode?: string;
  description: string;
  completed: boolean;
  daysLeft: number;
  attachment?: string;
  origin?: string;
  destination?: string;
  client?: string;
  clientCode?: string;
  mintral_clientRut?: string;
  mintral_delegacionOrigen?: string;
  expectedDepartureDate?: string;
  serviceKind: string;
  executionType: string;
  members: KanbanBoardTaskMember[];
  hoReference: string;
  title?: string;
  departureDate?: string;
  arrivalDate?: string;
  estimatedArrivalDate?: string;
  mintral_truckLicensePlate?: string;
  mintral_supplierName?: string;
  mintral_priorityCode?: string;
  mintral_icuCondition?: number;
  isEditable: boolean;
  taskType?: string;
  areaType?: string;
  duration?: string;
  cm_created?: string;
  mintral_incidents?: Array<[string, unknown]>;
  mintral_loadConstraint?: string;
  mintral_loadVolumeUtilization?: number;
  mintral_loadWeightUtilization?: number;
  mintral_loadPalletUtilization?: number;
  mintral_loadMaxUtilization?: number;
  mintral_deliveryComplianceRate?: number;
  mintral_compliantOrderLines?: number;
  mintral_nonCompliantOrderLines?: number;
  mintral_serviceCategory?: string;
  mintral_creationDate?: string;
};

export type KanbanBoardTaskMember = {
  id: number;
  name: string;
  avatar: string;
};

export type KanbanPageData = {
  showFinishedTasks: boolean;
  showWorkflowTasks?: string;
  kanbanBoards: KanbanBoard[];
  lang: string;
  dictionary: dictionary_components;
  // tasks: any;
};

export type GeographicViewPageData = {
  lang: string;
};

type dictionary_components = {
  base: I18nRecord;
  general: I18nRecord;
};
