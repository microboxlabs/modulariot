"use client";

import { Button, Modal, ModalBody, ModalHeader } from "flowbite-react";
import { HiExclamationCircle } from "react-icons/hi2";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { RejectedItem, ApprovedItem } from "../task-bento-form/bento-review-context";
import { useCustomFormState } from "../task-confirm-modal/hooks/use-custom-form-state";
import { CustomFormField } from "../task-confirm-modal/custom-form-field";
import { ETA_EDIT_FORM_CONFIG } from "../eta-edit-modal/eta-edit-modal.config";
import { useLiveETA } from "@/features/common/providers/client-api.provider";
import { updateTaskProperties } from "@/features/task-forms/services/client-form.service";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { ReviewSection } from "./review-items";

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
      properties.mintral_arrivalDate = iso;
    }
    if (formValues.mintral_manualEtaReason) {
      properties.mintral_manualEtaReason = formValues.mintral_manualEtaReason;
    }
    if (formValues.mintral_manualEtaReason === "OTHER" && formValues.mintral_manualEtaReasonOther) {
      properties.mintral_manualEtaReasonOther = formValues.mintral_manualEtaReasonOther;
    }
  } else if (eta?.estimatedArrival) {
    properties.mintral_estimatedArrivalDate = eta.estimatedArrival;
    properties.mintral_arrivalDate = eta.estimatedArrival;
  }
  return properties;
}

interface GoBackModalProps {
  show: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isSubmitting?: boolean;
  outcomeLabel: string;
  approvedItems?: ApprovedItem[];
  rejectedItems: RejectedItem[];
  subtitle?: string;
  lang: string;
  dict: I18nRecord;
  showEtaEdit?: boolean;
  taskId?: string;
  originGeofence?: string;
  destinationGeofence?: string;
  etaModalDict?: I18nRecord;
}

export default function GoBackModal({
  show,
  onClose,
  onConfirm,
  isSubmitting = false,
  outcomeLabel,
  approvedItems = [],
  rejectedItems,
  subtitle,
  lang,
  dict,
  showEtaEdit = false,
  taskId,
  originGeofence,
  destinationGeofence,
  etaModalDict,
}: Readonly<GoBackModalProps>) {
  const hasItems = approvedItems.length > 0 || rejectedItems.length > 0;
  const rejectedCountKey = rejectedItems.length === 1
    ? "outcome.goBackModalRejectedCount_one"
    : "outcome.goBackModalRejectedCount";
  const approvedCountKey = approvedItems.length === 1
    ? "outcome.continueModalApprovedCount_one"
    : "outcome.continueModalApprovedCount";

  const [etaSaveError, setEtaSaveError] = useState<string | null>(null);

  const { formValues, setFormValue, resetFormValues, isFieldVisible } =
    useCustomFormState(show, showEtaEdit ? ETA_EDIT_FORM_CONFIG : undefined);

  const shouldFetchETA =
    showEtaEdit && show && !!originGeofence && !!destinationGeofence;

  const { eta } = useLiveETA(
    shouldFetchETA,
    originGeofence ?? "",
    destinationGeofence ?? "",
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
  }, [eta?.estimatedArrival, formValues.mintral_etaMode, formValues.mintral_estimatedArrivalDate, setFormValue]);

  const handleClose = () => {
    resetFormValues();
    setEtaSaveError(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (showEtaEdit && taskId) {
      const properties = buildEtaProperties(formValues, eta);
      try {
        await updateTaskProperties(taskId, properties);
        setEtaSaveError(null);
      } catch (err) {
        console.error("[GoBack] ETA save failed", err);
        setEtaSaveError("No se pudo guardar la ETA. Intenta nuevamente.");
        return;
      }
    }
    await onConfirm();
  };

  const etaAllValues = {
    mintral_originDelegateCode: originGeofence,
    mintral_destinationDelegateCode: destinationGeofence,
    ...formValues,
  };

  return (
    <Modal
      dismissible
      show={show}
      onClose={handleClose}
      size="xl"
      theme={{
        content: {
          base: "relative w-full p-4 md:h-auto",
          inner: "relative flex max-h-[90dvh] flex-col rounded-lg bg-white dark:bg-gray-800 dark:border dark:border-gray-600 shadow",
        },
        header: {
          base: "flex items-center justify-between rounded-t border-b p-5 dark:border-gray-600",
          close: { base: "hidden" },
        },
        body: { base: "flex-1 overflow-auto px-5 pb-5" },
      }}
    >
      <ModalHeader className="border-none">
        <div className="flex flex-col">
          <span className="text-base font-semibold">{outcomeLabel}</span>
          <span className="text-sm text-gray-500 mt-1 font-normal">
            {subtitle ?? tr("outcome.goBackModalSubtitle", dict)}
          </span>
        </div>
      </ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-4">
          {showEtaEdit && etaModalDict && (
         
              <div className="flex flex-col gap-3 p-4 border rounded-md border-gray-200 dark:border-gray-700">
                {ETA_EDIT_FORM_CONFIG.fields.map((field) => (
                  <CustomFormField
                    key={field.name}
                    field={field}
                    value={formValues[field.name] ?? field.defaultValue ?? ""}
                    onChange={(value) => setFormValue(field.name, value)}
                    dict={etaModalDict}
                    isVisible={isFieldVisible(field)}
                    allValues={etaAllValues}
                  />
                ))}
              </div>
          )}

          {hasItems ? (
            <div className="flex flex-col gap-4">
              <ReviewSection
                items={approvedItems}
                status="approved"
                countLabel={trDynamic(approvedCountKey, dict, { count: String(approvedItems.length) })}
                locale={lang}
              />
              <ReviewSection
                items={rejectedItems}
                status="rejected"
                countLabel={trDynamic(rejectedCountKey, dict, { count: String(rejectedItems.length) })}
                locale={lang}
                noObservationsLabel={tr("outcome.goBackModalNoMotives", dict)}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
              <HiExclamationCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {tr("outcome.goBackModalNoMotives", dict)}
              </p>
            </div>
          )}

          {etaSaveError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3">
              <HiExclamationCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300">{etaSaveError}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button color="blue" onClick={handleConfirm} disabled={isSubmitting}>
              {tr("outcome.goBackModalConfirm", dict)}
            </Button>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}
