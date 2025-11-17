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
import { tr } from "@/features/i18n/tr.service";
import { taskNextAction } from "../../services/client-form.service";
import { useRouter } from "next/navigation";
import KanbanMove from "@/features/icons/kanban-move";
import { ErrorAlert } from "../error-alert";
import BrandedMultiSelect from "./branded-multi-select";
import {
  DELIVERY_COORDINATOR_PROCESS_TASKS,
  PLANNING_COORDINATOR_PROCESS_TASKS,
  SHIPPING_COORDINATOR_PROCESS_TASKS_V2,
  TYPE_WFSHIP2_MISSION_CONTROL_TASK,
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
      // Convert ISO string to datetime-local format (YYYY-MM-DDTHH:mm)
      const date = new Date(eta.estimatedArrival);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const datetimeLocal = `${year}-${month}-${day}T${hours}:${minutes}`;

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

      // Debug: Log what's being sent
      console.log("Form values being sent:", formValues);
      console.log("FormData entries:");
      for (const [key, value] of formData.entries()) {
        console.log(`  ${key}: ${value}`);
      }

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
    <Modal dismissible show={openModal} onClose={onClose} size="4xl">
      <form onSubmit={handleConfirm}>
        <ModalHeader className="border-none">
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
          <div className="flex flex-col">
            {selectConfig && (
              <>
                <Label className="mt-4">
                  {(dict.modal as I18nRecord).title2 as string}
                </Label>
                {selectConfig.multiSelect ? (
                  <BrandedMultiSelect
                    options={selectConfig.options}
                    selectedValues={selectedValues}
                    onSelectionChange={setSelectedValues}
                    triggerText={
                      selectConfig.triggerText || "Seleccionar opciones"
                    }
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
              </>
            )}

            {/* Custom form fields */}
            {taskFormConfig?.customFormConfig && (
              <div className="flex flex-col gap-4 mt-4">
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

            <div className="flex items-center justify-center mt-4">
              {!commentsFieldEnabled && !taskFormConfig?.customFormConfig && (
                <KanbanMove />
              )}
            </div>
            {commentsFieldEnabled && (
              <div className="flex-1 flex flex-col gap-y-2">
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
          </div>
          <div className="mt-4 px-6 space-y-2">
            {error && <ErrorAlert error={error} />}
          </div>
        </ModalBody>
        <ModalFooter className="border-none">
          <Button
            className="ml-auto mt-[-41px]"
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
