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
};

export type Task = {
  id: string;
};

export type KanbanBoardTask = {
  id: string;
  name: string;
  description: string;
  completed: boolean;
  daysLeft: number;
  attachment?: string;
  origin?: string;
  destination?: string;
  client?: string;
  clientCode?: string;
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
