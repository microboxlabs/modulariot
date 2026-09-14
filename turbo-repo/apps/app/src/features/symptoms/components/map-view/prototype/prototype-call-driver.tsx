"use client";

import { Button, ButtonGroup, Checkbox, Textarea, TextInput } from "flowbite-react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { useState } from "react";
import BrandedMultiSelect from "@/features/task-forms/components/task-confirm-modal/branded-multi-select";
import { requestTreatment } from "@/features/common/providers/client-api.provider";
import { TreatmentsRequest } from "@/app/api/treatments/route.type";
import { BiLogoMicrosoftTeams } from "react-icons/bi";
import { useRouter } from "next/navigation";
import { ShowNotification } from "@/features/notifications/notification";
import { tr } from "@/features/i18n/tr.service";
import {
  FieldCard,
  PlainSection,
  StickyActions,
  BentoGrid,
  BentoRow,
  SelectableFieldControl,
  SelectableDropdown,
  OptionsDropdown,
  useSelectableOptions,
  GeneralInfoGrid,
  fieldLabel,
  fillTextarea,
} from "./prototype-form-kit";

const sendTeamsCall = async (phoneNumber: string) => {
  if (!phoneNumber) return;
  window.open(
    `https://teams.microsoft.com/l/call/0/0?users=4:${phoneNumber}`,
    "_blank"
  );
};

/**
 * PROTOTYPE — variant of
 * `blurrable-stepped-menu/menus/call-driver/call-driver.tsx`. Same state and
 * submit logic; laid out as a bento grid that fits the panel height with no
 * scroll — the message and results cells absorb the free space. Every
 * dropdown is a Flowbite `Dropdown`, not a native `<select>`, and its options
 * come straight from whichever Selectable the field's gear is bound to (see
 * `prototype-form-kit`'s `SelectableDropdown` / `useSelectableOptions`) —
 * "who to call" is convention-first-option = the driver, and "call result"'s
 * last two options are treated as "no answer".
 */
