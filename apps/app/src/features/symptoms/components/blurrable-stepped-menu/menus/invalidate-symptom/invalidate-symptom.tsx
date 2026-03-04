"use client";

import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { TreatmentsRequest } from "@/app/api/treatments/route.type";
import { requestTreatment } from "@/features/common/providers/client-api.provider";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { Button, Textarea } from "flowbite-react";
import { useState } from "react";
import { MdBlock } from "react-icons/md";
import { useRouter } from "next/navigation";
import { ShowNotification } from "@/features/notifications/notification";
import { tr } from "@/features/i18n/tr.service";

export default function InvalidateSymptom({
  dict,
  treatmentData,
  reason,
  setReason,
  treatmentRequest,
  setTreatmentRequest,
  setIsMenuOpen,
}: {
  dict: I18nRecord;
  treatmentData: TreatmentsGeneralResponseItem | null;
  reason: string;
  setReason: (reason: string) => void;
  treatmentRequest: TreatmentsRequest;
  setTreatmentRequest: (treatmentRequest: TreatmentsRequest) => void;
  setIsMenuOpen: (isMenuOpen: boolean) => void;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      setTreatmentRequest({
        ...treatmentRequest,
        status: "active",
        description: reason,
      });
      await requestTreatment({
        ...treatmentRequest,
        status: "active",
        treatment_type: "invalidar sintoma",
        description: reason,
      });

      await fetch("/app/api/symptoms/invalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptom_id: treatmentData?.symptom_info?.id.toString() ?? "",
          asset_id: treatmentData?.trip_info?.asset_id ?? "",
          trip_id: treatmentData?.trip_info?.trip_id ?? "",
          reason,
          invalidated_by: treatmentRequest.assigned_to,
          treatment_id: treatmentRequest.treatment_id,
        }),
      });

      setIsMenuOpen(false);
      router.push("/symptoms");
      ShowNotification({
        type: "success",
        message: (dict.symptoms as I18nRecord).treatment_saved as string,
      });
    } catch {
      ShowNotification({
        type: "error",
        message: "Failed to invalidate symptom",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-2">
      <div className="w-full flex flex-col items-center gap-3 flex-grow">
        <div className="w-full flex flex-col gap-2">
          <h1 className="w-full text-left text-sm font-light justify-self-end text-gray-900 dark:text-white">
            {tr("symptoms.service_information", dict)}
          </h1>
          <div className="w-full grid grid-cols-2 gap-2">
            <p className="text-xs font-light text-gray-900 dark:text-gray-200">
              {tr("symptoms.driver_name", dict)}:{" "}
              <span className="font-light text-gray-500 dark:text-gray-400">
                {treatmentData?.trip_info?.driver}
              </span>
            </p>
            <p className="text-xs font-light text-gray-900 dark:text-gray-200">
              {tr("symptoms.vehicle_plate", dict)}:{" "}
              <span className="font-light text-gray-500 dark:text-gray-400">
                {treatmentData?.trip_info?.asset_id}
              </span>
            </p>
            <p className="text-xs font-light text-gray-900 dark:text-gray-200">
              {tr("symptoms.phone", dict)}:{" "}
              <span className="font-light text-gray-500 dark:text-gray-400">
                {treatmentData?.trip_info?.driver_contact}
              </span>
            </p>
            <p className="text-xs font-light text-gray-900 dark:text-gray-200">
              {tr("symptoms.service", dict)}:{" "}
              <span className="font-light text-gray-500 dark:text-gray-400">
                {treatmentData?.symptom_info?.name}
              </span>
            </p>
            <p className="text-xs font-light text-gray-900 dark:text-gray-200">
              {tr("symptoms.load_type", dict)}:{" "}
              <span className="font-light text-gray-500 dark:text-gray-400">
                {treatmentData?.trip_info?.type_load}
              </span>
            </p>
            <p className="text-xs font-light text-gray-900 dark:text-gray-200">
              {tr("symptoms.recommended_prescription", dict)}:{" "}
              <span className="font-light text-gray-500 dark:text-gray-400">
                {tr("symptoms.invalidate_symptom", dict)}
              </span>
            </p>
          </div>
        </div>

        <div className="w-full flex flex-col gap-2 mt-2">
          <h1 className="w-full text-left text-sm font-light justify-self-end text-gray-900 dark:text-white">
            {tr("symptoms.invalidate_reason", dict)}
          </h1>
          <Textarea
            placeholder={
              tr("symptoms.invalidate_reason_placeholder", dict) as string
            }
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
          />
          {reason.trim().length === 0 && (
            <p className="text-xs text-red-500">
              {tr("symptoms.invalidate_reason_required", dict)}
            </p>
          )}
        </div>

        <div className="w-full flex flex-col gap-2 bg-orange-50 p-3 rounded-lg">
          <div className="flex flex-row items-center gap-2 text-orange-800">
            <MdBlock size={25} />
            {tr("symptoms.confirmation_required", dict)}
          </div>
          <p className="text-sm font-light text-orange-800 dark:text-orange-800">
            {tr("symptoms.invalidate_alert", dict)}
          </p>
        </div>

        <div className="w-full flex flex-col gap-2">
          <Button
            color="blue"
            onClick={handleSubmit}
            disabled={reason.trim().length === 0 || isSubmitting}
          >
            {tr("symptoms.save_and_confirm", dict) as string}
          </Button>
        </div>
      </div>
    </div>
  );
}
