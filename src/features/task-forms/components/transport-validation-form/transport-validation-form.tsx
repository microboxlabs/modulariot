"use client";

import StepperNavigation from "@/features/layout/components/stepper-navigation/stepper-navigation";
import { TaskFormProps } from "../task-form/task-form.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useSearchParams } from "next/navigation";
import DriverVerificationCard from "../driver-verification-card/driver-verification-card";
import DriverVerifiedCard from "../driver-verified-card/driver-verified-card";

const steps = ["step1", "step2", "step3"];

export default function TransportValidationForm({
  task,
  lang,
  msg,
}: TaskFormProps) {
  const searchParams = useSearchParams();
  const currentStep = searchParams.get("step") ?? steps[0];
  return (
    <div className="flex-1 flex flex-col items-center gap-6">
      <StepperNavigation
        msg={msg!.stepper as I18nRecord}
        currentStep={currentStep}
        routePaths={["step1", "step2", "step3"]}
      />
      {currentStep === "step1" && (
        <DriverVerificationCard lang={lang} msg={msg} task={task} />
      )}
      {currentStep === "step2" && (
        <DriverVerifiedCard lang={lang} msg={msg} task={task} />
      )}
      <pre>{JSON.stringify(task, null, 2)}</pre>
    </div>
  );
}
