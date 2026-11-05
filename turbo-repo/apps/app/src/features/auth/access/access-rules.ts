import type { AccessRule } from "./access-control";

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
  tripsView: "trips:view",
} as const;

/** Every gate the app decides, with the permissions that open it. */
export const ACCESS_RULES = {
  adminConsole: { requiredPermissions: [PERMISSIONS.adminConsole] },
  taskUnclaim: { requiredPermissions: [PERMISSIONS.taskUnclaim] },
  liveStreams: { requiredPermissions: [PERMISSIONS.liveStreamsView] },
  dashboards: { requiredPermissions: [PERMISSIONS.dashboardsView] },
  calendar: {
    requiredPermissions: [
      PERMISSIONS.calendarView,
      PERMISSIONS.calendarPlan,
      PERMISSIONS.calendarAssign,
    ],
  },
  calendarView: { requiredPermissions: [PERMISSIONS.calendarView] },
  calendarPlan: { requiredPermissions: [PERMISSIONS.calendarPlan] },
  calendarAssign: { requiredPermissions: [PERMISSIONS.calendarAssign] },
  bookingWrite: {
    requiredPermissions: [PERMISSIONS.calendarPlan, PERMISSIONS.calendarAssign],
  },
  kanban: { requiredPermissions: [PERMISSIONS.kanbanView] },
  loadsSearch: { requiredPermissions: [PERMISSIONS.loadsSearch] },
  taskComplete: { requiredPermissions: [PERMISSIONS.taskComplete] },
  finished: { requiredPermissions: [PERMISSIONS.finishedView] },
  reports: { requiredPermissions: [PERMISSIONS.reportsView] },
  geographic: { requiredPermissions: [PERMISSIONS.geographicView] },
  controlTower: { requiredPermissions: [PERMISSIONS.controlTowerView] },
  controlTowerCaseTreat: {
    requiredPermissions: [PERMISSIONS.controlTowerCaseTreat],
  },
  conversations: { requiredPermissions: [PERMISSIONS.conversationsView] },
  collaborators: { requiredPermissions: [PERMISSIONS.collaboratorsManage] },
  trips: { requiredPermissions: [PERMISSIONS.tripsView] },
} as const satisfies Record<string, AccessRule>;