export default function PrototypeCallDriver({
  dict,
  treatmentData,
  messageToCommunicate,
  setMessageToCommunicate,
  treatmentRequest,
  setTreatmentRequest,
  setIsMenuOpen,
}: {
  dict: I18nRecord;
  treatmentData: TreatmentsGeneralResponseItem | null;
  messageToCommunicate: string;
  setMessageToCommunicate: (message: string) => void;
  treatmentRequest: TreatmentsRequest;
  setTreatmentRequest: (treatmentRequest: TreatmentsRequest) => void;
  setIsMenuOpen: (isMenuOpen: boolean) => void;
}) {
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [callTargetId, setCallTargetId] = useState("");
  const [targetPhone, setTargetPhone] = useState("");
  const [resultadoId, setResultadoId] = useState("");
  const [notaLlamada, setNotaLlamada] = useState("");
  const [escalarAId, setEscalarAId] = useState("");
  const [registrarEscalamiento, setRegistrarEscalamiento] = useState(true);

  const dictSy = dict.symptoms as I18nRecord;
  const t = (k: string) => dictSy[k] as string;

  const { options: targetOptions } = useSelectableOptions("who_to_call");
  const { options: resultOptions } = useSelectableOptions("call_result");
  const { options: tagOptions } = useSelectableOptions("call_tags");

  // Convention: the first "who to call" option is the driver.
  const effectiveCallTargetId = callTargetId || targetOptions[0]?.id || "";
  const targetLabel =
    targetOptions.find((o) => o.id === effectiveCallTargetId)?.name ?? "";
  const esConductor =
    targetOptions.length > 0 && effectiveCallTargetId === targetOptions[0].id;

  const escalateOptions = targetOptions.filter(
    (o) => o.id !== effectiveCallTargetId
  );
  const effectiveEscalarAId = escalarAId || escalateOptions[0]?.id || "";
  const escalarALabel =
    escalateOptions.find((o) => o.id === effectiveEscalarAId)?.name ?? "";

  // Convention: the last two "call result" options mean "no answer".
  const resultadoLabel =
    resultOptions.find((o) => o.id === resultadoId)?.name ?? "";
  const sinRespuesta =
    resultOptions.length >= 2 &&
    (resultadoId === resultOptions[resultOptions.length - 1]?.id ||
      resultadoId === resultOptions[resultOptions.length - 2]?.id);

  const telefonoLlamada = esConductor
    ? (treatmentData?.trip_info?.driver_contact ?? "")
    : targetPhone;

  const router = useRouter();

  const handleSave = async () => {
    const response = await requestTreatment({
      ...treatmentRequest,
      driver_response:
        (resultadoLabel ? resultadoLabel : "") +
        (notaLlamada.trim() ? ` · ${notaLlamada.trim()}` : ""),
      description:
        `Llamado a: ${targetLabel}` +
        (esConductor
          ? ""
          : " · Escalamiento propuesto por el operador" +
            (targetPhone ? ` · Tel: ${targetPhone}` : "")) +
        (resultadoLabel ? ` · Resultado: ${resultadoLabel}` : "") +
        (sinRespuesta && registrarEscalamiento
          ? ` · Sin respuesta → escala a: ${escalarALabel}`
          : ""),
    });

    setTreatmentRequest({
      ...treatmentRequest,
      treatment_id: response.treatment_id,
    });
    setIsMenuOpen(false);
    router.push("/symptoms");
    ShowNotification({ type: "success", message: t("treatment_saved") });
  };

  /* ---------- shared field fragments ---------- */

  const generalInfo = (
    <GeneralInfoGrid
      dict={dict}
      treatmentData={treatmentData}
      prescription={t("call_driver")}
    />
  );

  const whoToCallFields = (
    <>
      <SelectableDropdown
        fieldKey="who_to_call"
        dict={dict}
        value={effectiveCallTargetId}
        onSelect={(o) => setCallTargetId(o.id)}
      />
      {!esConductor && (
        <div>
          <span className={fieldLabel}>{t("target_phone")}</span>
          <TextInput
            sizing="sm"
            type="tel"
            value={targetPhone}
            onChange={(e) => setTargetPhone(e.target.value)}
            placeholder="+56 9 …"
          />
        </div>
      )}
      {!esConductor && (
        <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-light text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          {t("escalation_note")}
        </p>
      )}
    </>
  );

  const messageField = (
    <Textarea
      defaultValue={messageToCommunicate}
      className={fillTextarea}
      onChange={(e) => setMessageToCommunicate(e.target.value)}
    />
  );

  const resultFields = (
    <>
      <div>
        <span className={fieldLabel}>{t("call_result")}</span>
        <SelectableDropdown
          fieldKey="call_result"
          dict={dict}
          value={resultadoId}
          onSelect={(o) => setResultadoId(o.id)}
          placeholder={t("result_pending")}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <span className={fieldLabel}>{t("call_note")}</span>
        <Textarea
          className={fillTextarea}
          value={notaLlamada}
          onChange={(e) => setNotaLlamada(e.target.value)}
        />
      </div>
      {sinRespuesta && (
        <div className="flex w-full flex-col gap-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
            {t("escalate_offer")}
          </p>
          <div className="flex flex-row flex-wrap items-center gap-2.5">
            <span className="text-xs font-light text-amber-900 dark:text-amber-200">
              {t("escalate_to")}:
            </span>
            <OptionsDropdown
              className="w-full sm:w-56"
              options={escalateOptions}
              value={effectiveEscalarAId}
              onSelect={(o) => setEscalarAId(o.id)}
              placeholder={t("escalate_to")}
              emptyLabel={t("proto_selectable_unassigned")}
            />
            <label className="flex items-center gap-2 text-xs font-light text-amber-900 dark:text-amber-200">
              <Checkbox
                checked={registrarEscalamiento}
                onChange={(e) => setRegistrarEscalamiento(e.target.checked)}
              />
              {t("register_escalation")}
            </label>
          </div>
        </div>
      )}
    </>
  );

  const tagsFields = (
    <BrandedMultiSelect
      size="sm"
      options={tagOptions.map((o) => ({
        value: o.id,
        label: o.name,
        description: o.description || undefined,
      }))}
      selectedValues={selectedTagIds}
      onSelectionChange={setSelectedTagIds}
      placeholder={t("proto_tags_placeholder")}
      summaryLabel={(count) =>
        tr("symptoms.proto_tags_summary", dict, { count: String(count) })
      }
      emptyLabel={t("proto_tags_empty")}
    />
  );

  const actions = (
    <ButtonGroup className="w-full">
      <Button
        color="light"
        className="h-10 flex-1 rounded-r-none whitespace-nowrap"
        onClick={() => sendTeamsCall(telefonoLlamada)}
      >
        <BiLogoMicrosoftTeams className="mr-2 h-5 w-5" />
        {t("teams_call")}
        {t("teams_call2") ? ` ${t("teams_call2")}` : ""}
      </Button>
      <Button
        color="blue"
        className="h-10 flex-1 rounded-l-none whitespace-nowrap"
        onClick={handleSave}
      >
        {t("save_treatment")}
      </Button>
    </ButtonGroup>
  );

  return (
    <BentoGrid>
      <PlainSection title={t("proto_section_general")}>
        {generalInfo}
      </PlainSection>

      <FieldCard
        title={t("proto_section_who")}
        action={<SelectableFieldControl fieldKey="who_to_call" dict={dict} />}
      >
        {whoToCallFields}
      </FieldCard>

      <BentoRow grow>
        <FieldCard title={t("proto_section_message")} grow>
          {messageField}
        </FieldCard>

        <FieldCard
          title={t("proto_section_results")}
          action={<SelectableFieldControl fieldKey="call_result" dict={dict} />}
          grow
        >
          {resultFields}
        </FieldCard>
      </BentoRow>

      <FieldCard
        title={t("proto_section_tags")}
        action={<SelectableFieldControl fieldKey="call_tags" dict={dict} />}
      >
        {tagsFields}
      </FieldCard>

      <StickyActions>{actions}</StickyActions>
    </BentoGrid>
  );
}
