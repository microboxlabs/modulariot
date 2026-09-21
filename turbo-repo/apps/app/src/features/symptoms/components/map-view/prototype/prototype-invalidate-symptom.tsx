"use client";

import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { TreatmentsRequest } from "@/app/api/treatments/route.type";
import { guardedRequestTreatment, isPrototypeApiDisabled } from "./prototype-api-guard";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { Button, Textarea } from "flowbite-react";
import { useState } from "react";
import { MdBlock } from "react-icons/md";
import { useRouter } from "next/navigation";
import { ShowNotification } from "@/features/notifications/notification";
import { tr } from "@/features/i18n/tr.service";
import {
  FieldCard,
  PlainSection,
  StickyActions,
  BentoGrid,
  SelectableFieldControl,
  SelectableDropdown,
  useSelectableOptions,
  GeneralInfoGrid,
  fieldLabel,
  fillTextarea,
} from "./prototype-form-kit";

/**
 * PROTOTYPE — variant of
 * `blurrable-stepped-menu/menus/invalidate-symptom/invalidate-symptom.tsx`.
 * Same submit + webhook logic; laid out as a bento grid that fits the panel
 * height.
 */
export default function PrototypeInvalidateSymptom({
  dict,
  treatmentData,
  reason,
  setReason,
  treatmentRequest,
  setTreatmentRequest,
  setIsMenuOpen,
}: Readonly<{
  dict: I18nRecord;
  treatmentData: TreatmentsGeneralResponseItem | null;
  reason: string;
  setReason: (reason: string) => void;
  treatmentRequest: TreatmentsRequest;
  setTreatmentRequest: (treatmentRequest: TreatmentsRequest) => void;
  setIsMenuOpen: (isMenuOpen: boolean) => void;
}>) {
  const router = useRouter();
  const t = (k: string) => tr(`symptoms.${k}`, dict);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [motivoId, setMotivoId] = useState("");

  const { options: motivoOptions } = useSelectableOptions("invalidate_reason");
  const motivoLabel = motivoOptions.find((m) => m.id === motivoId)?.name ?? "";
  const razonCompleta = motivoId
    ? `Motivo: ${motivoLabel}` + (reason.trim() ? ` · ${reason.trim()}` : "")
    : reason.trim();
  const puedeGuardar = motivoId !== "" && reason.trim().length > 0;

  const handleSubmit = async () => {
    if (!puedeGuardar || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const treatmentResult = await guardedRequestTreatment({
        ...treatmentRequest,
        status: "active",
        treatment_type: "invalidar sintoma",
        description: razonCompleta,
      });

      setTreatmentRequest({
        ...treatmentRequest,
        status: "active",
        description: razonCompleta,
        treatment_id: treatmentResult.treatment_id,
      });

      // Same kill switch as `guardedRequestTreatment` above — this webhook
      // is a second, separate real write (symptom invalidation), not routed
      // through `requestTreatment` at all, so it needs its own check.
      if (!isPrototypeApiDisabled()) {
        const invalidateResponse = await fetch("/app/api/symptoms/invalidate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symptom_id: treatmentData?.symptom_info?.id.toString() ?? "",
            asset_id: treatmentData?.trip_info?.asset_id ?? "",
            trip_id: treatmentData?.trip_info?.trip_id ?? "",
            reason: razonCompleta,
            invalidated_by: treatmentRequest.assigned_to,
            treatment_id: treatmentResult.treatment_id,
          }),
        });
        if (!invalidateResponse.ok) throw new Error("Invalidate webhook failed");
      }

      setIsMenuOpen(false);
      router.push("/symptoms");
      ShowNotification({ type: "success", message: t("treatment_saved") });
    } catch {
      ShowNotification({ type: "error", message: t("invalidate_error") });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---------- shared fragments ---------- */

  const generalInfo = (
    <GeneralInfoGrid dict={dict} treatmentData={treatmentData} />
  );

  const motivoField = (
    <div>
      <span className={fieldLabel}>{t("invalidate_motivo")} *</span>
      <SelectableDropdown
        fieldKey="invalidate_reason"
        dict={dict}
        value={motivoId}
        onSelect={(o) => setMotivoId(o.id)}
        placeholder={t("reason_required")}
      />
    </div>
  );

  const detailFields = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {t("invalidate_reason")} *
        </span>
        {reason.trim().length === 0 && (
          <span className="text-xs text-red-500">
            {t("invalidate_reason_required")}
          </span>
        )}
      </div>
      <Textarea
        className={fillTextarea}
        placeholder={t("invalidate_reason_placeholder")}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
    </div>
  );

  const confirmFields = (
    <>
      <div className="flex w-full flex-col gap-2 rounded-lg bg-orange-50 p-3 dark:bg-orange-900/20">
        <div className="flex flex-row items-center gap-2 text-sm font-medium text-orange-800 dark:text-orange-300">
          <MdBlock size={22} />
          {t("confirmation_required")}
        </div>
        <p className="text-xs font-light text-orange-800 dark:text-orange-300">
          {t("invalidate_alert")}
        </p>
      </div>
      <p className="rounded-md bg-green-50 px-2.5 py-1.5 text-xs font-light text-green-800 dark:bg-green-900/20 dark:text-green-300">
        {t("invalidate_learning")}
      </p>
    </>
  );

  const actions = (
    <Button
      color="blue"
      className="h-10 w-full"
      onClick={handleSubmit}
      disabled={!puedeGuardar || isSubmitting}
    >
      {t("save_and_confirm")}
    </Button>
  );

  return (
    <BentoGrid>
      {/* Semantics — sits right under the panel title, above every card */}
      <p className="shrink-0 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-light text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
        {t("proto_invalidate_semantics")}
      </p>

      <PlainSection title={t("proto_section_general")}>
        {generalInfo}
      </PlainSection>

      <FieldCard
        title={t("proto_section_detail")}
        action={<SelectableFieldControl fieldKey="invalidate_reason" dict={dict} />}
        grow
      >
        {motivoField}
        {detailFields}
      </FieldCard>

      {/* Confirmation — plain, no card, sits right under Detalle */}
      <div className="flex shrink-0 flex-col gap-2">{confirmFields}</div>

      <StickyActions>{actions}</StickyActions>
    </BentoGrid>
  );
}
