"use client";
import { Button, TextInput } from "flowbite-react";
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
  TYPE_WFSHIP2_ASSIGN_DRIVER_TASK,
  TYPE_WFSHIP2_CLOSE_MONITORING_TASK,
  TYPE_WFSHIP2_PRESENT_DRIVER_TASK,
  TYPE_WFSHIP2_PREPARE_SERVICE_TASK,
  TYPE_WFSHIP2_MISSION_CONTROL_TASK,
  TYPE_WFSHIP2_MONITOR_TRIP_TASK,
  TYPE_WFSHIP2_CONFIRM_ARRIVAL_TASK,
  getTransitionIdV2,
  OUTCOME_OVERLORD_ANULLED_V2,
  OUTCOME_OVERLORD_CANCELED_V2,
  OUTCOME_TO_CLOSE_MONITORING_V2,
  OUTCOME_ASSIGN_DRIVER_V2,
  OUTCOME_PRESENT_DRIVER_V2,
  OUTCOME_PREPARE_SERVICE_V2,
  OUTCOME_MISSION_CONTROL_V2,
  OUTCOME_MONITOR_TRIP_V2,
  OUTCOME_CONFIRM_ARRIVAL_V2,
  OUTCOME_CLOSE_MONITORING_V2,
} from "../../services/form.service";
import TaskConfirmModal from "../task-confirm-modal/task-confirm-modal";
import {
  I18nRecord,
  PropsWithI18nDict,
} from "@/features/i18n/i18n.service.types";
import { useEffect, useState } from "react";
import {
  TaskNextActionState,
  ShippingCoordinatorProcessFormsV2,
  TaskOutcome,
  TaskOutcomeV2,
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
import GroupButtonOptions from "./group-button-options";

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
  const [outcome, setOutcome] = useState<
    TaskOutcome | TaskOutcomeV2 | undefined
  >();
  const [outcomeLabel, setOutcomeLabel] = useState<string | undefined>();
  const { data: userGroups } = useUserGroups();
  const [isLoading, setIsLoading] = useState(false);
  const [state, formAction] = useFormState<TaskNextActionState, FormData>(
    taskNextAction,
    {},
  );
  const router = useRouter();
  dict = dict["outcome"]
    ? dict
    : ((dict.pages as I18nRecord).transportValidationForm as I18nRecord);
  useEffect(() => {
    if (state?.success) {
      router.replace(`/${lang}/shipping`);
    }
    if (state?.error) {
      setIsLoading(false);
    }
  }, [state]);

  const handleSelection = (
    outcome: TaskOutcome | TaskOutcomeV2,
    outcomeLabel: string,
  ) => {
    setOutcome(outcome);
    setOutcomeLabel(outcomeLabel);
    setOpenModal(true);
  };

  const isCommentsFieldEnabled = (
    outcome: TaskOutcome | TaskOutcomeV2,
    taskType?: ShippingCoordinatorProcessFormsV2,
  ) => {
    if (taskType) {
      /* V2 Tasks */
      switch (outcome) {
        case OUTCOME_PRESENT_DRIVER_V2:
          return taskType !== TYPE_WFSHIP2_ASSIGN_DRIVER_TASK;
        case OUTCOME_PREPARE_SERVICE_V2:
          return taskType !== TYPE_WFSHIP2_PRESENT_DRIVER_TASK;
        case OUTCOME_MISSION_CONTROL_V2:
          return taskType !== TYPE_WFSHIP2_PREPARE_SERVICE_TASK;
        case OUTCOME_MONITOR_TRIP_V2:
          return taskType !== TYPE_WFSHIP2_MISSION_CONTROL_TASK;
        case OUTCOME_CONFIRM_ARRIVAL_V2:
          return taskType !== TYPE_WFSHIP2_MONITOR_TRIP_TASK;
        case OUTCOME_CLOSE_MONITORING_V2:
          return taskType !== TYPE_WFSHIP2_CONFIRM_ARRIVAL_TASK;
        case OUTCOME_TO_CLOSE_MONITORING_V2:
          return taskType !== TYPE_WFSHIP2_CLOSE_MONITORING_TASK;

        default:
          return true;
      }
    }

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

  switch (taskType) {
    case "wfship:missionControlTripInitTask":
      return (
        <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
          <GroupAllowed
            notAllowedTo={["GROUP_MINTRAL_REVISOR"]}
            userGroups={userGroups}
          >
            <Button.Group className="w-full">
              <OtherOptions dict={dict} handleSelection={handleSelection} />
              <TaskActionButton
                fluid={fluid}
                label={(dict.outcome as I18nRecord).continue as string}
                taskId={taskId}
                transitionId={OUTCOME_NORMAL_INITIATION}
                onClick={() =>
                  handleSelection(
                    OUTCOME_NORMAL_INITIATION,
                    (dict.outcome as I18nRecord).normalInitiation as string,
                  )
                }
              />
            </Button.Group>
            <TaskConfirmModal
              commentsFieldEnabled={isCommentsFieldEnabled(outcome!)}
              dict={dict}
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
                dict={dict}
                handleSelection={handleSelection}
                otherOptions={[
                  {
                    id: OUTCOME_REDIRECT_TO_MISSION_CONTROL,
                    label: (dict.outcome as I18nRecord)
                      .redirectToMissionControl as string,
                    icon: HiOutlineArrowRight,
                  },
                  {
                    id: OUTCOME_OVERLORD_AUTHORIZED_WITHOUT_GPS, //OUTCOME_OVERLORD_AUTHORIZED_WITH_REPAIRS,
                    label: (dict.outcome as I18nRecord)
                      .authorizedWithoutGPS as string, //.authorizedWithRepairs as string,
                    icon: HiCheck,
                  },
                  {
                    id: OUTCOME_OVERLORD_CANCELED,
                    label: (dict.outcome as I18nRecord).canceled as string,
                    icon: HiOutlineArrowLeft,
                  },
                  {
                    id: OUTCOME_OVERLORD_ANULLED,
                    label: (dict.outcome as I18nRecord).annulled as string,
                    icon: HiTrash,
                  },
                ]}
              />
              <TaskActionButton
                fluid={fluid}
                label={(dict.outcome as I18nRecord).continue as string}
                taskId={taskId}
                transitionId={OUTCOME_OVERLORD_AUTHORIZED_WITH_REPAIRS}
                onClick={() =>
                  handleSelection(
                    OUTCOME_OVERLORD_AUTHORIZED_WITH_REPAIRS,
                    (dict.outcome as I18nRecord)
                      .authorizedWithRepairs as string,
                  )
                }
              />
            </Button.Group>
            <TaskConfirmModal
              commentsFieldEnabled={isCommentsFieldEnabled(outcome!)}
              dict={dict}
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
                dict={dict}
                handleSelection={handleSelection}
              />
              <TaskActionButton
                fluid={fluid}
                label={(dict.outcome as I18nRecord).continue as string}
                taskId={taskId}
                transitionId={OUTCOME_CONFIRM_ARRIVAL_TO_DESTINATION}
                onClick={() =>
                  handleSelection(
                    OUTCOME_CONFIRM_ARRIVAL_TO_DESTINATION,
                    (dict.outcome as I18nRecord)
                      .confirmTripDestinationArrival as string,
                  )
                }
              />
            </Button.Group>

            <TaskConfirmModal
              commentsFieldEnabled={isCommentsFieldEnabled(outcome!)}
              dict={dict}
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
                dict={dict}
                handleSelection={handleSelection}
              />
              <TaskActionButton
                fluid={fluid}
                label={(dict.outcome as I18nRecord).continue as string}
                taskId={taskId}
                transitionId={OUTCOME_CONFIRM_DELIVERY}
                onClick={() =>
                  handleSelection(
                    OUTCOME_CONFIRM_DELIVERY,
                    (dict.outcome as I18nRecord).confirmDelivery as string,
                  )
                }
              />
            </Button.Group>

            <TaskConfirmModal
              commentsFieldEnabled={isCommentsFieldEnabled(outcome!)}
              dict={dict}
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
                dict={dict}
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
              dict={dict}
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
                dict={dict}
                handleSelection={handleSelection}
              />
              <TaskActionButton
                fluid={fluid}
                label={(dict.outcome as I18nRecord).continue as string}
                taskId={taskId}
                transitionId={OUTCOME_CONFIRM_MONITORING_FINALIZATION}
                onClick={() =>
                  handleSelection(
                    OUTCOME_CONFIRM_MONITORING_FINALIZATION,
                    (dict.outcome as I18nRecord)
                      .confirmMonitoringFinalization as string,
                  )
                }
              />
            </Button.Group>

            <TaskConfirmModal
              commentsFieldEnabled={isCommentsFieldEnabled(outcome!)}
              dict={dict}
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
                dict={dict}
                handleSelection={handleSelection}
              />
              <TaskActionButton
                fluid={fluid}
                label={(dict.outcome as I18nRecord).continue as string}
                taskId={taskId}
                transitionId={OUTCOME_MONITORING_FINALIZATION}
                onClick={() =>
                  handleSelection(
                    OUTCOME_MONITORING_FINALIZATION,
                    (dict.outcome as I18nRecord)
                      .monitoringFinalization as string,
                  )
                }
              />
            </Button.Group>

            <TaskConfirmModal
              commentsFieldEnabled={isCommentsFieldEnabled(outcome!)}
              dict={dict}
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
      return (
        <form action={formActionWrapper} className="flex flex-col">
          <TextInput
            id="taskId"
            name="taskId"
            type="hidden"
            defaultValue={taskId}
          />

          {!enableActions ? (
            <GroupAllowed
              userGroups={userGroups}
              notAllowedTo={["GROUP_MINTRAL_REVISOR"]}
            >
              <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
                <Button.Group className="w-full">
                  <CanceledAnnulledAndOptions
                    dict={dict}
                    handleSelection={handleSelection}
                    otherOptions={[
                      {
                        id: OUTCOME_OVERLORD_REQUIRED,
                        label: (dict.outcome as I18nRecord)
                          .requiresOverlord as string,
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
                    {(dict.buttons as I18nRecord).submit as string}
                  </Button>
                </Button.Group>

                <TaskConfirmModal
                  commentsFieldEnabled={isCommentsFieldEnabled(outcome!)}
                  dict={dict}
                  taskId={taskId}
                  outcome={outcome!}
                  outcomeLabel={outcomeLabel!}
                  openModal={openModal}
                  setOpenModal={setOpenModal}
                />
              </div>
            </GroupAllowed>
          ) : (
            <TaskActions
              taskId={taskId}
              taskType={taskType}
              lang={lang}
              dict={dict.shippingDetailsTaskForm as I18nRecord}
              fluid={true}
              extraData={extraData}
            />
          )}
        </form>
      );
    case TYPE_WFSHIP2_ASSIGN_DRIVER_TASK: /* V2 Tasks */
    case TYPE_WFSHIP2_PRESENT_DRIVER_TASK:
    case TYPE_WFSHIP2_PREPARE_SERVICE_TASK:
    case TYPE_WFSHIP2_MISSION_CONTROL_TASK:
    case TYPE_WFSHIP2_MONITOR_TRIP_TASK:
    case TYPE_WFSHIP2_CONFIRM_ARRIVAL_TASK:
    case TYPE_WFSHIP2_CLOSE_MONITORING_TASK: {
      const transitionId = getTransitionIdV2(
        taskType as ShippingCoordinatorProcessFormsV2,
        outcome as TaskOutcomeV2,
      );
      const otherOptions = [];
      if (taskType === TYPE_WFSHIP2_PRESENT_DRIVER_TASK) {
        const label =
          (dict?.outcome as I18nRecord) ??
          (((dict.pages as I18nRecord).transportValidationForm as I18nRecord)
            .outcome as I18nRecord);
        otherOptions.push(
          ...[
            {
              id: OUTCOME_ASSIGN_DRIVER_V2,
              label: label[OUTCOME_ASSIGN_DRIVER_V2] as string,
              icon: HiOutlineArrowLeft,
            },
          ],
        );
      } else if (taskType === TYPE_WFSHIP2_PREPARE_SERVICE_TASK) {
        otherOptions.push(
          ...[
            {
              id: OUTCOME_PRESENT_DRIVER_V2,
              label: (dict.outcome as I18nRecord)[
                OUTCOME_PRESENT_DRIVER_V2
              ] as string,
              icon: HiOutlineArrowLeft,
            },
          ],
        );
      } else if (taskType === TYPE_WFSHIP2_MISSION_CONTROL_TASK) {
        otherOptions.push(
          ...[
            {
              id: OUTCOME_ASSIGN_DRIVER_V2,
              label: (dict.outcome as I18nRecord)[
                OUTCOME_ASSIGN_DRIVER_V2
              ] as string,
              icon: HiOutlineArrowLeft,
            },
            {
              id: OUTCOME_PRESENT_DRIVER_V2,
              label: (dict.outcome as I18nRecord)[
                OUTCOME_PRESENT_DRIVER_V2
              ] as string,
              icon: HiOutlineArrowLeft,
            },
            {
              id: OUTCOME_PREPARE_SERVICE_V2,
              label: (dict.outcome as I18nRecord)[
                OUTCOME_PREPARE_SERVICE_V2
              ] as string,
              icon: HiOutlineArrowLeft,
            },
          ],
        );
      } else if (taskType === TYPE_WFSHIP2_MONITOR_TRIP_TASK) {
        otherOptions.push(
          ...[
            {
              id: OUTCOME_MISSION_CONTROL_V2,
              label: (dict.outcome as I18nRecord)[
                OUTCOME_MISSION_CONTROL_V2
              ] as string,
              icon: HiOutlineArrowLeft,
            },
          ],
        );
      } else if (
        taskType === TYPE_WFSHIP2_CLOSE_MONITORING_TASK ||
        taskType === TYPE_WFSHIP2_CONFIRM_ARRIVAL_TASK
      ) {
        otherOptions.push(
          ...[
            {
              id: OUTCOME_MONITOR_TRIP_V2,
              label: (dict.outcome as I18nRecord)[
                OUTCOME_MONITOR_TRIP_V2
              ] as string,
              icon: HiOutlineArrowLeft,
            },
          ],
        );
      }
      otherOptions.push(
        ...[
          {
            id: OUTCOME_OVERLORD_CANCELED_V2,
            label: (dict.outcome as I18nRecord).canceled as string,
            icon: HiOutlineArrowLeft,
          },
          {
            id: OUTCOME_OVERLORD_ANULLED_V2,
            label: (dict.outcome as I18nRecord).annulled as string,
            icon: HiTrash,
          },
        ],
      );

      return (
        <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
          <GroupAllowed
            notAllowedTo={["GROUP_MINTRAL_REVISOR"]}
            userGroups={userGroups}
          >
            <Button.Group className="w-full">
              <GroupButtonOptions
                dict={dict}
                handleSelection={handleSelection}
                otherOptions={otherOptions}
              />
              <TaskActionButton
                fluid={fluid}
                label={(dict.outcome as I18nRecord).continue as string}
                taskId={taskId}
                transitionId={transitionId}
                onClick={() =>
                  handleSelection(
                    transitionId,
                    (dict.outcome as I18nRecord)[transitionId] as string,
                  )
                }
              />
            </Button.Group>

            <TaskConfirmModal
              commentsFieldEnabled={isCommentsFieldEnabled(outcome!, taskType)}
              dict={dict}
              taskId={taskId}
              taskType={taskType}
              outcome={outcome!}
              outcomeLabel={outcomeLabel!}
              openModal={openModal}
              setOpenModal={setOpenModal}
            />
          </GroupAllowed>
        </div>
      );
    }
    default:
      return <div className="">{/* TODO: Add task actions*/}</div>;
  }
}
