"use client";

import StepperNavigation from "@/features/layout/components/stepper-navigation/stepper-navigation";
import { TaskFormProps } from "../task-form/task-form.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useSearchParams } from "next/navigation";
import DriverVerificationCard from "../driver-verification-card/driver-verification-card";
import DriverVerifiedCard from "../driver-verified-card/driver-verified-card";
import { Button } from "flowbite-react";
import Link from "next/link";
import { useGetEntityInfo } from "@/features/common/providers/client-api.provider";

const steps = ["step1", "step2", "step3"];

export default function TransportValidationForm({
  task,
  lang,
  msg,
}: TaskFormProps) {
  const searchParams = useSearchParams();
  const currentStep = searchParams.get("step") ?? steps[0];
  const { data: entityInfo, isLoading: _isLoadingEntityInfo } =
    useGetEntityInfo(task.properties.mintral_truckLicensePlate as string);
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
        <DriverVerifiedCard
          lang={lang}
          msg={msg}
          task={task}
          entityInfo={entityInfo}
        />
      )}
      {currentStep === "step3" && (
        <div className="flex flex-col p-8 gap-12 shadow-lg items-center justify-center text-xl w-96 h-80 bg-white">
          <h5 className="font-bold text-gray-900 dark:text-white">
            Proceso terminado
          </h5>
          <Button
            color="blue"
            as={Link}
            href={`/${lang}/shipping`}
            className="w-fit"
          >
            Volver al inicio
          </Button>
        </div>
      )}
    </div>
  );
}
