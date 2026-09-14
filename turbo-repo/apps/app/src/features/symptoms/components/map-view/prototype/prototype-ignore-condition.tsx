"use client";

import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { TreatmentsRequest } from "@/app/api/treatments/route.type";
import { requestTreatment } from "@/features/common/providers/client-api.provider";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { Button, Select, Textarea } from "flowbite-react";
import { useState } from "react";
import { TiDelete } from "react-icons/ti";
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
 * `blurrable-stepped-menu/menus/ignore-condition/ignore-condition.tsx`.
 * Same submit logic; laid out as a bento grid that fits the panel height.
 */
export default function PrototypeIgnoreCondition({
  dict,
  treatmentData,
  duration,
  setDuration,
  scope,
  setScope,
  treatmentRequest,
  setTreatmentRequest,
  setIsMenuOpen,
}: {
  dict: I18nRecord;
  treatmentData: TreatmentsGeneralResponseItem | null;
  duration: number;
  setDuration: (duration: number) => void;
  scope: string;
  setScope: (scope: string) => void;
  treatmentRequest: TreatmentsRequest;
  setTreatmentRequest: (treatmentRequest: TreatmentsRequest) => void;
  setIsMenuOpen: (isMenuOpen: boolean) => void;
}) {
  const [durationLocal, setDurationLocal] = useState(duration);
  const [motivoId, setMotivoId] = useState("");
  const [nota, setNota] = useState("");
  const router = useRouter();
  const t = (k: string) => tr(`symptoms.${k}`, dict);

  const { options: motivoOptions } = useSelectableOptions("ignore_reason");
  const motivoLabel = motivoOptions.find((m) => m.id === motivoId)?.name ?? "";
  // Convention: the last "reason" option is the free-text "Other".
  const notaObligatoria =
    motivoOptions.length > 0 &&
    motivoId === motivoOptions[motivoOptions.length - 1]?.id;
  const puedeGuardar =
    motivoId !== "" && (!notaObligatoria || nota.trim().length > 0);

  const handleSave = async () => {
    setTreatmentRequest({
      ...treatmentRequest,
      v_symptom_treatment_time: duration,
      status: "active",
    });
    await requestTreatment({
      ...treatmentRequest,
      status: "active",
      treatment_type: "ignorar condicion",
      v_symptom_treatment_time: duration,
      description:
        `Motivo: ${motivoLabel}` +
        (nota.trim() ? ` · Nota: ${nota.trim()}` : ""),
    });
    setIsMenuOpen(false);
    router.push("/symptoms");
    ShowNotification({ type: "success", message: t("treatment_saved") });
  };

  /* ---------- shared fragments ---------- */

  const generalInfo = (
    <GeneralInfoGrid
      dict={dict}
      treatmentData={treatmentData}
      prescription={t("ignore_condition")}
    />
  );

  const reasonFields = (
    <>
      <div>
        <span className={fieldLabel}>{t("ignore_reason")} *</span>
        <SelectableDropdown
          fieldKey="ignore_reason"
          dict={dict}
          value={motivoId}
          onSelect={(o) => setMotivoId(o.id)}
          placeholder={t("reason_required")}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <span className={fieldLabel}>
          {t("ignore_note")}
          {notaObligatoria ? " *" : ""}
        </span>
        <Textarea
          className={fillTextarea}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />
        {notaObligatoria && nota.trim().length === 0 && (
          <p className="mt-1 text-xs text-red-500">{t("note_required_other")}</p>
        )}
      </div>
    </>
  );

  const scopeFields = (
    <div className="flex w-full flex-row gap-4">
      <div className="flex w-1/2 flex-col">
        <span className={fieldLabel}>{t("duration")}</span>
        <Select
          sizing="sm"
          defaultValue={durationLocal}
          onChange={(e) => {
            setDuration(Number.parseInt(e.target.value));
            setDurationLocal(Number.parseInt(e.target.value));
          }}
        >
          <option value="300">5 {t("minutes")}</option>
          <option value="1800">30 {t("minutes")}</option>
          <option value="3600">1 {t("hour")}</option>
          <option value="7200">2 {t("hours")}</option>
          <option value="-1">{t("ignore_indefinitely")}</option>
        </Select>
      </div>
      <div className="flex w-1/2 flex-col">
        <span className={fieldLabel}>{t("scope")}</span>
        <Select
          sizing="sm"
          defaultValue={scope}
          disabled
          onChange={(e) => setScope(e.target.value)}
        >
          <option value="synthom">{t("this_symptom")}</option>
          <option value="same_synthoms">{t("same_symptoms")}</option>
          <option value="all_synthoms">{t("all_symptoms")}</option>
        </Select>
      </div>
    </div>
  );

  const confirmFields = (
    <>
      <div className="flex w-full flex-col gap-2 rounded-lg bg-orange-50 p-3 dark:bg-orange-900/20">
        <div className="flex flex-row items-center gap-2 text-sm font-medium text-orange-800 dark:text-orange-300">
          <TiDelete size={22} />
          {t("confirmation_required")}
        </div>
        <p className="text-xs font-light text-orange-800 dark:text-orange-300">
          {t("ignore_alert")}
        </p>
      </div>
      <p className="rounded-md bg-green-50 px-2.5 py-1.5 text-xs font-light text-green-800 dark:bg-green-900/20 dark:text-green-300">
        {t("ignore_learning")}
      </p>
    </>
  );

  const actions = (
    <Button
      color="blue"
      className="h-10 w-full"
      disabled={!puedeGuardar}
      onClick={handleSave}
    >
      {t("save_and_confirm")}
    </Button>
  );

  return (
    <BentoGrid>
      {/* Semantics — sits right under the panel title, above every card */}
      <p className="shrink-0 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-light text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
        {t("proto_ignore_semantics")}
      </p>

      <PlainSection title={t("proto_section_general")}>
        {generalInfo}
      </PlainSection>

      <FieldCard title={t("proto_section_scope")}>{scopeFields}</FieldCard>

      <FieldCard
        title={t("proto_section_reason")}
        action={<SelectableFieldControl fieldKey="ignore_reason" dict={dict} />}
        grow
      >
        {reasonFields}
      </FieldCard>

      {/* Confirmation — plain, no card, sits right under Motivo */}
      <div className="flex shrink-0 flex-col gap-2">{confirmFields}</div>

      <StickyActions>{actions}</StickyActions>
    </BentoGrid>
  );
}
