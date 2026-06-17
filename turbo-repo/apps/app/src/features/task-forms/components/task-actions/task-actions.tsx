"use client";

import { HiCheck } from "react-icons/hi";

import SplitButton from "@/features/common/components/split-button/split-button";
import { TaskActionsProps } from "./task-actions.types";
import { useDocumentValidation } from "./use-document-validation";
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
import { ValidationIcon } from "../task-bento-form/components/driver/validation-icon";
import { useUserGroups } from "@/features/common/providers/client-api.provider";
import { useRouter } from "next/navigation";
import { taskNextAction } from "../../services/client-form.service";
import { tr } from "@/features/i18n/tr.service";
import { useBentoReview } from "../task-bento-form/bento-review-context";
import TaskConfirmModal from "../task-confirm-modal/task-confirm-modal";

export default function TaskActions({
  lang,
  taskId,
  taskType,
  dict,
  fluid = false,
  extraData,
  fullDict,
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
  const bpmPackage = typeof extraData?.bpm_package === "string" ? extraData.bpm_package : undefined;
  const {
    isValid: documentsValid,
    isLoading: documentsLoading,
  } = useDocumentValidation(taskType, bpmPackage);
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
          return (
            taskType !== TYPE_WFSHIP2_MISSION_CONTROL_TASK &&
            taskType !== TYPE_WFSHIP2_CONFIRM_ARRIVAL_TASK
          );
        case OUTCOME_CONFIRM_ARRIVAL_V2:
          return taskType !== TYPE_WFSHIP2_MONITOR_TRIP_TASK;
        case OUTCOME_CLOSE_MONITORING_V2:
          return taskType !== TYPE_WFSHIP2_CONFIRM_ARRIVAL_TASK;
        case OUTCOME_TO_CLOSE_MONITORING_V2:
          return taskType !== TYPE_WFSHIP2_CLOSE_MONITORING_TASK && taskType !== TYPE_WFDELIVERY_RECEIVE_DELIVERY_TASK;
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
  const showDocumentWarning = !documentsValid && !documentsLoading;

  const { state: reviewState } = useBentoReview();
  // pending > 0 → disable everything; rejected > 0 (no pending) → disable only continue
  const reviewBlocksAll = reviewState.pending > 0;
  const reviewBlocksContinue = reviewState.pending === 0 && reviewState.rejected > 0;

  const makeTooltip = (reasons: string[]) => reasons.length === 0 ? undefined : (
    <ul className="flex flex-col gap-1 text-xs">
      {reasons.map((r) => (
        <li key={r} className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="shrink-0"><ValidationIcon status="error" isLoading={false} size="sm" /></span>
          {r}
        </li>
      ))}
    </ul>
  );

  const sharedReasons: string[] = [];
  if (showDocumentWarning) sharedReasons.push(tr("outcome.disabledMissingDocs", dict));
  if (reviewBlocksAll) sharedReasons.push(tr("outcome.disabledPendingReview", dict));

  const moreOptionsTooltip = makeTooltip(sharedReasons);
  const continueTooltip = makeTooltip([
    ...sharedReasons,
    ...(!reviewBlocksAll && reviewBlocksContinue ? [tr("outcome.disabledRejectedDocs", dict)] : []),
  ]);

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

  const splitBtn = (
    <SplitButton
      size="md"
      secondaryLabel={tr("outcome.moreOptions", dict)}
      disabled={showDocumentWarning || reviewBlocksAll}
      primaryDisabled={reviewBlocksContinue}
      tooltip={moreOptionsTooltip}
      primaryTooltip={continueTooltip}
      primary={{
        id: "continue",
        label: (dict.outcome as I18nRecord).continue as string,
        icon: <HiCheck className="w-5 h-5" />,
        onClick: () =>
          handleSelection(
            transitionId,
            (dict.outcome as I18nRecord)[transitionId] as string
          ),
      }}
      secondaryActions={otherOptions.map(({ id, label, icon: Icon }) => ({
        id,
        label,
        icon: <Icon />,
        onClick: () => {
          handleSelection(id, label);
        },
      }))}
    />
  );

  return (
    <div className="flex flex-col-reverse lg:flex-row w-full gap-2 items-center">
      <GroupAllowed
        notAllowedTo={["GROUP_MINTRAL_REVISOR"]}
        userGroups={userGroups}
      >
        {splitBtn}

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
          approvedItems={reviewState.approvedItems}
          rejectedItems={reviewState.rejectedItems}
          lang={lang}
        />
      </GroupAllowed>
    </div>
  );
}
