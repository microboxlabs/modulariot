"use client";

import { Button, Card, Textarea, TextInput } from "flowbite-react";
import { HiOutlineHand } from "react-icons/hi";
import DriverUserIcon from "@/features/icons/driver-user";
import DriverContactInfo from "../driver-contact-info/driver-contact-info";
import { Driver } from "../driver-contact-info/driver-contact-info.type";
import DriverValidation from "../driver-validation-card/driver-validation-card";
import TripInformation from "../trip-information-card/trip-information";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useFormState } from "react-dom";
import { taskNextAction } from "../../services/client-form.service";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShippingCoordinatorProcessForms,
  TaskNextActionState,
  TaskOutcome,
} from "../../services/form.service.types";
import { DriverVerifiedCardProps } from "./driver-verified-card.types";
import TaskActions from "../task-actions/task-actions";
import CanceledAnnulledAndOptions from "../task-actions/canceled-annulled-and-options";
import TaskConfirmModal from "../task-confirm-modal/task-confirm-modal";
import {
  OUTCOME_MONITORING_FINALIZATION,
  OUTCOME_CONFIRM_MONITORING_FINALIZATION,
  OUTCOME_OVERLORD_AUTHORIZED_WITH_REPAIRS,
  OUTCOME_OVERLORD_REQUIRED,
  OUTCOME_REDIRECT_TO_MISSION_CONTROL,
  OUTCOME_CONFIRM_DELIVERY,
  OUTCOME_CONFIRM_DEPARTURE_TO_DESTINATION,
  OUTCOME_CONFIRM_ARRIVAL_TO_DESTINATION,
  OUTCOME_NORMAL_INITIATION,
} from "../../services/form.service";

export default function DriverVerifiedCard({
  lang,
  task,
  msg,
  dict,
  entityInfo,
  serviceValidation,
  enableActions = false,
}: DriverVerifiedCardProps) {
  const [state, formAction] = useFormState<TaskNextActionState, FormData>(
    taskNextAction,
    {},
  );
  console.log(dict);

  const [isLoading, setIsLoading] = useState(false);

  const [openModal, setOpenModal] = useState(false);
  const [outcome, setOutcome] = useState<TaskOutcome | undefined>();
  const [outcomeLabel, setOutcomeLabel] = useState<string | undefined>();

  const handleSelection = (outcome: TaskOutcome, outcomeLabel: string) => {
    setOutcome(outcome);
    setOutcomeLabel(outcomeLabel);
    setOpenModal(true);
  };

  const isCommentsFieldEnabled = (outcome: TaskOutcome) => {
    return (
      outcome !== OUTCOME_NORMAL_INITIATION &&
      outcome !== OUTCOME_CONFIRM_ARRIVAL_TO_DESTINATION &&
      outcome !== OUTCOME_CONFIRM_DEPARTURE_TO_DESTINATION &&
      outcome !== OUTCOME_CONFIRM_DELIVERY &&
      outcome !== OUTCOME_MONITORING_FINALIZATION &&
      outcome !== OUTCOME_CONFIRM_MONITORING_FINALIZATION &&
      outcome !== OUTCOME_REDIRECT_TO_MISSION_CONTROL &&
      outcome !== OUTCOME_OVERLORD_AUTHORIZED_WITH_REPAIRS
    );
  };

  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      router.replace(`/${lang}/shipping`);
    }
    if (state?.error) {
      setIsLoading(false);
    }
  }, [state]);

  const formActionWrapper = async (formData: FormData) => {
    setIsLoading(true);
    setTimeout(() => {
      formAction(formData);
    }, 100);
  };

  const driver1: Driver = {
    name: (task.mintral_driver1Name as string) ?? "-",
    email: (task.mintral_driver1Email as string) ?? "-",
    phone: (task.mintral_driver1Phone as string) ?? "-",
    rut: (task.mintral_driver1Rut as string) ?? "-",
    status: "verified",
    varName: "driver1",
  };
  let driver2: Driver | undefined;
  const driver2Name = task.mintral_driver2Name as string;
  if (driver2Name && driver2Name.trim() !== "") {
    driver2 = {
      name: (task.mintral_driver2Name as string) ?? "-",
      email: (task.mintral_driver2Email as string) ?? "-",
      phone: (task.mintral_driver2Phone as string) ?? "-",
      rut: (task.mintral_driver2Rut as string) ?? "-",
      status: "verified",
      varName: "driver2",
    };
  }

  return (
    <Card className="gap-6 w-fit items-center justify-center">
      <div className="flex items-center justify-center">
        <DriverUserIcon />
      </div>
      <div className="h-px bg-gray-300 w-full"></div>
      <DriverContactInfo msg={msg!} driver={driver1} />
      {driver2 && (
        <>
          <div className="h-px bg-gray-300 w-full"></div>
          <DriverContactInfo msg={msg!} driver={driver2} />
        </>
      )}
      <div className="h-px bg-gray-300 w-full"></div>
      <DriverValidation msg={msg!} driver1={driver1} driver2={driver2} />

      <div className="h-px bg-gray-300 w-full"></div>
      <TripInformation
        msg={msg}
        task={task}
        lang={lang}
        entityInfo={entityInfo}
        serviceValidation={serviceValidation}
      />

      <div className="h-px bg-gray-300 w-full"></div>
      <form action={formActionWrapper}>
        <h5 className="text-sm font-medium leading-loose text-gray-900 dark:text-white">
          {(msg!.cards as I18nRecord).comments as string}
        </h5>
        <div className="flex flex-col gap-6">
          <TextInput
            id="taskId"
            name="taskId"
            type="hidden"
            defaultValue={task.id}
          />
          <Textarea
            placeholder={
              (msg!.cards as I18nRecord).write_here_your_observations as string
            }
            defaultValue={task.mintral_driverObservations as string}
            disabled={true}
          />
          {!enableActions && (
            <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
              <Button.Group className="w-full">
                <CanceledAnnulledAndOptions
                  dict={dict ?? {}}
                  handleSelection={handleSelection}
                  otherOptions={[
                    {
                      id: OUTCOME_OVERLORD_REQUIRED,
                      label:
                        ((dict?.outcome as I18nRecord)
                          ?.requiresOverlord as string) ?? "",
                      icon: HiOutlineHand,
                    },
                  ]}
                />
                <Button
                  color="blue"
                  type="submit"
                  theme={{ inner: { base: "px-5 py-3" } }}
                  isProcessing={isLoading}
                  className="w-full px-0 py-px"
                >
                  {(msg!.buttons as I18nRecord).submit as string}
                </Button>
              </Button.Group>

              <TaskConfirmModal
                commentsFieldEnabled={isCommentsFieldEnabled(outcome!)}
                dict={dict ?? {}}
                taskId={task.id}
                outcome={outcome!}
                outcomeLabel={outcomeLabel!}
                openModal={openModal}
                setOpenModal={setOpenModal}
              />
            </div>
          )}
          {enableActions && (
            <TaskActions
              taskId={task.id}
              taskType={task.taskFormKey as ShippingCoordinatorProcessForms}
              lang={lang}
              dict={msg!}
              fluid={true}
            />
          )}
        </div>
      </form>
    </Card>
  );
}

{
  /*  */
}
