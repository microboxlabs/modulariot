"use client";

import {
  Button,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  Textarea,
} from "flowbite-react";
import {
  ErrorWithAlfrescoError,
  TaskConfirmModalProps,
  TaskFormConfig,
} from "./task-confirm-modal.types";
import {
  I18nRecord,
  PropsWithI18nDict,
} from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { taskNextAction } from "../../services/client-form.service";
import { useRouter } from "next/navigation";
import KanbanMove from "@/features/icons/kanban-move";
import { ErrorAlert } from "../error-alert";
import BrandedMultiSelect from "./branded-multi-select";
import dayjs from "dayjs";
import {
  DELIVERY_COORDINATOR_PROCESS_TASKS,
  PLANNING_COORDINATOR_PROCESS_TASKS,
  SHIPPING_COORDINATOR_PROCESS_TASKS_V2,
  TYPE_WFSHIP2_MISSION_CONTROL_TASK,
  TYPE_WFDELIVERY_CONFIRM_DELIVERY_TASK,
  TYPE_WFDELIVERY_RECEIVE_DELIVERY_TASK,
  OUTCOME_TO_CONFIRM_DELIVERY_V2,
  OUTCOME_TO_CLOSE_MONITORING_V2,
} from "../../services/form.service";
import { useState, useMemo, useEffect } from "react";
import {
  getSelectConfig,
  getTaskFormConfig,
} from "./task-confirm-modal.config";
import { useTaskModalState } from "./hooks/use-task-modal-state";
import { useCustomFormState } from "./hooks/use-custom-form-state";
import { prepareFormData } from "./task-confirm-modal.utils";
import { CustomFormField } from "./custom-form-field";
import { useLiveETA } from "@/features/common/providers/client-api.provider";
import {
  DeliveryProcessTask,
  PlanningProcessTask,
  ShippingCoordinatorProcessTaskV2,
} from "../../services/form.service.types";
import { ReviewedItemCard } from "../task-actions/review-items";
import { SidebarSection } from "../task-bento-form/components/side-data/multimedia-manager.tsx/viewer/sidebar/sidebar-section";
import { HiCheckCircle, HiDocumentText } from "react-icons/hi2";

