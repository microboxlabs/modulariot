"use client";

import { HiCheck } from "react-icons/hi";

import SplitButton from "@/features/common/components/split-button/split-button";
import GoBackModal from "./go-back-modal";
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
  SHIPPING_COORDINATOR_PROCESS_TASKS_V2,
  DELIVERY_COORDINATOR_PROCESS_TASKS,
  PLANNING_COORDINATOR_PROCESS_TASKS,
} from "../../services/form.service";
import TaskConfirmModal from "../task-confirm-modal/task-confirm-modal";
import {
  I18nRecord,
  PropsWithI18nDict,
} from "@/features/i18n/i18n.service.types";
import { useActionState, useCallback, useEffect, useState } from "react";
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

export default function TaskActions({
  lang,
  taskId,
  taskType,
  dict,
  fluid = false,
  extraData,
}: PropsWithI18nDict<TaskActionsProps>) {
  const [openModal, setOpenModal] = useState(false);
  const [openGoBackModal, setOpenGoBackModal] = useState(false);
  const [isGoBackSubmitting, setIsGoBackSubmitting] = useState(false);
  const [openContinueModal, setOpenContinueModal] = useState(false);
  const [isContinueSubmitting, setIsContinueSubmitting] = useState(false);
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

  const handleContinueConfirm = useCallback(async () => {
    if (!outcome) return;
    setIsContinueSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("taskId", taskId);
      formData.append("transitionId", outcome as string);
      if (taskType) formData.append("taskType", taskType);
      const response = await taskNextAction({}, formData);
      if (response?.success) {
        setOpenContinueModal(false);
        if (taskType && SHIPPING_COORDINATOR_PROCESS_TASKS_V2.includes(taskType.replace("wfship2:", "").replace("Task", "") as never)) {
          router.push(`/${lang}/shipping`);
        } else if (taskType && DELIVERY_COORDINATOR_PROCESS_TASKS.includes(taskType.replace("wfship2:", "").replace("Task", "") as never)) {
          router.push(`/${lang}/delivery`);
        } else if (taskType && PLANNING_COORDINATOR_PROCESS_TASKS.includes(taskType.replace("wfship2:", "").replace("Task", "") as never)) {
          router.push(`/${lang}/planning`);
        } else {
          router.push(`/${lang}/shipping`);
        }
      }
    } catch (err) {
      console.error("[Continue] unexpected error", err);
    } finally {
      setIsContinueSubmitting(false);
    }
  }, [outcome, taskId, taskType, lang, router]);

  const handleGoBackConfirm = useCallback(async () => {
    if (!outcome) return;
    setIsGoBackSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("taskId", taskId);
      formData.append("transitionId", outcome as string);
      if (taskType) formData.append("taskType", taskType);
      const response = await taskNextAction({}, formData);
      if (response?.success) {
        setOpenGoBackModal(false);
        if (taskType && SHIPPING_COORDINATOR_PROCESS_TASKS_V2.includes(taskType.replace("wfship2:", "").replace("Task", "") as never)) {
          router.push(`/${lang}/shipping`);
        } else if (taskType && DELIVERY_COORDINATOR_PROCESS_TASKS.includes(taskType.replace("wfship2:", "").replace("Task", "") as never)) {
          router.push(`/${lang}/delivery`);
        } else if (taskType && PLANNING_COORDINATOR_PROCESS_TASKS.includes(taskType.replace("wfship2:", "").replace("Task", "") as never)) {
          router.push(`/${lang}/planning`);
        } else {
          router.push(`/${lang}/shipping`);
        }
      } else {
        console.error("[GoBack] action failed", response);
      }
    } catch (err) {
      console.error("[GoBack] unexpected error", err);
    } finally {
      setIsGoBackSubmitting(false);
    }
  }, [outcome, taskId, taskType, lang, router]);

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
        onClick: () => {
          const label = (dict.outcome as I18nRecord)[transitionId] as string;
          setOutcome(transitionId);
          setOutcomeLabel(label);
          setOpenContinueModal(true);
        },
      }}
      secondaryActions={otherOptions.map(({ id, label, icon: Icon, isGoBack }) => ({
        id,
        label,
        icon: <Icon />,
        onClick: () => {
          setOutcome(id);
          setOutcomeLabel(label);
          if (isGoBack) {
            setOpenGoBackModal(true);
          } else {
            setOpenModal(true);
          }
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
        />

        {/* Continue review summary modal */}
        <GoBackModal
          show={openContinueModal}
          onClose={() => setOpenContinueModal(false)}
          onConfirm={handleContinueConfirm}
          isSubmitting={isContinueSubmitting}
          outcomeLabel={outcomeLabel ?? ""}
          approvedItems={reviewState.approvedItems}
          rejectedItems={reviewState.rejectedItems}
          subtitle={tr("outcome.continueModalSubtitle", dict)}
          lang={lang}
          dict={dict}
        />

        {/* Go-back review summary modal */}
        <GoBackModal
          show={openGoBackModal}
          onClose={() => setOpenGoBackModal(false)}
          onConfirm={handleGoBackConfirm}
          isSubmitting={isGoBackSubmitting}
          outcomeLabel={outcomeLabel ?? ""}
          rejectedItems={reviewState.rejectedItems}
          lang={lang}
          dict={dict}
        />
      </GroupAllowed>
    </div>
  );
}
