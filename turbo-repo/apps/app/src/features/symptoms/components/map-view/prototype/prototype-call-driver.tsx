"use client";

import { Button, ButtonGroup, Textarea, TextInput } from "flowbite-react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { useState } from "react";
import BrandedMultiSelect from "@/features/task-forms/components/task-confirm-modal/branded-multi-select";
import { guardedRequestTreatment } from "./prototype-api-guard";
import { TreatmentsRequest } from "@/app/api/treatments/route.type";
import { BiLogoMicrosoftTeams } from "react-icons/bi";
import { useRouter } from "next/navigation";
import { ShowNotification } from "@/features/notifications/notification";
import { tr } from "@/features/i18n/tr.service";
import InitialIdentifier from "@/features/common/components/user-related/initial-identifier";
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
import type { SelectableOption } from "@/features/settings-admin/selectables/types";
import type { SelectedOption } from "@/features/symptoms/types/side-info";
import { mockCallStatsForId } from "./call-center/mock-contact-data";
import { CALL_METHOD_ICONS, CALL_METHOD_LABEL_KEYS, type CallMethod } from "./call-center/call-method";
import CallStatsBadges from "./call-center/call-stats-badges";
import CallSwitchDropdown from "./call-center/call-switch-dropdown";

/** Fixed content, not a Selectable — "call result" used to be a plain,
 *  non-configurable dropdown (see the older, non-debug `call-driver.tsx`)
 *  before this prototype briefly rewired it onto the admin-editable
 *  Selectables system. Restored to that original fixed list. The last two
 *  entries are load-bearing: `sinRespuesta` below treats them as "no
 *  answer", same convention the old component used. */
const CALL_RESULT_OPTION_IDS = [
  "result_commits",
  "result_corrected",
  "result_rejects",
  "result_no_answer",
  "result_voicemail",
];

function formatCallDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

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
 * dropdown is a Flowbite `Dropdown`, not a native `<select>`. "Who to call"
 * and "tags" are Selectables — their options come from whichever one the
 * field's gear is bound to (see `prototype-form-kit`'s `SelectableDropdown` /
 * `useSelectableOptions`) — but "call result" is deliberately NOT one: it's
 * the same fixed, non-configurable list the older non-debug form always had
 * (`CALL_RESULT_OPTION_IDS` below), rendered with the same `OptionsDropdown`
 * look. "Who to call" is convention-first-option = the driver, and "call
 * result"'s last two options are treated as "no answer".
 */
