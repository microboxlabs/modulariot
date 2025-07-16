"use client";
import { Button } from "flowbite-react";
import {
  HiOutlineArrowLeft,
  HiTrash,
  HiOutlineArrowRight,
  HiCheck,
  HiOutlineHand,
} from "react-icons/hi";
import { TaskActionsProps } from "./task-actions.types";
import TaskActionButton from "../task-action-button/task-action-button";
import {
  OUTCOME_CONFIRM_ARRIVAL_TO_DESTINATION,
  OUTCOME_CONFIRM_DELIVERY,
  OUTCOME_CONFIRM_DEPARTURE_TO_DESTINATION,
  OUTCOME_MONITORING_FINALIZATION,
  OUTCOME_NORMAL_INITIATION,
  OUTCOME_CONFIRM_MONITORING_FINALIZATION,
  OUTCOME_REDIRECT_TO_MISSION_CONTROL,
  TYPE_WFSHIP_CONFIRM_DELIVERY,
  TYPE_WFSHIP_CONFIRM_TRIP_DESTINATION_ARRIVAL,
  TYPE_WFSHIP_CONFIRM_TRIP_DESTINATION_DEPARTURE,
  TYPE_WFSHIP_MONITORING_IN_COURSE_TRIP,
  TYPE_WFSHIP_CONFIRM_MONITORING_FINALIZATION,
  TYPE_WFSHIP_OVERLORD_TRIP_INIT_TASK,
  OUTCOME_OVERLORD_AUTHORIZED_WITHOUT_GPS,
  OUTCOME_OVERLORD_CANCELED,
  OUTCOME_OVERLORD_ANULLED,
  OUTCOME_OVERLORD_AUTHORIZED_WITH_REPAIRS,
  TYPE_WFSHIP_TRANSPORT_VALIDATION_TASK,
  OUTCOME_OVERLORD_REQUIRED,
} from "../../services/form.service";
import TaskConfirmModal from "../task-confirm-modal/task-confirm-modal";
import {
  I18nRecord,
  PropsWithI18nDict,
} from "@/features/i18n/i18n.service.types";
import { useEffect, useState } from "react";
import {
  TaskNextActionState,
  TaskOutcome,
} from "../../services/form.service.types";
import OtherOptions from "./other-options";
import CanceledAnnulledOptions from "./canceled-annulled-options";
import CanceledAnnulledEndOptions from "./canceled-annulled-end-options";
import CanceledAnnulledAndOptions from "./canceled-annulled-and-options";
import { GroupAllowed } from "@/features/common/components/group-allowed/group-allowed";
import { useUserGroups } from "@/features/common/providers/client-api.provider";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { taskNextAction } from "../../services/client-form.service";

