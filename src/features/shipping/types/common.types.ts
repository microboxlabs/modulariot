export type KanbanBoard = {
  id: number;
  title: string;
  tasks: KanbanBoardTask[];
};

export type KanbanBoardTaskResponse = {
  total: number;
  data: Record<string, KanbanBoard>;
};

export interface Task {
  id: string; // o el tipo de dato que necesites
}

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
