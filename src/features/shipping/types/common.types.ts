export type KanbanBoard = {
  id: number;
  title: string;
  tasks: KanbanBoardTask[];
};

export type KanbanBoardTask = {
  id: number;
  name: string;
  description: string;
  completed: boolean;
  daysLeft: number;
  attachment?: string;
  members: KanbanBoardTaskMember[];
};

export type KanbanBoardTaskMember = {
  id: number;
  name: string;
  avatar: string;
};

export type KanbanPageData = {
  kanbanBoards: KanbanBoard[];
};
