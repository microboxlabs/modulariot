"use client";

import StepperNavigation from "@/features/layout/components/stepper-navigation/stepper-navigation";
import { TaskFormProps } from "../task-form/task-form.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useSearchParams } from "next/navigation";
import DriverVerificationCard from "../driver-verification-card/driver-verification-card";
import { Button } from "flowbite-react";
import Link from "next/link";
import Bento from "../task-bento-form/bento";
// import {
//   useGetEntityInfo,
//   useGetServiceValidation,
// } from "@/features/common/providers/client-api.provider";

const steps = ["step1", "step2", "step3"];

export default function TransportValidationForm({
  task,
  lang,
  msg,
  userGroups,
}: TaskFormProps) {
  const searchParams = useSearchParams();
  const currentStep = searchParams.get("step") ?? steps[0];
  // const { data: entityInfo, isLoading: _isLoadingEntityInfo } =
  //   useGetEntityInfo(task.mintral_truckLicensePlate as string);

  // const { data: serviceValidation, isLoading: _isLoadingServiceValidation } =
  //   useGetServiceValidation(task.mintral_serviceCode as string);

  return (
    <div className="flex-1 h-full flex flex-col items-center">
      <StepperNavigation
        msg={
          ((msg!.pages as I18nRecord).transportValidationForm as I18nRecord)
            .stepper as I18nRecord
        }
        currentStep={currentStep}
        routePaths={["step1", "step2", "step3"]}
      />
      {currentStep === "step1" && (
        <DriverVerificationCard
          lang={lang}
          msg={(msg!.pages as I18nRecord).transportValidationForm as I18nRecord}
          task={task}
          userGroups={userGroups}
        />
      )}
      {
        currentStep === "step2" && (
          <Bento
            lang={lang}
            task={task as any}
            userGroups={userGroups}
            msg={msg as I18nRecord}
            enableActions={false}
          />
        )
        // this elements where taken off the Driver verified card (from step 2), because they where generating a error on the build
        // entityInfo={entityInfo}
        // serviceValidation={serviceValidation}
      }
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
