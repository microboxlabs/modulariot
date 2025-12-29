"use client";

import { useState, useCallback, useEffect, ReactNode } from "react";
import { Button } from "flowbite-react";
import { HiPencil } from "react-icons/hi";
import FormModal from "@/features/common/components/form-modal/form-modal";
import { CustomFormField } from "@/features/task-forms/components/task-confirm-modal/custom-form-field";
import { useCustomFormState } from "@/features/task-forms/components/task-confirm-modal/hooks/use-custom-form-state";
import { updateTaskProperties } from "@/features/task-forms/services/client-form.service";
import { useLiveETA } from "@/features/common/providers/client-api.provider";
import { I18nDictionary, I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ETA_EDIT_FORM_CONFIG } from "./eta-edit-modal.config";
import dayjs from "dayjs";

export type ETAMode = "calculated" | "manual";

export type ManualETAReason =
  | "DESTINATION_SCHEDULE_RESTRICTIONS"
  | "WEEKEND_OR_HOLIDAY"
  | "AUTHORIZED_OVERNIGHT_WITH_CARGO"
  | "OTHER";

export type ETAEditModalProps = {
  /** The task ID to update */
  taskId: string;
  /** Current ETA mode */
  currentMode?: ETAMode;
  /** Current estimated arrival date */
  currentArrivalDate?: string;
  /** Current manual ETA reason */
  currentReason?: ManualETAReason;
  /** Current other reason text */
  currentReasonOther?: string;
  /** Origin geofence code for ETA calculation */
  originGeofence?: string;
  /** Destination geofence code for ETA calculation */
  destinationGeofence?: string;
  /** Callback after successful update */
  onUpdate?: (values: Record<string, unknown>) => void;
  /** Custom trigger element (defaults to pencil icon button) */
  trigger?: ReactNode;
  /** Label text for the trigger */
  triggerLabel?: string;
  /** Display value shown in the trigger */
  displayValue?: ReactNode;
  /** Icon to show in the trigger */
  icon?: ReactNode;
  /** Whether editing is disabled */
  disabled?: boolean;
  /** i18n dictionary */
  dict: I18nDictionary;
};

/**
 * ETAEditModal - A modal component for editing ETA with multiple related fields.
 *
 * This component handles the complex ETA editing flow that involves:
 * - ETA Mode selection (calculated vs manual)
 * - Manual arrival date/time picker
 * - Manual ETA reason selection
 * - Optional "other" reason text
 *
 * It uses the standardized FormModal shell and CustomFormField components
 * to match the visual design of task transition modals.
 */
