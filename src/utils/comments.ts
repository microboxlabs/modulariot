import { ExtendedTaskResponse } from "@/features/task-forms/components/task-form/task-form.types";

export function getComments(task: ExtendedTaskResponse) {
  return (
    task.mintral_comments
      ? typeof task.mintral_comments === "string"
        ? task.mintral_comments
        : Array.isArray(task.mintral_comments)
          ? task.mintral_comments.join("\n")
          : task.mintral_comments
      : ""
  ) as string;
}

export function getOutsideComments(task: ExtendedTaskResponse) {
  return (
    task.mintral_driverObservations
      ? task.mintral_driverObservations
      : task.bpm_comment
        ? task.bpm_comment
        : ""
  ) as string;
}
