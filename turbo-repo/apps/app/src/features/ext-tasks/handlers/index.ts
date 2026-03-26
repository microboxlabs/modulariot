import type { TaskExecutionResult } from "../ext-task.types";
import { acknowledgeHandler } from "./acknowledge.handler";

type TaskHandler = (
  payload: Record<string, unknown>,
) => Promise<TaskExecutionResult>;

const handlers: Record<string, TaskHandler> = {
  acknowledge: acknowledgeHandler,
};

export function getTaskHandler(taskType: string): TaskHandler {
  const handler = handlers[taskType];
  if (!handler) {
    throw new Error(`Unknown task type: ${taskType}`);
  }
  return handler;
}
