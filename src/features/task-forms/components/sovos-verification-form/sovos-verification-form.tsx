"use client";
import StepperNavigation from "@/features/layout/components/stepper-navigation/stepper-navigation";
import { TaskFormProps } from "../task-form/task-form.types";
import { useSearchParams } from "next/navigation";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import SovosStartVerificationCard from "../sovos-start-verification-card/sovos-start-verification-card";
// import { useSession } from "next-auth/react";

export default function SovosVerificationForm({
  msg,
  task,
  lang,
}: TaskFormProps) {
  // const { data: session } = useSession();

  let steps = ["step1", "step2"];
  if (task.properties.mintral_driver2Name) {
    steps.push("step3", "step4");
  }
  steps.push("step5", "step6");

  const searchParams = useSearchParams();
  const currentStep = searchParams.get("step") ?? steps[0];
  return (
    <div className="flex-1 flex flex-col items-center gap-6">
      <StepperNavigation
        msg={msg!.stepper as I18nRecord}
        currentStep={currentStep}
        routePaths={steps}
        trParams={{
          step2: {
            stepVal: `${msg!.driver as string} 1`,
          },
          step4: {
            stepVal: `${msg!.driver as string} 2`,
          },
          step6: {
            stepVal: `${msg!.validator as string}`,
          },
        }}
      />

      {currentStep === "step1" && (
        <SovosStartVerificationCard lang={lang} msg={msg} task={task} />
      )}
    </div>
  );
}
