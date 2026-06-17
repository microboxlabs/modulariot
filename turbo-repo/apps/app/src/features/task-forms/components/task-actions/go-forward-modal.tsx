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
import { HiExclamationCircle } from "react-icons/hi2";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { RejectedItem, ApprovedItem } from "../task-bento-form/bento-review-context";
import { useCustomFormState } from "../task-confirm-modal/hooks/use-custom-form-state";
import { useTaskModalState } from "../task-confirm-modal/hooks/use-task-modal-state";
import { CustomFormField } from "../task-confirm-modal/custom-form-field";
import BrandedMultiSelect from "../task-confirm-modal/branded-multi-select";
import { ETA_EDIT_FORM_CONFIG } from "../eta-edit-modal/eta-edit-modal.config";
import { useLiveETA } from "@/features/common/providers/client-api.provider";
import {
  taskNextAction,
  updateTaskProperties,
} from "@/features/task-forms/services/client-form.service";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import KanbanMove from "@/features/icons/kanban-move";
import {
  DELIVERY_COORDINATOR_PROCESS_TASKS,
  PLANNING_COORDINATOR_PROCESS_TASKS,
  SHIPPING_COORDINATOR_PROCESS_TASKS_V2,
} from "../../services/form.service";
import {
  getSelectConfig,
  getTaskFormConfig,
} from "../task-confirm-modal/task-confirm-modal.config";
import { prepareFormData } from "../task-confirm-modal/task-confirm-modal.utils";
import { ErrorAlert } from "../error-alert";
import { ReviewSection } from "./review-items";
import type {
  TaskOutcome,
  TaskOutcomeV2,
  TaskOutcomeDelivery,
  TaskOutcomePlanning,
  DeliveryProcessTask,
  PlanningProcessTask,
  ShippingCoordinatorProcessTaskV2,
} from "../../services/form.service.types";
import type { ErrorWithAlfrescoError } from "../task-confirm-modal/task-confirm-modal.types";

function buildEtaProperties(
  formValues: Record<string, unknown>,
  eta: { estimatedArrival?: string } | null | undefined
): Record<string, unknown> {
  const isManual = formValues.mintral_etaMode === "manual";
  const properties: Record<string, unknown> = { mintral_etaMode: formValues.mintral_etaMode };
  if (isManual) {
    if (formValues.mintral_estimatedArrivalDate) {
      const iso = dayjs(formValues.mintral_estimatedArrivalDate as string).toISOString();
      properties.mintral_estimatedArrivalDate = iso;
    }
    if (formValues.mintral_manualEtaReason) {
      properties.mintral_manualEtaReason = formValues.mintral_manualEtaReason;
    }
    if (formValues.mintral_manualEtaReason === "OTHER" && formValues.mintral_manualEtaReasonOther) {
      properties.mintral_manualEtaReasonOther = formValues.mintral_manualEtaReasonOther;
    }
  } else if (eta?.estimatedArrival) {
    properties.mintral_estimatedArrivalDate = eta.estimatedArrival;
  }
  return properties;
}

interface GoForwardModalProps {
  show: boolean;
  onClose: () => void;
  taskId: string;
  outcome: TaskOutcome | TaskOutcomeV2 | TaskOutcomeDelivery | TaskOutcomePlanning;
  outcomeLabel: string;
  taskType?: string;
  extraData?: Record<string, unknown>;
  lang: string;
  dict: I18nRecord;
  commentsFieldEnabled?: boolean;
  approvedItems?: ApprovedItem[];
  rejectedItems?: RejectedItem[];
  showEtaEdit?: boolean;
  originGeofence?: string;
  destinationGeofence?: string;
  etaModalDict?: I18nRecord;
}