export default function TaskActions({
  lang,
  taskId,
  taskType,
  dict,
  fluid = false,
  extraData,
  enableActions = true,
}: PropsWithI18nDict<TaskActionsProps>) {
  const [openModal, setOpenModal] = useState(false);
  const [outcome, setOutcome] = useState<TaskOutcome | undefined>();
  const [outcomeLabel, setOutcomeLabel] = useState<string | undefined>();
  const { data: userGroups } = useUserGroups();
  const [isLoading, setIsLoading] = useState(false);
  const [state, formAction] = useFormState<TaskNextActionState, FormData>(
    taskNextAction,
    {},
  );
  const router = useRouter();
  useEffect(() => {
    if (state?.success) {
      router.replace(`/${lang}/shipping`);
    }
    if (state?.error) {
      setIsLoading(false);
    }
  }, [state]);

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

  const formActionWrapper = async (formData: FormData) => {
    setIsLoading(true);
    setTimeout(() => {
      formAction(formData);
    }, 100);
  };

  console.log(dict);

  switch (taskType) {
    case "wfship:missionControlTripInitTask":
      return (
        <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
          <GroupAllowed
            notAllowedTo={["GROUP_MINTRAL_REVISOR"]}
            userGroups={userGroups}
          >
            <Button.Group className="w-full">
              <OtherOptions
                dict={
                  (dict.pages as I18nRecord)
                    .transportValidationForm as I18nRecord
                }
                handleSelection={handleSelection}
              />
              <TaskActionButton
                fluid={fluid}
                label={
                  (
                    (
                      (dict.pages as I18nRecord)
                        .transportValidationForm as I18nRecord
                    ).outcome as I18nRecord
                  ).continue as string
                }
                taskId={taskId}
                transitionId={OUTCOME_NORMAL_INITIATION}
                onClick={() =>
                  handleSelection(
                    OUTCOME_NORMAL_INITIATION,
                    (
                      (
                        (dict.pages as I18nRecord)
                          .transportValidationForm as I18nRecord
                      ).outcome as I18nRecord
                    ).normalInitiation as string,
                  )
                }
              />
            </Button.Group>
            <TaskConfirmModal
              commentsFieldEnabled={isCommentsFieldEnabled(outcome!)}
              dict={
                (dict.pages as I18nRecord).transportValidationForm as I18nRecord
              }
              taskId={taskId}
              taskType={taskType}
              outcome={outcome!}
              outcomeLabel={outcomeLabel!}
              openModal={openModal}
              setOpenModal={setOpenModal}
              extraData={extraData}
            />
          </GroupAllowed>
        </div>
      );
    case TYPE_WFSHIP_OVERLORD_TRIP_INIT_TASK:
      return (
        <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
          <GroupAllowed
            notAllowedTo={["GROUP_MINTRAL_REVISOR"]}
            userGroups={userGroups}
          >
            <Button.Group className="w-full">
              <CanceledAnnulledAndOptions
                dict={
                  (dict.pages as I18nRecord)
                    .transportValidationForm as I18nRecord
                }
                handleSelection={handleSelection}
                otherOptions={[
                  {
                    id: OUTCOME_REDIRECT_TO_MISSION_CONTROL,
                    label: (
                      (
                        (dict.pages as I18nRecord)
                          .transportValidationForm as I18nRecord
                      ).outcome as I18nRecord
                    ).redirectToMissionControl as string,
                    icon: HiOutlineArrowRight,
                  },
                  {
                    id: OUTCOME_OVERLORD_AUTHORIZED_WITHOUT_GPS, //OUTCOME_OVERLORD_AUTHORIZED_WITH_REPAIRS,
                    label: (
                      (
                        (dict.pages as I18nRecord)
                          .transportValidationForm as I18nRecord
                      ).outcome as I18nRecord
                    ).authorizedWithoutGPS as string, //.authorizedWithRepairs as string,
                    icon: HiCheck,
                  },
                  {
                    id: OUTCOME_OVERLORD_CANCELED,
                    label: (
                      (
                        (dict.pages as I18nRecord)
                          .transportValidationForm as I18nRecord
                      ).outcome as I18nRecord
                    ).canceled as string,
                    icon: HiOutlineArrowLeft,
                  },
                  {
                    id: OUTCOME_OVERLORD_ANULLED,
                    label: (
                      (
                        (dict.pages as I18nRecord)
                          .transportValidationForm as I18nRecord
                      ).outcome as I18nRecord
                    ).annulled as string,
                    icon: HiTrash,
                  },
                ]}
              />
              <TaskActionButton
                fluid={fluid}
                label={
                  (
                    (
                      (dict.pages as I18nRecord)
                        .transportValidationForm as I18nRecord
                    ).outcome as I18nRecord
                  ).continue as string
                }
                taskId={taskId}
                transitionId={OUTCOME_OVERLORD_AUTHORIZED_WITH_REPAIRS}
                onClick={() =>
                  handleSelection(
                    OUTCOME_OVERLORD_AUTHORIZED_WITH_REPAIRS,
                    (
                      (
                        (dict.pages as I18nRecord)
                          .transportValidationForm as I18nRecord
                      ).outcome as I18nRecord
                    ).authorizedWithRepairs as string,
                  )
                }
              />
            </Button.Group>
            <TaskConfirmModal
              commentsFieldEnabled={isCommentsFieldEnabled(outcome!)}
              dict={
                (dict.pages as I18nRecord).transportValidationForm as I18nRecord
              }
              taskId={taskId}
              outcome={outcome!}
              outcomeLabel={outcomeLabel!}
              openModal={openModal}
              setOpenModal={setOpenModal}
            />
          </GroupAllowed>
        </div>
      );

    case TYPE_WFSHIP_MONITORING_IN_COURSE_TRIP:
      return (
        <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
          <GroupAllowed
            notAllowedTo={["GROUP_MINTRAL_REVISOR"]}
            userGroups={userGroups}
          >
            <Button.Group className="w-full">
              <CanceledAnnulledOptions
                dict={
                  (dict.pages as I18nRecord)
                    .transportValidationForm as I18nRecord
                }
                handleSelection={handleSelection}
              />
              <TaskActionButton
                fluid={fluid}
                label={
                  (
                    (
                      (dict.pages as I18nRecord)
                        .transportValidationForm as I18nRecord
                    ).outcome as I18nRecord
                  ).continue as string
                }
                taskId={taskId}
                transitionId={OUTCOME_CONFIRM_ARRIVAL_TO_DESTINATION}
                onClick={() =>
                  handleSelection(
                    OUTCOME_CONFIRM_ARRIVAL_TO_DESTINATION,
                    (
                      (
                        (dict.pages as I18nRecord)
                          .transportValidationForm as I18nRecord
                      ).outcome as I18nRecord
                    ).confirmTripDestinationArrival as string,
                  )
                }
              />
            </Button.Group>

            <TaskConfirmModal
              commentsFieldEnabled={isCommentsFieldEnabled(outcome!)}
              dict={
                (dict.pages as I18nRecord).transportValidationForm as I18nRecord
              }
              taskId={taskId}
              outcome={outcome!}
              outcomeLabel={outcomeLabel!}
              openModal={openModal}
              setOpenModal={setOpenModal}
            />
          </GroupAllowed>
        </div>
      );

    case TYPE_WFSHIP_CONFIRM_TRIP_DESTINATION_ARRIVAL:
      return (
        <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
          <GroupAllowed
            notAllowedTo={["GROUP_MINTRAL_REVISOR"]}
            userGroups={userGroups}
          >
            <Button.Group className="w-full">
              <CanceledAnnulledEndOptions
                dict={
                  (dict.pages as I18nRecord)
                    .transportValidationForm as I18nRecord
                }
                handleSelection={handleSelection}
              />
              <TaskActionButton
                fluid={fluid}
                label={
                  (
                    (
                      (dict.pages as I18nRecord)
                        .transportValidationForm as I18nRecord
                    ).outcome as I18nRecord
                  ).continue as string
                }
                taskId={taskId}
                transitionId={OUTCOME_CONFIRM_DELIVERY}
                onClick={() =>
                  handleSelection(
                    OUTCOME_CONFIRM_DELIVERY,
                    (
                      (
                        (dict.pages as I18nRecord)
                          .transportValidationForm as I18nRecord
                      ).outcome as I18nRecord
                    ).confirmDelivery as string,
                  )
                }
              />
            </Button.Group>

            <TaskConfirmModal
              commentsFieldEnabled={isCommentsFieldEnabled(outcome!)}
              dict={
                (dict.pages as I18nRecord).transportValidationForm as I18nRecord
              }
              taskId={taskId}
              outcome={outcome!}
              outcomeLabel={outcomeLabel!}
              openModal={openModal}
              setOpenModal={setOpenModal}
            />
          </GroupAllowed>
        </div>
      );
    case TYPE_WFSHIP_CONFIRM_DELIVERY:
      return (
        <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
          <GroupAllowed
            notAllowedTo={["GROUP_MINTRAL_REVISOR"]}
            userGroups={userGroups}
          >
            <Button.Group className="w-full">
              <CanceledAnnulledEndOptions
                dict={
                  (dict.pages as I18nRecord)
                    .transportValidationForm as I18nRecord
                }
                handleSelection={handleSelection}
              />
              <TaskActionButton
                fluid={fluid}
                label={(dict.outcome as I18nRecord).continue as string}
                taskId={taskId}
                transitionId={OUTCOME_CONFIRM_DEPARTURE_TO_DESTINATION}
                onClick={() =>
                  handleSelection(
                    OUTCOME_CONFIRM_DEPARTURE_TO_DESTINATION,
                    (dict.outcome as I18nRecord)
                      .confirmTripDestinationDeparture as string,
                  )
                }
              />
            </Button.Group>

            <TaskConfirmModal
              commentsFieldEnabled={isCommentsFieldEnabled(outcome!)}
              dict={
                (dict.pages as I18nRecord).transportValidationForm as I18nRecord
              }
              taskId={taskId}
              outcome={outcome!}
              outcomeLabel={outcomeLabel!}
              openModal={openModal}
              setOpenModal={setOpenModal}
            />
          </GroupAllowed>
        </div>
      );
    case TYPE_WFSHIP_CONFIRM_TRIP_DESTINATION_DEPARTURE:
      return (
        <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
          <GroupAllowed
            notAllowedTo={["GROUP_MINTRAL_REVISOR"]}
            userGroups={userGroups}
          >
            <Button.Group className="w-full">
              <CanceledAnnulledOptions
                dict={
                  (dict.pages as I18nRecord)
                    .transportValidationForm as I18nRecord
                }
                handleSelection={handleSelection}
              />
              <TaskActionButton
                fluid={fluid}
                label={
                  (
                    (
                      (dict.pages as I18nRecord)
                        .transportValidationForm as I18nRecord
                    ).outcome as I18nRecord
                  ).continue as string
                }
                taskId={taskId}
                transitionId={OUTCOME_CONFIRM_MONITORING_FINALIZATION}
                onClick={() =>
                  handleSelection(
                    OUTCOME_CONFIRM_MONITORING_FINALIZATION,
                    (
                      (
                        (dict.pages as I18nRecord)
                          .transportValidationForm as I18nRecord
                      ).outcome as I18nRecord
                    ).confirmMonitoringFinalization as string,
                  )
                }
              />
            </Button.Group>

            <TaskConfirmModal
              commentsFieldEnabled={isCommentsFieldEnabled(outcome!)}
              dict={
                (dict.pages as I18nRecord).transportValidationForm as I18nRecord
              }
              taskId={taskId}
              outcome={outcome!}
              outcomeLabel={outcomeLabel!}
              openModal={openModal}
              setOpenModal={setOpenModal}
            />
          </GroupAllowed>
        </div>
      );
    case TYPE_WFSHIP_CONFIRM_MONITORING_FINALIZATION:
      return (
        <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
          <GroupAllowed
            notAllowedTo={["GROUP_MINTRAL_REVISOR"]}
            userGroups={userGroups}
          >
            <Button.Group className="w-full">
              <CanceledAnnulledOptions
                dict={
                  (dict.pages as I18nRecord)
                    .transportValidationForm as I18nRecord
                }
                handleSelection={handleSelection}
              />
              <TaskActionButton
                fluid={fluid}
                label={
                  (
                    (
                      (dict.pages as I18nRecord)
                        .transportValidationForm as I18nRecord
                    ).outcome as I18nRecord
                  ).continue as string
                }
                taskId={taskId}
                transitionId={OUTCOME_MONITORING_FINALIZATION}
                onClick={() =>
                  handleSelection(
                    OUTCOME_MONITORING_FINALIZATION,
                    (
                      (
                        (dict.pages as I18nRecord)
                          .transportValidationForm as I18nRecord
                      ).outcome as I18nRecord
                    ).monitoringFinalization as string,
                  )
                }
              />
            </Button.Group>

            <TaskConfirmModal
              commentsFieldEnabled={isCommentsFieldEnabled(outcome!)}
              dict={
                (dict.pages as I18nRecord).transportValidationForm as I18nRecord
              }
              taskId={taskId}
              outcome={outcome!}
              outcomeLabel={outcomeLabel!}
              openModal={openModal}
              setOpenModal={setOpenModal}
            />
          </GroupAllowed>
        </div>
      );
    case TYPE_WFSHIP_TRANSPORT_VALIDATION_TASK:
      if (!enableActions) {
        return (
          <form action={formActionWrapper} className="flex flex-col gap-2">
            <GroupAllowed
              userGroups={userGroups}
              notAllowedTo={["GROUP_MINTRAL_REVISOR"]}
            >
              <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
                <Button.Group className="w-full">
                  <CanceledAnnulledAndOptions
                    dict={
                      (dict!.pages as I18nRecord)
                        .transportValidationForm as I18nRecord
                    }
                    handleSelection={handleSelection}
                    otherOptions={[
                      {
                        id: OUTCOME_OVERLORD_REQUIRED,
                        label:
                          ((
                            (
                              (dict!.pages as I18nRecord)
                                .transportValidationForm as I18nRecord
                            )?.outcome as I18nRecord
                          )?.requiresOverlord as string) ?? "",
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
                    {
                      (
                        (
                          (dict!.pages as I18nRecord)
                            .transportValidationForm as I18nRecord
                        ).buttons as I18nRecord
                      ).submit as string
                    }
                  </Button>
                </Button.Group>

                <TaskConfirmModal
                  commentsFieldEnabled={isCommentsFieldEnabled(outcome!)}
                  dict={
                    (dict!.pages as I18nRecord)
                      .transportValidationForm as I18nRecord
                  }
                  taskId={taskId}
                  outcome={outcome!}
                  outcomeLabel={outcomeLabel!}
                  openModal={openModal}
                  setOpenModal={setOpenModal}
                />
              </div>
            </GroupAllowed>
          </form>
        );
      } else {
        return (
          <form action={formActionWrapper} className="flex flex-col gap-2">
            <TaskActions
              taskId={taskId}
              taskType={taskType}
              lang={lang}
              dict={dict as I18nRecord}
              fluid={true}
              extraData={extraData}
            />
          </form>
        );
      }
    default:
      return null;
  }
}
