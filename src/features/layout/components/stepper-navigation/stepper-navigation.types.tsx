import { I18nRecord } from "@/features/i18n/i18n.service.types";

export type StepperNavigationProps = {
  routePaths: string[];
  msg: I18nRecord;
  currentStep: string;
  trParams?: Record<string, Record<string, string>>;
};
