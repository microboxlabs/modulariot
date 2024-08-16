"use client";

import { TaskNextActionState } from "./form.service.types";

export async function taskNextAction(
  prevState: TaskNextActionState,
  formData: FormData,
): Promise<TaskNextActionState> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    // return { success: true, status: 200 };
    return {};
  } catch (error) {
    throw error;
  }
}
