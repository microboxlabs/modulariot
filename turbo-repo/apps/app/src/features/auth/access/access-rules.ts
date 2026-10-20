import type { AccessRule } from "./access-control";

export const ADMIN_GROUPS = [
  "GROUP_ALFRESCO_ADMINISTRATORS",
  "GROUP_MINTRAL_SYSTEM_ADMIN",
] as const;

export const KANBAN_ACCESS_GROUPS = [
  "GROUP_MINTRAL_KANBAN_ACCESS",
  "GROUP_GAMA_KANBAN_ACCESS",
] as const;

export const REVIEWER_GROUP = "GROUP_MINTRAL_REVISOR";

export const PERMISSIONS = {
  adminConsole: "admin:console",
  taskUnclaim: "admin:task.unclaim",
  liveStreamsView: "admin:livestreams.view",
  dashboardsView: "dashboards:view",
  calendarView: "calendar:view",
  calendarPlan: "calendar:plan",
  calendarAssign: "calendar:assign",
  kanbanView: "coordination:kanban.view",
  loadsSearch: "coordination:loads.search",
  taskComplete: "coordination:task.complete",
  finishedView: "coordination:finished.view",
  reportsView: "coordination:reports.view",
  geographicView: "coordination:geographic.view",
  controlTowerView: "controltower:view",
  controlTowerCaseTreat: "controltower:case.treat",
  conversationsView: "conversations:view",
  collaboratorsManage: "collaborators:manage",
} as const;

const CALENDAR_PERMISSIONS = [
  PERMISSIONS.calendarView,
  PERMISSIONS.calendarPlan,
  PERMISSIONS.calendarAssign,
];

/**
 * Every gate the app decides, each with the Alfresco groups it used to check
 * and the permission that replaces them. Groups stay empty where the gate was
 * open, so `groups` mode keeps today's behaviour.
 */
export const ACCESS_RULES = {
  adminConsole: {
    requiredGroups: ADMIN_GROUPS,
    requiredPermissions: [PERMISSIONS.adminConsole],
  },
  taskUnclaim: {
    requiredGroups: ADMIN_GROUPS,
    requiredPermissions: [PERMISSIONS.taskUnclaim],
  },
  liveStreamsMenu: {
    requiredGroups: ["GROUP_ALFRESCO_ADMINISTRATORS"],
    requiredPermissions: [PERMISSIONS.liveStreamsView],
  },
  liveStreamsPage: { requiredPermissions: [PERMISSIONS.liveStreamsView] },
  dashboards: {
    requiredGroups: ["GROUP_DASHBOARD"],
    requiredPermissions: [PERMISSIONS.dashboardsView],
  },
  calendarMenu: {
    requiredGroups: [
      "GROUP_ASSIGNMENT",
      "GROUP_PLANNING",
      "GROUP_CALENDAR_VIEWER",
    ],
    requiredPermissions: CALENDAR_PERMISSIONS,
  },
  calendarPage: { requiredPermissions: CALENDAR_PERMISSIONS },
  calendarView: {
    requiredGroups: ["GROUP_CALENDAR_VIEWER"],
    requiredPermissions: [PERMISSIONS.calendarView],
  },
  calendarPlan: {
    requiredGroups: ["GROUP_PLANNING"],
    requiredPermissions: [PERMISSIONS.calendarPlan],
  },
  calendarAssign: {
    requiredGroups: ["GROUP_ASSIGNMENT"],
    requiredPermissions: [PERMISSIONS.calendarAssign],
  },
  bookingWrite: {
    requiredGroups: ["GROUP_PLANNING", "GROUP_ASSIGNMENT"],
    requiredPermissions: [PERMISSIONS.calendarPlan, PERMISSIONS.calendarAssign],
  },
  kanban: {
    requiredGroups: KANBAN_ACCESS_GROUPS,
    requiredPermissions: [PERMISSIONS.kanbanView],
  },
  kanbanPage: { requiredPermissions: [PERMISSIONS.kanbanView] },
  loadsSearch: {
    requiredGroups: ["GROUP_MINTRAL_BUSCADOR_CARGAS"],
    requiredPermissions: [PERMISSIONS.loadsSearch],
  },
  taskComplete: {
    blockedGroups: [REVIEWER_GROUP],
    requiredPermissions: [PERMISSIONS.taskComplete],
  },
  finished: { requiredPermissions: [PERMISSIONS.finishedView] },
  reports: { requiredPermissions: [PERMISSIONS.reportsView] },
  geographic: { requiredPermissions: [PERMISSIONS.geographicView] },
  controlTower: { requiredPermissions: [PERMISSIONS.controlTowerView] },
  controlTowerCaseTreat: {
    requiredPermissions: [PERMISSIONS.controlTowerCaseTreat],
  },
  conversations: {
    requiredGroups: ["GROUP_CONVERSATIONS"],
    requiredPermissions: [PERMISSIONS.conversationsView],
  },
  collaboratorsMenu: {
    requiredGroups: [
      "GROUP_COLLABORATORS_MANAGEMENT",
      "GROUP_COLABORATORS_MANAGEMENT",
    ],
    requiredPermissions: [PERMISSIONS.collaboratorsManage],
  },
  collaboratorsPage: {
    requiredPermissions: [PERMISSIONS.collaboratorsManage],
  },
} as const satisfies Record<string, AccessRule>;
