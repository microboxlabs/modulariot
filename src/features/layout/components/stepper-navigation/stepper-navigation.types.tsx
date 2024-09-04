import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { AutentiaParamsGet } from "@/features/sovos-fingerprint/services/autentia.types";

export type StepperNavigationProps = {
  routePaths: string[];
  msg: I18nRecord;
  currentStep: string;
  isError?: boolean;
  trParams?: Record<string, Record<string, string>>;
};

export type StepperController = {
  currentStep: () => string;
  toStep: (step: string, isError?: boolean) => void;
  toNextStep: (isError?: boolean, audit?: AutentiaParamsGet) => void;
  toPrevStep: (isError?: boolean) => void;
  hasNextStep: () => boolean;
};