export default function TaskConfirmModal({
  openModal,
  setOpenModal,
  outcome,
  outcomeLabel,
  taskId,
  taskType,
  dict,
  commentsFieldEnabled = false,
  extraData,
  approvedItems = [],
  rejectedItems = [],
  lang = "es",
}: PropsWithI18nDict<TaskConfirmModalProps>) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<ErrorWithAlfrescoError | undefined>();
  const router = useRouter();

  // Get task form configuration (includes both select config and custom form config)
  const taskFormConfig = useMemo<TaskFormConfig | null>(() => {
    return getTaskFormConfig(taskType, outcome);
  }, [taskType, outcome]);

  // For backward compatibility, also check old select config
  const selectConfig = useMemo(() => {
    return taskFormConfig?.selectConfig || getSelectConfig(taskType, outcome);
  }, [taskFormConfig, taskType, outcome]);

  // Suppress select + comments for secondary actions on delivery tasks:
  // "Confirmar Entrega" and "Confirmar Recepcion" other-options should have no motive inputs.
  const suppressMotiveInputs = useMemo(() => {
    if (!taskType) return false;
    const isConfirmDelivery = taskType === TYPE_WFDELIVERY_CONFIRM_DELIVERY_TASK;
    const isReceiveDelivery = taskType === TYPE_WFDELIVERY_RECEIVE_DELIVERY_TASK;
    if (!isConfirmDelivery && !isReceiveDelivery) return false;
    const primaryOutcome = isConfirmDelivery
      ? OUTCOME_TO_CONFIRM_DELIVERY_V2
      : OUTCOME_TO_CLOSE_MONITORING_V2;
    return outcome !== primaryOutcome;
  }, [taskType, outcome]);

  const hasReviewItems = approvedItems.length > 0 || rejectedItems.length > 0;

  // Use consolidated state management for select/reason fields
  const {
    selectedValues,
    setSelectedValues,
    comments,
    setComments,
    resetState,
  } = useTaskModalState(openModal, selectConfig);

  // Use custom form state management
  const { formValues, setFormValue, resetFormValues, isFieldVisible } =
    useCustomFormState(openModal, taskFormConfig?.customFormConfig);

  // Fetch calculated ETA for Monitor Trip task
  const isMonitorTripTask = taskType === TYPE_WFSHIP2_MISSION_CONTROL_TASK;
  const shouldFetchETA =
    isMonitorTripTask &&
    openModal &&
    !!extraData?.mintral_originDelegateCode &&
    !!extraData?.mintral_destinationDelegateCode;

  const { eta } = useLiveETA(
    shouldFetchETA,
    extraData?.mintral_originDelegateCode as string,
    extraData?.mintral_destinationDelegateCode as string,
    "calculated"
  );

  // Sync calculated ETA to manual field when switching to manual mode
  useEffect(() => {
    if (
      eta?.estimatedArrival &&
      formValues.mintral_etaMode === "manual" &&
      !formValues.mintral_estimatedArrivalDate
    ) {
      // Convert ISO string to datetime-local format (YYYY-MM-DDTHH:mm) for the input field
      // dayjs will handle timezone conversion properly
      const datetimeLocal = dayjs(eta.estimatedArrival).format(
        "YYYY-MM-DDTHH:mm"
      );
      setFormValue("mintral_estimatedArrivalDate", datetimeLocal);
    }
  }, [
    eta?.estimatedArrival,
    formValues.mintral_etaMode,
    formValues.mintral_estimatedArrivalDate,
    setFormValue,
  ]);

  async function handleConfirm(
    e?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>
  ) {
    e?.preventDefault();

    try {
      setIsProcessing(true);

      const formData = prepareFormData({
        taskId,
        outcome: outcome!,
        comments,
        taskType: taskType ?? "",
        selectedValues,
        selectConfig,
        extraData,
        customFormValues: formValues,
      });

      const response = await taskNextAction({}, formData);
      if (response.success) {
        setIsProcessing(false);
        setOpenModal(false);
        if (
          taskType &&
          SHIPPING_COORDINATOR_PROCESS_TASKS_V2.includes(
            taskType
              ?.replace("wfship2:", "")
              .replace("Task", "") as ShippingCoordinatorProcessTaskV2
          )
        ) {
          router.push(`/shipping`);
        } else if (
          taskType &&
          DELIVERY_COORDINATOR_PROCESS_TASKS.includes(
            taskType
              ?.replace("wfship2:", "")
              .replace("Task", "") as DeliveryProcessTask
          )
        ) {
          router.push(`/delivery`);
        } else if (
          taskType &&
          PLANNING_COORDINATOR_PROCESS_TASKS.includes(
            taskType
              ?.replace("wfship2:", "")
              .replace("Task", "") as PlanningProcessTask
          )
        ) {
          router.push(`/planning`);
        } else {
          router.push(`/shipping`);
        }
        return;
      }
      setIsProcessing(false);
    } catch (error) {
      setIsProcessing(false);
      setError(error as ErrorWithAlfrescoError);
      console.error(error);
    }
  }

  async function onClose() {
    setIsProcessing(false);
    setError(undefined);
    resetState(); // Reset select/reason form state when modal closes
    resetFormValues(); // Reset custom form state when modal closes
    setOpenModal(false);
  }

  return (
    <Modal
      dismissible
      show={openModal}
      onClose={onClose}
      size="4xl"
      theme={{
        content: {
          inner:
            "relative flex max-h-[90dvh] flex-col rounded-lg bg-white shadow dark:bg-gray-800 border border-gray-200 dark:border-gray-600",
        },
        body: { base: "flex-1 overflow-y-auto px-6 py-4" },
      }}
    >
      <form onSubmit={handleConfirm} className="flex flex-col flex-1 min-h-0">
        <ModalHeader className="border-none pb-0 shrink-0">
          <div className="flex flex-col items-start">
            <h2 className="text-base font-semibold">
              {(dict.modal as I18nRecord).title as string}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {(dict.modal as I18nRecord).subtitle as string}
            </p>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            {selectConfig && !suppressMotiveInputs && (
              <div className="flex flex-col gap-2">
                <Label>
                  {(dict.modal as I18nRecord).title2 as string}
                </Label>
                {selectConfig.multiSelect ? (
                  <BrandedMultiSelect
                    options={selectConfig.options}
                    selectedValues={selectedValues}
                    onSelectionChange={setSelectedValues}
                    triggerText={selectConfig.triggerText || "Seleccionar opciones"}
                    dict={dict}
                  />
                ) : (
                  <Select
                    value={selectedValues[0] || ""}
                    onChange={(e) => setSelectedValues([e.target.value])}
                  >
                    {selectConfig.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {(dict.modal as I18nRecord)[option.labelKey] as string}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            )}

            {/* Custom form fields */}
            {taskFormConfig?.customFormConfig && (
              <div className="flex flex-col gap-4">
                {taskFormConfig.customFormConfig.fields.map((field) => (
                  <CustomFormField
                    key={field.name}
                    field={field}
                    value={formValues[field.name] ?? field.defaultValue ?? ""}
                    onChange={(value) => setFormValue(field.name, value)}
                    dict={dict.modal as I18nRecord}
                    isVisible={isFieldVisible(field)}
                    allValues={{ ...extraData, ...formValues }}
                  />
                ))}
              </div>
            )}

            {commentsFieldEnabled && !suppressMotiveInputs && (
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="comments">{tr("modal.reason", dict)}:</Label>
                <Textarea
                  id="comments"
                  name="comments"
                  required
                  rows={8}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                />
              </div>
            )}

            {((!commentsFieldEnabled && !suppressMotiveInputs && !taskFormConfig?.customFormConfig) ||
              suppressMotiveInputs) &&
              !hasReviewItems && (
                <div className="flex items-center justify-center py-4">
                  <KanbanMove />
                </div>
              )}

            {/* Document review summary — collapsible, always at the bottom */}
            {hasReviewItems && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                {approvedItems.length > 0 && (
                  <SidebarSection
                    title={trDynamic(
                      approvedItems.length === 1
                        ? "outcome.continueModalApprovedCount_one"
                        : "outcome.continueModalApprovedCount",
                      dict,
                      { count: String(approvedItems.length) }
                    )}
                    icon={<HiCheckCircle className="w-3.5 h-3.5 text-green-500" />}
                    titleClassName="text-green-700 dark:text-green-300"
                    defaultExpanded
                  >
                    <ul className="flex flex-col gap-2 list-none ">
                      {approvedItems.map((item) => (
                        <ReviewedItemCard key={item.fileName} item={item} status="approved" locale={lang} />
                      ))}
                    </ul>
                  </SidebarSection>
                )}
                {rejectedItems.length > 0 && (
                  <SidebarSection
                    title={trDynamic(
                      rejectedItems.length === 1
                        ? "outcome.goBackModalRejectedCount_one"
                        : "outcome.goBackModalRejectedCount",
                      dict,
                      { count: String(rejectedItems.length) }
                    )}
                    icon={<HiDocumentText className="w-3.5 h-3.5 text-red-500" />}
                    titleClassName="text-red-700 dark:text-red-300"
                    defaultExpanded
                  >
                    <ul className="flex flex-col gap-2 list-none ">
                      {rejectedItems.map((item) => (
                        <ReviewedItemCard
                          key={item.fileName}
                          item={item}
                          status="rejected"
                          locale={lang}
                          noObservationsLabel={tr("outcome.goBackModalNoMotives", dict)}
                        />
                      ))}
                    </ul>
                  </SidebarSection>
                )}
              </div>
            )}

            {error && (
              <div className="space-y-2">
                <ErrorAlert error={error} />
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter className="border-none pt-0 shrink-0">
          <Button
            className="ml-auto"
            disabled={isProcessing}
            color="blue"
            type="submit"
          >
            {tr("modal.confirm", dict, {
              outcome: outcomeLabel ?? "Next",
            })}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
