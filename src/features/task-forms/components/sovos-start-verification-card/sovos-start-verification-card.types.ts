import { StepperController } from "@/features/layout/components/stepper-navigation/stepper-navigation.types";
import { TaskFormProps } from "../task-form/task-form.types";

export type SovosVerificationCardProps = TaskFormProps & {
  pluginReady: boolean;
  stepperController: StepperController;
  isSovosVerification: boolean;
  success?: boolean;
  trParams?: Record<string, { [key: string]: string }>;
  validationError: string | null;
  setValidationError: (validationError: string | null) => void;
};
