"use client";

import { Button, Card, Dropdown, DropdownItem } from "flowbite-react";
import { SovosVerificationCardProps } from "../sovos-start-verification-card/sovos-start-verification-card.types";
import { useSession } from "next-auth/react";
import FingerprintIcon from "@/features/icons/figerprint";
import VerticalDotsIcon from "@/features/icons/vertical-dots";
import { TaskOutcome } from "../../services/form.service.types";
import { OUTCOME_RETURN_TO_MISSION_CONTROL } from "../../services/form.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { HiOutlineArrowLeft } from "react-icons/hi";
import TaskConfirmModal from "../task-confirm-modal/task-confirm-modal";
import { useState } from "react";

export default function SovosVerificationResultCard({
  msg,
  success,
  stepperController,
  task,
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
  if (step === "step2") {
    personName = `${msg!.driver as string} 1: ${task.properties.mintral_driver1Name as string}`;
  }
  if (step === "step4") {
    personName = `${msg!.driver as string} 2: ${task.properties.mintral_driver2Name as string}`;
  }
  if (step === "step6") {
    personName = `${msg!.validator as string}: ${session?.user.name ?? ""}`;
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
        <div className="text-center text-gray-500 text-justified p-4">
          {description}
        </div>
        <div className="text-center text-gray-400 text-justified p-4">
          {personName}
        </div>
        {!success && (
          <div className="flex flex-row gap-2 w-full">
            <div className="flex-1">
              <Button
                color="blue"
                theme={{ inner: { base: "px-5 py-3" } }}
                className="w-full px-0 py-px"
                onClick={() => stepperController.toStep("step1")}
              >
                {msg?.tryAgain as string}
              </Button>
            </div>
            <Dropdown
              label={<VerticalDotsIcon />}
              arrowIcon={false}
              className="flex gap-1"
              inline
              theme={{
                inlineWrapper:
                  "cursor-pointer justify-center rounded px-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white",
              }}
            >
              <DropdownItem
                className="flex gap-1"
                onClick={() => {
                  handleSelection(
                    OUTCOME_RETURN_TO_MISSION_CONTROL,
                    (msg?.outcome as I18nRecord)
                      .returnToMissionControl as string,
                  );
                }}
              >
                <HiOutlineArrowLeft />
                {(msg?.outcome as I18nRecord).returnToMissionControl as string}
              </DropdownItem>
            </Dropdown>
          </div>
        )}
        {success && (
          <Button
            color="blue"
            theme={{ inner: { base: "px-5 py-3" } }}
            className="w-full px-0 py-px"
            onClick={() => stepperController.toNextStep()}
          >
            {stepperController.hasNextStep()
              ? (msg?.continue as string)
              : (msg?.finish as string)}
          </Button>
        )}
      </div>
      {openModal && (
        <TaskConfirmModal
          commentsFieldEnabled={true}
          dict={msg as I18nRecord}
          taskId={task.id}
          outcome={outcome!}
          outcomeLabel={outcomeLabel!}
          openModal={openModal}
          setOpenModal={setOpenModal}
        />
      )}
    </Card>
  );
}
