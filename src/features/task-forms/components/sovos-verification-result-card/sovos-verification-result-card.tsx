"use client";

import { Button, Card } from "flowbite-react";
import { SovosVerificationCardProps } from "../sovos-start-verification-card/sovos-start-verification-card.types";
import { useSession } from "next-auth/react";
import FingerprintIcon from "@/features/icons/figerprint";
import { TaskOutcome } from "../../services/form.service.types";
import {
  OUTCOME_CONFIRM_MONITORING_FINALIZATION,
  OUTCOME_RETURN_TO_MISSION_CONTROL,
} from "../../services/form.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { HiOutlineArrowLeft, HiOutlineArrowRight } from "react-icons/hi";
import TaskConfirmModal from "../task-confirm-modal/task-confirm-modal";
import { useState } from "react";
import { PersonEntry } from "@alfresco/js-api";
import BlurrableDropdown from "@/features/layout/components/blurrable-dropdown/blurrable-dropdown";
import router from "next/router";
export default function SovosVerificationResultCard({
  msg,
  success,
  stepperController,
  task,
  user,
  trParams,
  isSovosVerification,
  validationError,
  fingerprintReuse,
}: SovosVerificationCardProps) {
  const { data: session } = useSession();
  const [openModal, setOpenModal] = useState(false);
  const [outcome, setOutcome] = useState<TaskOutcome | undefined>(undefined);
  const [outcomeLabel, setOutcomeLabel] = useState<string | undefined>(
    undefined,
  );

  let title;
  let description;
  if (success) {
    title = msg?.successTitle as string;
    description = msg?.successDescription as string;
  } else {
    // imageUrl = errorImage;
    title = msg?.errorTitle as string;
    description = msg?.errorDescription as string;
  }
  const step = stepperController.currentStep();
  let personName = "";
  let personRut = "";
  if (step === "step2") {
    personName = `${msg!.driver as string} 1: ${task.mintral_driver1Name as string}`;
    personRut = `Rut: ${getRut() as string}`;
  }
  if (step === "step4") {
    personName = `${msg!.driver as string} 2: ${task.mintral_driver2Name as string}`;
    personRut = `Rut: ${getRut() as string}`;
  }
  if (step === "step6") {
    personName = `${trParams?.step6?.stepVal}: ${session?.user.name ?? ""}`;
    personRut = `Rut: ${getRut() as string}`;
  }

  function getRut(): string {
    const currentStep = stepperController.currentStep();
    if (currentStep === "step2") {
      return task.mintral_driver1Rut as string;
    }
    if (currentStep === "step4") {
      return task.mintral_driver2Rut as string;
    }
    const userObj = JSON.parse(user!) as PersonEntry;
    return userObj?.entry.jobTitle ?? "";
  }

  const handleSelection = (outcome: TaskOutcome, outcomeLabel: string) => {
    setOutcome(outcome);
    setOutcomeLabel(outcomeLabel);
    setOpenModal(true);
  };

  return (
    <Card>
      <div className="flex flex-col min-w-96 items-center justify-center w-96">
        <div className="h-40	w-40">
          {/* <Image src={imageUrl} alt="Not Found" className="object-cover" /> */}
          <FingerprintIcon state={success ? "success" : "failed"} />
        </div>
        <h5 className="text-xl font-medium tracking-tight text-gray-900 dark:text-white mt-9">
          {title}
        </h5>
        <div className="text-center text-gray-500 dark:text-gray-400 text-justified p-4">
          {description}
        </div>
        {validationError && (
          <div className="text-red-500 text-center text-sm" role="alert">
            {validationError}
          </div>
        )}
        <div className="text-center text-gray-400 dark:text-gray-500 text-justified p-4">
          {personName}
          <br />
          {personRut}
        </div>
        {!success && (
          <div className="flex flex-row gap-2 w-full">
            <div className="flex-1">
              <Button.Group className="w-full">
                <BlurrableDropdown
                  dict={msg as I18nRecord}
                  options={
                    isSovosVerification
                      ? [
                          {
                            id: 1,
                            label: (msg?.outcome as I18nRecord)
                              .returnToMissionControl as string,
                            icon: HiOutlineArrowLeft,
                            function: () => {
                              handleSelection(
                                OUTCOME_RETURN_TO_MISSION_CONTROL,
                                (msg?.outcome as I18nRecord)
                                  .returnToMissionControl as string,
                              );
                            },
                          },
                        ]
                      : [
                          {
                            id: 1,
                            label: (msg?.outcome as I18nRecord)
                              .confirmMonitoringFinalization as string,
                            icon: HiOutlineArrowRight,
                            function: () => {
                              handleSelection(
                                OUTCOME_CONFIRM_MONITORING_FINALIZATION,
                                (msg?.outcome as I18nRecord)
                                  .confirmMonitoringFinalization as string,
                              );
                            },
                          },
                        ]
                  }
                />
                <Button
                  color="blue"
                  theme={{ inner: { base: "px-5 py-3" } }}
                  className="w-full px-0 py-px"
                  onClick={() => stepperController.toStep("step1")}
                >
                  {msg?.tryAgain as string}
                </Button>
              </Button.Group>
            </div>
          </div>
        )}
        {success && !fingerprintReuse && (
          <Button
            color="blue"
            theme={{ inner: { base: "px-5 py-3" } }}
            className="w-full px-0 py-px"
            onClick={() => stepperController.toNextStep()}
            isProcessing={stepperController.isLoading()}
          >
            {stepperController.hasNextStep()
              ? (msg?.continue as string)
              : (msg?.finish as string)}
          </Button>
        )}
        {success && fingerprintReuse && (
          <Button
            color="blue"
            theme={{ inner: { base: "px-5 py-3" } }}
            className="w-full px-0 py-px"
            onClick={() => {
              //go to /shipping
              router.push("/shipping");
            }}
          >
            {msg?.continue as string}
          </Button>
        )}
      </div>
      {openModal && (
        <TaskConfirmModal
          commentsFieldEnabled={true}
          dict={msg as I18nRecord}
          taskId={task.id}
          taskType={task.taskFormKey}
          outcome={outcome!}
          outcomeLabel={outcomeLabel!}
          openModal={openModal}
          setOpenModal={setOpenModal}
        />
      )}
    </Card>
  );
}
