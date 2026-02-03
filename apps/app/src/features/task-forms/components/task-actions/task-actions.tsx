"use client";
import { Button, ButtonGroup } from "flowbite-react";
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
  OUTCOME_OVERLORD_AUTHORIZED_WITH_REPAIRS,
  TYPE_WFSHIP2_ASSIGN_DRIVER_TASK,
  TYPE_WFSHIP2_CLOSE_MONITORING_TASK,
  TYPE_WFSHIP2_PRESENT_DRIVER_TASK,
  TYPE_WFSHIP2_PREPARE_SERVICE_TASK,
  TYPE_WFSHIP2_MISSION_CONTROL_TASK,
  TYPE_WFSHIP2_MONITOR_TRIP_TASK,
  TYPE_WFSHIP2_CONFIRM_ARRIVAL_TASK,
  getTransitionIdV2,
  OUTCOME_PRESENT_DRIVER_V2,
  OUTCOME_PREPARE_SERVICE_V2,
  OUTCOME_MISSION_CONTROL_V2,
  getSecondaryTransitionIdV2,
  OUTCOME_MONITOR_TRIP_V2,
  OUTCOME_CONFIRM_ARRIVAL_V2,
  OUTCOME_CLOSE_MONITORING_V2,
  OUTCOME_TO_CLOSE_MONITORING_V2,
  TYPE_WFDELIVERY_CONFIRM_DELIVERY_TASK,
  TYPE_WFDELIVERY_RECEIVE_DELIVERY_TASK,
  TYPE_WFDELIVERY_NOTIFY_TMS_ARRIVAL_TASK,
  OUTCOME_RECEIVE_DELIVERY_V2,
  OUTCOME_NOTIFY_TMS_ARRIVAL_V2,
  OUTCOME_NOTIFY_TMS_DELIVERY_V2,
  TYPE_WFPLANNING_CONSOLIDATE_LOAD_TASK,
  TYPE_WFPLANNING_SEPARATE_DOCUMENTS_TASK,
  TYPE_WFPLANNING_PLAN_SERVICE_TASK,
  OUTCOME_PLAN_SERVICE,
  OUTCOME_SEPARATE_DOCUMENTS,
  OUTCOME_ASSIGN_DRIVER_V2,
} from "../../services/form.service";
import TaskConfirmModal from "../task-confirm-modal/task-confirm-modal";
import {
  I18nRecord,
  PropsWithI18nDict,
} from "@/features/i18n/i18n.service.types";
import { useActionState, useEffect, useState } from "react";
import {
  TaskNextActionState,
  ShippingCoordinatorProcessFormsV2,
  TaskOutcome,
  TaskOutcomeDelivery,
  TaskOutcomeV2,
  DeliveryProcessForms,
  PlanningProcessForms,
  TaskOutcomePlanning,
} from "../../services/form.service.types";

import { GroupAllowed } from "@/features/common/components/group-allowed/group-allowed";
import { useUserGroups } from "@/features/common/providers/client-api.provider";
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
}: PropsWithI18nDict<TaskActionsProps>) {
  const [openModal, setOpenModal] = useState(false);
  const [outcome, setOutcome] = useState<
    | TaskOutcome
    | TaskOutcomeV2
    | TaskOutcomeDelivery
    | TaskOutcomePlanning
    | undefined
  >();
  const [outcomeLabel, setOutcomeLabel] = useState<string | undefined>();
  const { data: userGroups } = useUserGroups();
  const [state, _formAction] = useActionState<TaskNextActionState, FormData>(
    taskNextAction,
    {}
  );
  const router = useRouter();
  dict = dict["outcome"]
    ? dict
    : ((dict.pages as I18nRecord).transportValidationForm as I18nRecord);
  useEffect(() => {
    if (state?.success) {
      router.replace(`/${lang}/shipping`);
    }
  }, [state]);

  const handleSelection = (
    outcome:
      | TaskOutcome
      | TaskOutcomeV2
      | TaskOutcomeDelivery
      | TaskOutcomePlanning,
    outcomeLabel: string
  ) => {
    setOutcome(outcome);
    setOutcomeLabel(outcomeLabel);
    setOpenModal(true);
  };

  const isCommentsFieldEnabled = (
    outcome:
      | TaskOutcome
      | TaskOutcomeV2
      | TaskOutcomeDelivery
      | TaskOutcomePlanning,
    taskType?:
      | ShippingCoordinatorProcessFormsV2
      | DeliveryProcessForms
      | PlanningProcessForms
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
        case OUTCOME_RECEIVE_DELIVERY_V2:
          return taskType !== TYPE_WFDELIVERY_CONFIRM_DELIVERY_TASK;
        case OUTCOME_NOTIFY_TMS_ARRIVAL_V2:
          return taskType !== TYPE_WFDELIVERY_RECEIVE_DELIVERY_TASK;
        case OUTCOME_NOTIFY_TMS_DELIVERY_V2:
          return taskType !== TYPE_WFDELIVERY_NOTIFY_TMS_ARRIVAL_TASK;
        case OUTCOME_SEPARATE_DOCUMENTS:
          return taskType !== TYPE_WFPLANNING_CONSOLIDATE_LOAD_TASK;
        case OUTCOME_PLAN_SERVICE:
          return taskType !== TYPE_WFPLANNING_SEPARATE_DOCUMENTS_TASK;
        case OUTCOME_ASSIGN_DRIVER_V2:
          return taskType !== TYPE_WFPLANNING_PLAN_SERVICE_TASK;
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

  const transitionId = getTransitionIdV2(
    taskType as ShippingCoordinatorProcessFormsV2,
    outcome as TaskOutcomeV2
  );
  const otherOptions = getSecondaryTransitionIdV2(
    taskType as ShippingCoordinatorProcessFormsV2,
    dict
  );
  return (
    <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
      <GroupAllowed
        notAllowedTo={["GROUP_MINTRAL_REVISOR"]}
        userGroups={userGroups}
      >
        <ButtonGroup className="w-full">
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
                (dict.outcome as I18nRecord)[transitionId] as string
              )
            }
          />
        </ButtonGroup>

        <TaskConfirmModal
          commentsFieldEnabled={isCommentsFieldEnabled(outcome!, taskType)}
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
}
