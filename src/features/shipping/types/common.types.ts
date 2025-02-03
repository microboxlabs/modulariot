export type KanbanBoard = {
  id: number;
  title: string;
  tasks: KanbanBoardTask[];
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
  members: KanbanBoardTaskMember[];
  hoReference: string;
  title?: string;
  departureDate?: string;
};

export type KanbanBoardTaskMember = {
  id: number;
  name: string;
  avatar: string;
};

export type KanbanPageData = {
  kanbanBoards: KanbanBoard[];
  lang: string;
  // tasks: any;
};

export type GeographicViewPageData = {
  lang: string;
};
