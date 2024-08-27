import { TaskFormProps } from "../task-form/task-form.types";

export type SovosStartVerificationCardProps = TaskFormProps & {
  pluginReady: boolean;
};