export default function PrototypeCallDriver({
  dict,
  treatmentData,
  messageToCommunicate,
  setMessageToCommunicate,
  treatmentRequest,
  setTreatmentRequest,
  setIsMenuOpen,
  initialCallTargetId,
  initialCallTargetName,
  initialCallTargetRole,
  initialCallTargetPhone,
  callMethodUsed,
  aiAssistEnabled = false,
  callDurationSeconds = null,
  onMakeAnotherCall,
  onSwitchTreatment,
}: {
  dict: I18nRecord;
  treatmentData: TreatmentsGeneralResponseItem | null;
  messageToCommunicate: string;
  setMessageToCommunicate: (message: string) => void;
  treatmentRequest: TreatmentsRequest;
  setTreatmentRequest: (treatmentRequest: TreatmentsRequest) => void;
  setIsMenuOpen: (isMenuOpen: boolean) => void;
  /** Debug call-center flow: contact already chosen in the previous step. */
  initialCallTargetId?: string;
  /** Debug call-center flow: the person's real name (not the role option's
   *  label) — when set, "who to call" becomes a static "who was called"
   *  readout instead of an editable picker, since the call already happened. */
  initialCallTargetName?: string;
  /** Debug call-center flow: the role badge for that contact — empty for a
   *  custom-added contact, whose option name IS the person's name already. */
  initialCallTargetRole?: string;
  /** Debug call-center flow: that contact's phone number, shown alongside
   *  the name in the "who was called" readout. */
  initialCallTargetPhone?: string;
  /** Debug call-center flow: which channel the call went through. */
  callMethodUsed?: CallMethod;
  /** Debug call-center flow: the call already happened (reason + duration are
   *  known), so the harness pre-fills the outcome/note/tags it "heard" on the
   *  call — shown with the harness mark until the operator edits them. */
  aiAssistEnabled?: boolean;
  /** Debug call-center flow: elapsed time from the live-call step. */
  callDurationSeconds?: number | null;
  /** Debug call-center flow only: discards this call and sends the operator
   *  back to "who to call" instead of the static "Llamar por Teams" action —
   *  present only when there's a contacts step to go back to. Wired to the
   *  "Guardar y hacer otra llamada" entry of `CallSwitchDropdown` below,
   *  after that entry's own save request completes. */
  onMakeAnotherCall?: () => void;
  /** Debug call-center flow only: switches the whole panel to a different
   *  treatment form (e.g. "Ignorar condición") without leaving the panel —
   *  present alongside `onMakeAnotherCall`. Replaces the plain "Hacer otra
   *  llamada" button with `CallSwitchDropdown`, offering both actions plus
   *  every other treatment type. */
  onSwitchTreatment?: (option: SelectedOption) => void;
}) {
  const dictSy = dict.symptoms as I18nRecord;
  const t = (k: string) => dictSy[k] as string;

  const { options: targetOptions } = useSelectableOptions("who_to_call");
  const resultOptions: SelectableOption[] = CALL_RESULT_OPTION_IDS.map((id) => ({
    id,
    name: t(id),
    description: "",
  }));
  const { options: tagOptions } = useSelectableOptions("call_tags");

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(() =>
    aiAssistEnabled && tagOptions[0] ? [tagOptions[0].id] : []
  );
  const [callTargetId, setCallTargetId] = useState(initialCallTargetId ?? "");
  const [targetPhone, setTargetPhone] = useState("");
  const [resultadoId, setResultadoId] = useState(() =>
    aiAssistEnabled ? (resultOptions[0]?.id ?? "") : ""
  );
  const [notaLlamada, setNotaLlamada] = useState(() =>
    aiAssistEnabled && messageToCommunicate.trim()
      ? `Resumen generado por el harness: se comunicó "${messageToCommunicate.trim()}" y el conductor confirmó la recepción.`
      : ""
  );
  // Each starts "AI-filled" (if there was content to fill) and loses that
  // status the moment the operator touches the field — see `AiFillFrame`.
  const [resultAiFilled, setResultAiFilled] = useState(
    aiAssistEnabled && resultOptions.length > 0
  );
  const [notaAiFilled, setNotaAiFilled] = useState(
    aiAssistEnabled && messageToCommunicate.trim().length > 0
  );
  const [tagsAiFilled, setTagsAiFilled] = useState(
    aiAssistEnabled && tagOptions.length > 0
  );

  // Convention: the first "who to call" option is the driver.
  const effectiveCallTargetId = callTargetId || targetOptions[0]?.id || "";
  const targetLabel =
    targetOptions.find((o) => o.id === effectiveCallTargetId)?.name ?? "";
  const esConductor =
    targetOptions.length > 0 && effectiveCallTargetId === targetOptions[0].id;

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

  // Shared by both "Finalizar Tratamiento" and "Guardar y hacer otra
  // llamada" — the only difference between them is what happens after the
  // request resolves (leave the panel vs. go back to "who to call").
  const saveTreatment = () =>
    guardedRequestTreatment({
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
        (callDurationSeconds !== null
          ? ` · Duración: ${formatCallDuration(callDurationSeconds)}`
          : ""),
    });

  const handleSave = async () => {
    const response = await saveTreatment();

    setTreatmentRequest({
      ...treatmentRequest,
      treatment_id: response.treatment_id,
    });

    setIsMenuOpen(false);
    router.push("/symptoms");
    ShowNotification({ type: "success", message: t("treatment_saved") });
  };

  const handleSaveAndCallAgain = async () => {
    const response = await saveTreatment();

    setTreatmentRequest({
      ...treatmentRequest,
      treatment_id: response.treatment_id,
    });

    ShowNotification({ type: "success", message: t("treatment_saved") });
    onMakeAnotherCall?.();
  };

  /* ---------- shared field fragments ---------- */

  const generalInfo = (
    <GeneralInfoGrid dict={dict} treatmentData={treatmentData} />
  );

  const CalledMethodIcon = callMethodUsed ? CALL_METHOD_ICONS[callMethodUsed] : null;
  const calledStats = initialCallTargetId
    ? mockCallStatsForId(initialCallTargetId)
    : null;

  const whoToCallFields = initialCallTargetName ? (
    <div className="flex items-center gap-3">
      <div className="shrink-0">
        <InitialIdentifier name={initialCallTargetName} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
            {initialCallTargetName}
          </p>
          {initialCallTargetRole && (
            <span className="shrink-0 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
              {initialCallTargetRole}
            </span>
          )}
        </div>
        {initialCallTargetPhone && (
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {initialCallTargetPhone}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-[11px] text-gray-500 dark:text-gray-400">
        {calledStats && (
          <CallStatsBadges accepted={calledStats.accepted} denied={calledStats.denied} />
        )}
        {callMethodUsed && CalledMethodIcon && (
          <span className="flex items-center gap-1">
            <CalledMethodIcon className="h-3 w-3" />
            {t(CALL_METHOD_LABEL_KEYS[callMethodUsed])}
          </span>
        )}
      </div>
    </div>
  ) : (
    <>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <SelectableDropdown
            fieldKey="who_to_call"
            dict={dict}
            value={effectiveCallTargetId}
            onSelect={(o) => setCallTargetId(o.id)}
          />
        </div>
        <SelectableFieldControl fieldKey="who_to_call" dict={dict} />
      </div>
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
      {callDurationSeconds !== null && (
        <p className="rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-light text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
          {t("call_duration_recorded")}: {formatCallDuration(callDurationSeconds)}
        </p>
      )}
      <div>
        <span className={fieldLabel}>{t("call_result")}</span>
        <OptionsDropdown
          options={resultOptions}
          value={resultadoId}
          onSelect={(o) => {
            setResultadoId(o.id);
            setResultAiFilled(false);
          }}
          placeholder={t("result_pending")}
          emptyLabel={t("result_pending")}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <span className={fieldLabel}>{t("call_note")}</span>
        <Textarea
          className={fillTextarea}
          value={notaLlamada}
          onChange={(e) => {
            setNotaLlamada(e.target.value);
            setNotaAiFilled(false);
          }}
        />
      </div>
    </>
  );

  const tagsFields = (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <BrandedMultiSelect
          size="sm"
          options={tagOptions.map((o) => ({
            value: o.id,
            label: o.name,
            description: o.description || undefined,
          }))}
          selectedValues={selectedTagIds}
          onSelectionChange={(ids) => {
            setSelectedTagIds(ids);
            setTagsAiFilled(false);
          }}
          placeholder={t("proto_tags_placeholder")}
          summaryLabel={(count) =>
            tr("symptoms.proto_tags_summary", dict, { count: String(count) })
          }
          emptyLabel={t("proto_tags_empty")}
        />
      </div>
      <SelectableFieldControl fieldKey="call_tags" dict={dict} />
    </div>
  );

  // Nothing here should be actionable until the operator has actually
  // written down what happened on the call.
  const noteEmpty = !notaLlamada.trim();

  const actions = (
    <ButtonGroup className="w-full">
      {onMakeAnotherCall && onSwitchTreatment ? (
        <CallSwitchDropdown
          dict={dict}
          onSaveAndCallAgain={handleSaveAndCallAgain}
          onSwitchOption={onSwitchTreatment}
          disableSwitchOptions={sinRespuesta}
          disabled={noteEmpty}
        />
      ) : (
        <Button
          color="light"
          disabled={noteEmpty}
          className="h-10 flex-1 rounded-r-none whitespace-nowrap"
          onClick={() => sendTeamsCall(telefonoLlamada)}
        >
          <BiLogoMicrosoftTeams className="mr-2 h-5 w-5" />
          {t("teams_call")}
          {t("teams_call2") ? ` ${t("teams_call2")}` : ""}
        </Button>
      )}
      <Button
        color={sinRespuesta ? "light" : "blue"}
        disabled={sinRespuesta || noteEmpty}
        className="h-10 flex-1 rounded-l-none whitespace-nowrap transition-colors duration-300"
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
        title={
          initialCallTargetName
            ? t("proto_section_who_called")
            : t("proto_section_who")
        }
      >
        {whoToCallFields}
      </FieldCard>

      {/* Debug call-center flow: the message was already shown as a
          read-only script to follow on the dialing step, so it doesn't get
          its own card again here — "Resultados" takes the full row instead
          of sharing it. The non-debug flow never had that step, so it still
          gets an editable message card. */}
      {initialCallTargetName ? (
        <FieldCard
          title={t("proto_section_results")}
          aiFilled={resultAiFilled || notaAiFilled}
          grow
          scrollBody={false}
        >
          {resultFields}
        </FieldCard>
      ) : (
        <BentoRow grow>
          <FieldCard title={t("proto_section_message")} grow>
            {messageField}
          </FieldCard>

          <FieldCard
            title={t("proto_section_results")}
            aiFilled={resultAiFilled || notaAiFilled}
            grow
            scrollBody={false}
          >
            {resultFields}
          </FieldCard>
        </BentoRow>
      )}

      <FieldCard title={t("proto_section_tags")} aiFilled={tagsAiFilled}>
        {tagsFields}
      </FieldCard>

      <StickyActions>{actions}</StickyActions>
    </BentoGrid>
  );
}
