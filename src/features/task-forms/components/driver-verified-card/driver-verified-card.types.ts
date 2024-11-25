import { GetEntityInfoResponse } from "@/features/common/providers/microboxlabs-api/microboxlabs-api.types";
import { TaskFormProps } from "../task-form/task-form.types";
import { ServiceValidationResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";

export type DriverVerifiedCardProps = {
  entityInfo?: GetEntityInfoResponse;
  serviceValidation?: ServiceValidationResponse;
  enableActions?: boolean;
} & TaskFormProps;
