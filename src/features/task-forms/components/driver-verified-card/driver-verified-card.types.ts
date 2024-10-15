import { GetEntityInfoResponse } from "@/features/common/providers/microboxlabs-api/microboxlabs-api.types";
import { TaskFormProps } from "../task-form/task-form.types";

export type DriverVerifiedCardProps = {
  entityInfo?: GetEntityInfoResponse;
} & TaskFormProps;
