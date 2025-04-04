export type EndTaskRequest = {
  taskId: string;
  transitionId?: string;
  comments?: string;
  reason?: string;
  reasonId?: string;
};
