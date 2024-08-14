import NotFound from "@/features/common/components/not-found/not-found";
import { TYPE_WFSHIP_TRANSPORT_VALIDATION_TASK } from "../../services/form.service";
import TransportValidationForm from "../transport-validation-form/transport-validation-form";
import { TaskFormProps } from "./task-form.types";

export function TaskForm({ task }: TaskFormProps) {
  switch (task.name) {
    case TYPE_WFSHIP_TRANSPORT_VALIDATION_TASK:
      return <TransportValidationForm task={task} />;

    default:
      return <NotFound />;
  }
}
