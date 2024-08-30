/* eslint-disable @next/next/no-sync-scripts */
"use client";
import StepperNavigation from "@/features/layout/components/stepper-navigation/stepper-navigation";
import { TaskFormProps } from "../task-form/task-form.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import SovosStartVerificationCard from "../sovos-start-verification-card/sovos-start-verification-card";
import { useState } from "react";
import SovosVerificationResultCard from "../sovos-verification-result-card/sovos-verification-result-card";
import { StepperController } from "@/features/layout/components/stepper-navigation/stepper-navigation.types";
import { taskSignDocument } from "../../services/client-form.service";
import SovosDeps from "../sovos-deps/sovos-deps";
// import { useSession } from "next-auth/react";

export default function SovosVerificationForm({
  msg,
  task,
  lang,
}: TaskFormProps) {
  // const { data: session } = useSession();
  const [pluginReady, setPluginReady] = useState(false);
  const [stepper, setStepper] = useState({
    currentStep: "step1",
    isError: false,
  });

  const handleSignDocument = async () => {
    const formData = new FormData();
    formData.append("taskId", task.id);
    formData.append("transitionId", "next");
    formData.append(
      "serviceCode",
      task.properties.mintral_serviceCode as string,
    );
    const _result = await taskSignDocument({} as any, formData);
  };

  const stepperController: StepperController = {
    currentStep: () => {
      return stepper.currentStep;
    },
    toStep: (step: string, isError: boolean = false) => {
      return setStepper({
        ...stepper,
        currentStep: step,
        isError,
      });
    },
    toNextStep: (isError: boolean = false) => {
      if (stepper.currentStep === steps[steps.length - 1]) {
        handleSignDocument();
        return;
      }

      let nextStep = parseInt(stepper.currentStep.replace("step", ""));
      nextStep += 1;
      return setStepper({
        ...stepper,
        currentStep: `step${nextStep}`,
        isError,
      });
    },
    toPrevStep: (isError: boolean = false) => {
      let prevStep = parseInt(stepper.currentStep.replace("step", ""));
      prevStep -= 1;
      return setStepper({
        ...stepper,
        currentStep: `step${prevStep}`,
        isError,
      });
    },
    hasNextStep: () => {
      return (
        parseInt(stepper.currentStep.replace("step", "")) < steps.length - 1
      );
    },
  };

  let steps = ["step1", "step2"];
  if (task.properties.mintral_driver2Name) {
    steps.push("step3", "step4");
  }
  steps.push("step5", "step6");
  return (
    <div className="flex-1 flex flex-col items-center gap-6">
      <StepperNavigation
        msg={msg!.stepper as I18nRecord}
        currentStep={stepper.currentStep}
        isError={stepper.isError}
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
      <pre>{stepper.currentStep}</pre>
      {(stepper.currentStep === "step1" ||
        stepper.currentStep === "step3" ||
        stepper.currentStep === "step5") && (
        <SovosStartVerificationCard
          lang={lang}
          msg={msg}
          task={task}
          pluginReady={pluginReady}
          stepperController={stepperController}
        />
      )}
      {(stepper.currentStep === "step2" ||
        stepper.currentStep === "step4" ||
        stepper.currentStep === "step6") && (
        <SovosVerificationResultCard
          lang={lang}
          msg={msg}
          task={task}
          pluginReady={pluginReady}
          stepperController={stepperController}
          success={!stepper.isError}
        />
      )}
      <SovosDeps onReady={() => setPluginReady(true)} />
    </div>
  );
}