export default function ETAEditModal({
  taskId,
  currentMode = "calculated",
  currentArrivalDate,
  currentReason,
  currentReasonOther,
  originGeofence,
  destinationGeofence,
  onUpdate,
  trigger,
  triggerLabel,
  displayValue,
  icon,
  disabled = false,
  dict,
}: ETAEditModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Get modal dictionary
  const modalDict = dict.pages.shippingDetailsTaskForm.modal;

  // Create initial values based on current task data
  const initialFormConfig = {
    ...ETA_EDIT_FORM_CONFIG,
    fields: ETA_EDIT_FORM_CONFIG.fields.map((field) => {
      if (field.name === "mintral_etaMode") {
        return { ...field, defaultValue: currentMode };
      }
      if (field.name === "mintral_estimatedArrivalDate" && currentArrivalDate) {
        return {
          ...field,
          defaultValue: dayjs(currentArrivalDate).format("YYYY-MM-DDTHH:mm"),
        };
      }
      if (field.name === "mintral_manualEtaReason" && currentReason) {
        return { ...field, defaultValue: currentReason };
      }
      if (field.name === "mintral_manualEtaReasonOther" && currentReasonOther) {
        return { ...field, defaultValue: currentReasonOther };
      }
      return field;
    }),
  };

  // Use the same form state hook as TaskConfirmModal
  const { formValues, setFormValue, resetFormValues, isFieldVisible } =
    useCustomFormState(isOpen, initialFormConfig);

  // Fetch calculated ETA using the same hook as TaskConfirmModal
  const shouldFetchETA = isOpen && !!originGeofence && !!destinationGeofence;
  const { eta } = useLiveETA(
    shouldFetchETA,
    originGeofence || "",
    destinationGeofence || "",
    formValues.mintral_etaMode as string || "calculated"
  );

  // Sync calculated ETA to manual field when switching to manual mode
  useEffect(() => {
    if (
      eta?.estimatedArrival &&
      formValues.mintral_etaMode === "manual" &&
      !formValues.mintral_estimatedArrivalDate
    ) {
      const datetimeLocal = dayjs(eta.estimatedArrival).format("YYYY-MM-DDTHH:mm");
      setFormValue("mintral_estimatedArrivalDate", datetimeLocal);
    }
  }, [
    eta?.estimatedArrival,
    formValues.mintral_etaMode,
    formValues.mintral_estimatedArrivalDate,
    setFormValue,
  ]);

  const handleOpen = useCallback(() => {
    if (disabled) return;
    setIsOpen(true);
    setError(null);
  }, [disabled]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setError(null);
    resetFormValues();
  }, [resetFormValues]);

  const handleSubmit = useCallback(async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Build the properties to update
      const properties: Record<string, unknown> = {
        mintral_etaMode: formValues.mintral_etaMode,
      };

      // Only include manual mode fields if mode is manual
      if (formValues.mintral_etaMode === "manual") {
        if (formValues.mintral_estimatedArrivalDate) {
          // Convert to ISO format for backend
          const isoDate = dayjs(formValues.mintral_estimatedArrivalDate as string).toISOString();
          properties.mintral_estimatedArrivalDate = isoDate;
          properties.mintral_arrivalDate = isoDate;
        }

        if (formValues.mintral_manualEtaReason) {
          properties.mintral_manualEtaReason = formValues.mintral_manualEtaReason;
        }

        if (
          formValues.mintral_manualEtaReason === "OTHER" &&
          formValues.mintral_manualEtaReasonOther
        ) {
          properties.mintral_manualEtaReasonOther = formValues.mintral_manualEtaReasonOther;
        }
      } else {
        // For calculated mode, use the calculated ETA
        if (eta?.estimatedArrival) {
          properties.mintral_estimatedArrivalDate = eta.estimatedArrival;
          properties.mintral_arrivalDate = eta.estimatedArrival;
        }
      }

      const result = await updateTaskProperties(taskId, properties);

      if (result.success) {
        setIsOpen(false);
        onUpdate?.(properties);
      } else {
        setError(new Error(result.error || "Failed to save ETA changes"));
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("An error occurred"));
    } finally {
      setIsProcessing(false);
    }
  }, [taskId, formValues, eta, onUpdate]);

  // Build allValues for LiveFormField
  const allValues = {
    mintral_originDelegateCode: originGeofence,
    mintral_destinationDelegateCode: destinationGeofence,
    ...formValues,
  };

  // Render the trigger element (pencil icon by default)
  const renderTrigger = () => {
    if (trigger) {
      return (
        <div
          onClick={handleOpen}
          className={`group ${!disabled ? "cursor-pointer" : ""}`}
        >
          {trigger}
        </div>
      );
    }

    return (
      <div
        className={`group flex items-center gap-1`}
      >
        {icon && (
          <div className="flex items-center mr-1 text-gray-400">{icon}</div>
        )}
        {triggerLabel && (
          <span className="text-gray-600 dark:text-gray-400 text-sm font-light">
            {triggerLabel}:
          </span>
        )}
        <span className="text-gray-800 dark:text-gray-200 text-sm font-normal">
          {displayValue ?? "-"}
        </span>
        {!disabled && (
          <Button
            size="xs"
            color="light"
            onClick={(e) => {
              e.stopPropagation();
              handleOpen();
            }}
            className="ml-1 p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 border-0 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label={`Edit ${triggerLabel}`}
          >
            <HiPencil className="w-3.5 h-3.5 text-gray-400 dark:text-white hover:text-gray-600 dark:hover:text-white" />
            <span className="ml-1">{modalDict.editEtaButtonLabel}</span>
          </Button>
        )}
      </div>
    );
  };

  return (
    <>
      {renderTrigger()}
    
      <FormModal
        isOpen={isOpen}
        onClose={handleClose}
        title={modalDict.editEtaTitle }
        subtitle={modalDict.editEtaSubtitle}
        submitLabel={modalDict.save}
        cancelLabel={modalDict.cancel}
        isProcessing={isProcessing}
        error={error}
        onSubmit={handleSubmit}
        size="4xl"
      >
        <div className="flex flex-col gap-4">
          {initialFormConfig.fields.map((field) => (
            <CustomFormField
              key={field.name}
              field={field}
              value={formValues[field.name] ?? field.defaultValue ?? ""}
              onChange={(value) => setFormValue(field.name, value)}
              dict={modalDict}
              isVisible={isFieldVisible(field)}
              allValues={allValues}
            />
          ))}
        </div>
      </FormModal>
    </>
  );
}