export default function GoForwardModal({
  show,
  onClose,
  taskId,
  outcome,
  outcomeLabel,
  taskType,
  extraData,
  lang,
  dict,
  commentsFieldEnabled = false,
  approvedItems = [],
  rejectedItems = [],
  showEtaEdit = false,
  originGeofence,
  destinationGeofence,
  etaModalDict,
}: Readonly<GoForwardModalProps>) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<ErrorWithAlfrescoError | undefined>();
  const [etaSaveError, setEtaSaveError] = useState<string | null>(null);
  const router = useRouter();

  const taskFormConfig = useMemo(
    () => getTaskFormConfig(taskType, outcome as string),
    [taskType, outcome]
  );
  const selectConfig = useMemo(
    () => taskFormConfig?.selectConfig || getSelectConfig(taskType, outcome as string),
    [taskFormConfig, taskType, outcome]
  );

  // When showEtaEdit is true but no taskFormConfig provides a form, fall back to ETA_EDIT_FORM_CONFIG
  const effectiveFormConfig =
    taskFormConfig?.customFormConfig ?? (showEtaEdit ? ETA_EDIT_FORM_CONFIG : undefined);

  const { formValues, setFormValue, resetFormValues, isFieldVisible } = useCustomFormState(
    show,
    effectiveFormConfig
  );
  const { selectedValues, setSelectedValues, comments, setComments, resetState } =
    useTaskModalState(show, selectConfig);

  // Resolve geofences: explicit props first, then extraData
  const effectiveOrigin =
    originGeofence ?? (extraData?.mintral_originDelegateCode as string | undefined);
  const effectiveDestination =
    destinationGeofence ?? (extraData?.mintral_destinationDelegateCode as string | undefined);

  const shouldFetchETA =
    !!effectiveFormConfig && show && !!effectiveOrigin && !!effectiveDestination;

  const { eta } = useLiveETA(
    shouldFetchETA,
    effectiveOrigin ?? "",
    effectiveDestination ?? "",
    (formValues.mintral_etaMode as string) || "calculated"
  );

  useEffect(() => {
    if (
      eta?.estimatedArrival &&
      formValues.mintral_etaMode === "manual" &&
      !formValues.mintral_estimatedArrivalDate
    ) {
      setFormValue(
        "mintral_estimatedArrivalDate",
        dayjs(eta.estimatedArrival).format("YYYY-MM-DDTHH:mm")
      );
    }
  }, [
    eta?.estimatedArrival,
    formValues.mintral_etaMode,
    formValues.mintral_estimatedArrivalDate,
    setFormValue,
  ]);

  function handleClose() {
    setIsProcessing(false);
    setError(undefined);
    setEtaSaveError(null);
    resetState();
    resetFormValues();
    onClose();
  }

  async function handleConfirm(
    e?: React.SyntheticEvent<HTMLFormElement>
  ) {
    e?.preventDefault();
    setIsProcessing(true);
    setEtaSaveError(null);

    // ETA fields must be saved via updateTaskProperties, never sent in the transition payload.
    // This covers both showEtaEdit (no customFormConfig) and ETA_EDIT_FORM_CONFIG as customFormConfig.
    const isEtaForm = showEtaEdit || effectiveFormConfig === ETA_EDIT_FORM_CONFIG;
    if (isEtaForm) {
      const properties = buildEtaProperties(formValues, eta);
      try {
        await updateTaskProperties(taskId, properties);
      } catch (err) {
        console.error("[GoForward] ETA save failed", err);
        setEtaSaveError("No se pudo guardar la ETA. Intenta nuevamente.");
        setIsProcessing(false);
        return;
      }
    }

    try {
      const formData = prepareFormData({
        taskId,
        outcome,
        comments,
        taskType: taskType ?? "",
        selectedValues,
        selectConfig,
        extraData: extraData as Record<string, unknown>,
        customFormValues: isEtaForm ? undefined : formValues,
      });

      const response = await taskNextAction({}, formData);
      if (response.success) {
        setIsProcessing(false);
        handleClose();
        if (
          taskType &&
          SHIPPING_COORDINATOR_PROCESS_TASKS_V2.includes(
            taskType.replace("wfship2:", "").replace("Task", "") as ShippingCoordinatorProcessTaskV2
          )
        ) {
          router.push(`/${lang}/shipping`);
        } else if (
          taskType &&
          DELIVERY_COORDINATOR_PROCESS_TASKS.includes(
            taskType.replace("wfship2:", "").replace("Task", "") as DeliveryProcessTask
          )
        ) {
          router.push(`/${lang}/delivery`);
        } else if (
          taskType &&
          PLANNING_COORDINATOR_PROCESS_TASKS.includes(
            taskType.replace("wfship2:", "").replace("Task", "") as PlanningProcessTask
          )
        ) {
          router.push(`/${lang}/planning`);
        } else {
          router.push(`/${lang}/shipping`);
        }
        return;
      }
      setIsProcessing(false);
    } catch (err) {
      setIsProcessing(false);
      setError(err as ErrorWithAlfrescoError);
      console.error("[GoForward] unexpected error", err);
    }
  }

  const hasItems = approvedItems.length > 0 || rejectedItems.length > 0;
  const noFormContent = !effectiveFormConfig && !selectConfig && !commentsFieldEnabled;

  const approvedCountKey =
    approvedItems.length === 1
      ? "outcome.continueModalApprovedCount_one"
      : "outcome.continueModalApprovedCount";
  const rejectedCountKey =
    rejectedItems.length === 1
      ? "outcome.goBackModalRejectedCount_one"
      : "outcome.goBackModalRejectedCount";

  const allFormValues = {
    mintral_originDelegateCode: effectiveOrigin,
    mintral_destinationDelegateCode: effectiveDestination,
    ...extraData,
    ...formValues,
  };

  const formDict = etaModalDict ?? (dict.modal as I18nRecord | undefined) ?? dict;

  return (
    <Modal
      dismissible
      show={show}
      onClose={handleClose}
      size="xl"
      theme={{
        content: {
          base: "relative w-full p-4 md:h-auto",
          inner:
            "relative flex max-h-[90dvh] flex-col rounded-lg bg-white dark:bg-gray-800 dark:border dark:border-gray-600 shadow",
        },
        body: { base: "flex-1 overflow-auto px-5 pb-5" },
      }}
    >
      <form onSubmit={handleConfirm}>
        <ModalHeader className="border-none">
          <div className="flex flex-col items-start">
            <h2 className="text-base font-semibold">{outcomeLabel}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {(dict.modal as I18nRecord | undefined)?.subtitle as string | undefined ??
                tr("outcome.continueModalSubtitle", dict)}
            </p>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4 my-4">
            {/* ETA / custom form fields */}
            {effectiveFormConfig && (
              <div className="flex flex-col gap-3 p-4 border rounded-md border-gray-200 dark:border-gray-700">
                {effectiveFormConfig.fields.map((field) => (
                  <CustomFormField
                    key={field.name}
                    field={field}
                    value={formValues[field.name] ?? field.defaultValue ?? ""}
                    onChange={(value) => setFormValue(field.name, value)}
                    dict={formDict}
                    isVisible={isFieldVisible(field)}
                    allValues={allFormValues}
                  />
                ))}
              </div>
            )}

            {/* Select config (single or multi) */}
            {selectConfig && (
              <div className="flex flex-col gap-2">
                <Label>{(dict.modal as I18nRecord).title2 as string}</Label>
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

            {/* Review items */}
            {hasItems && (
              <div className="flex flex-col gap-4">
                <ReviewSection
                  items={approvedItems}
                  status="approved"
                  countLabel={trDynamic(approvedCountKey, dict, {
                    count: String(approvedItems.length),
                  })}
                  locale={lang}
                />
                <ReviewSection
                  items={rejectedItems}
                  status="rejected"
                  countLabel={trDynamic(rejectedCountKey, dict, {
                    count: String(rejectedItems.length),
                  })}
                  locale={lang}
                  noObservationsLabel={tr("outcome.goBackModalNoMotives", dict)}
                />
              </div>
            )}

            {/* Comments textarea */}
            {commentsFieldEnabled && (
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="forward-comments">{tr("modal.reason", dict)}:</Label>
                <Textarea
                  id="forward-comments"
                  name="comments"
                  required
                  rows={8}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                />
              </div>
            )}

            {/* KanbanMove icon when there's nothing else to show */}
            {noFormContent && !hasItems && (
              <div className="flex items-center justify-center mt-4">
                <KanbanMove />
              </div>
            )}

            {etaSaveError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3">
                <HiExclamationCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-300">{etaSaveError}</p>
              </div>
            )}
            {error && (
              <div className="mt-4 mb-4 space-y-2">
                <ErrorAlert error={error} />
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter className="border-none">
          <Button
            className="ml-auto mt-[-41px]"
            disabled={isProcessing}
            color="blue"
            type="submit"
          >
            {tr("modal.confirm", dict, { outcome: outcomeLabel ?? "Next" })}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
