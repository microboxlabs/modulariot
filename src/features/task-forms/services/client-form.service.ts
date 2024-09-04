// "use client";

// import fetcher from "@/features/common/providers/fetcher";
import fetcher from "@/features/common/providers/fetcher";
import { TaskNextActionState } from "./form.service.types";

export async function taskNextAction(
  _prevState: TaskNextActionState,
  formData: FormData,
): Promise<TaskNextActionState> {
  const taskId = formData.get("taskId") as string;
  const transitionId = formData.get("transitionId");
  return fetcher("/app/api/task/end", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      taskId,
      transitionId,
    }),
  });
}

export async function taskSignDocument(
  _prevState: TaskNextActionState,
  formData: FormData,
): Promise<TaskNextActionState> {
  const taskId = formData.get("taskId") as string;
  const transitionId = formData.get("transitionId");
  const serviceCode = formData.get("serviceCode");

  return fetcher("/app/api/task/sign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      taskId,
      transitionId,
      serviceCode,
      signersEmails: (formData.get("signersEmails") as string).split(","),
      signerRuts: (formData.get("signerRuts") as string).split(","),
      auditNumbers: (formData.get("auditNumbers") as string).split(","),
    }),
  });
}
