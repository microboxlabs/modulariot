"use client";

import { Button, ButtonGroup, Textarea } from "flowbite-react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { useState } from "react";
import BrandedMultiSelect from "@/features/task-forms/components/task-confirm-modal/branded-multi-select";
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
  SelectableFieldControl,
  OptionsDropdown,
  useSelectableOptions,
  GeneralInfoGrid,
  fieldLabel,
  fillTextarea,
} from "./prototype-form-kit";
import type { SelectableOption } from "@/features/settings-admin/selectables/types";
import type { SelectedOption } from "@/features/symptoms/types/side-info";
import { CALL_METHOD_ICONS, CALL_METHOD_LABEL_KEYS, type CallMethod } from "./call-center/call-method";
import CallStatsBadges from "./call-center/call-stats-badges";
import CallSwitchDropdown from "./call-center/call-switch-dropdown";
import { toApiMethod, type CallTarget } from "./call-center/call-targets";
import { formatChileanPhone } from "./call-center/format-chilean-phone";
import { useTreatmentSession } from "./treatment-session";

/** Fixed content, not a Selectable — the same list the older form always had.
 *  The ids match the Control Tower `call_result` defaults. The last two mean
 *  "no answer". */
const CALL_RESULT_OPTION_IDS = [
  "result_commits",
  "result_corrected",
  "result_rejects",
  "result_no_answer",
  "result_voicemail",
];
const NO_ANSWER_IDS = new Set(CALL_RESULT_OPTION_IDS.slice(-2));

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
 * PROTOTYPE — the call results form, after a call placed from the contact
 * list. Saving records a CALL action in the panel's treatment episode:
 * "Guardar y hacer otra llamada" keeps the episode open and goes back to the
 * contact list; "Finalizar tratamiento" also closes it.
 */
export default function PrototypeCallDriver({
  dict,
  treatmentData,
  messageToCommunicate,
  setIsMenuOpen,
  callTarget,
  callMethodUsed,
  aiAssistEnabled = false,
  callDurationSeconds = null,
  onMakeAnotherCall,
  onSwitchTreatment,
}: Readonly<{
  dict: I18nRecord;
  treatmentData: TreatmentsGeneralResponseItem | null;
  messageToCommunicate: string;
  setIsMenuOpen: (isMenuOpen: boolean) => void;
  /** Who was called, chosen in the contact list step. */
  callTarget: CallTarget;
  /** Which channel the call went through. */
  callMethodUsed?: CallMethod;
  /** Pre-fill outcome/note/tags "heard" on the call, shown with the harness
   *  mark until the operator edits them. Off for now. */
  aiAssistEnabled?: boolean;
  /** Elapsed time from the live-call step. */
  callDurationSeconds?: number | null;
  /** Back to "who to call" after "Guardar y hacer otra llamada" saves. */
  onMakeAnotherCall?: () => void;
  /** Switches the panel to another treatment form in the same episode. */
  onSwitchTreatment?: (option: SelectedOption) => void;
}>) {
  const dictSy = dict.symptoms as I18nRecord;
  const t = (k: string) => dictSy[k] as string;
  const router = useRouter();
  const session = useTreatmentSession();

  const resultOptions: SelectableOption[] = CALL_RESULT_OPTION_IDS.map((id) => ({
    id,
    name: t(id),
    description: "",
  }));
  const { options: tagOptions } = useSelectableOptions("call_tags");

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(() =>
    aiAssistEnabled && tagOptions[0] ? [tagOptions[0].id] : []
  );
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
  const [isSaving, setIsSaving] = useState(false);

  const resultadoLabel = resultOptions.find((o) => o.id === resultadoId)?.name ?? "";
  const sinRespuesta = NO_ANSWER_IDS.has(resultadoId);

  /** Records this call in the episode. */
  const recordCall = () =>
    session.addAction({
      kind: "CALL",
      contactId: callTarget.contactId,
      contactName: callTarget.personName,
      contactRole: callTarget.role || undefined,
      contactPhone: callTarget.phone || undefined,
      method: callMethodUsed ? toApiMethod(callMethodUsed) : undefined,
      outcomeKey: resultadoId || undefined,
      outcomeLabel: resultadoLabel || undefined,
      answered: resultadoId ? !sinRespuesta : undefined,
      durationSeconds: callDurationSeconds ?? undefined,
      message: messageToCommunicate.trim() || undefined,
      note: notaLlamada.trim() || undefined,
      tags: selectedTagIds,
    });

  const runSave = async (afterSave: () => Promise<void> | void) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await recordCall();
      await afterSave();
      ShowNotification({ type: "success", message: t("treatment_saved") });
    } catch (error) {
      ShowNotification({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () =>
    runSave(async () => {
      await session.finish("resolved");
      setIsMenuOpen(false);
      router.push("/symptoms");
    });

  const handleSaveAndCallAgain = () => runSave(() => onMakeAnotherCall?.());

  /* ---------- field fragments ---------- */

  const CalledMethodIcon = callMethodUsed ? CALL_METHOD_ICONS[callMethodUsed] : null;

  const whoWasCalled = (
    <div className="flex items-center gap-3">
      <div className="shrink-0">
        <InitialIdentifier name={callTarget.personName || "?"} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
            {callTarget.personName}
          </p>
          {callTarget.role && (
            <span className="shrink-0 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
              {callTarget.role}
            </span>
          )}
        </div>
        {callTarget.phone && (
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {formatChileanPhone(callTarget.phone)}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-[11px] text-gray-500 dark:text-gray-400">
        {callTarget.stats && (
          <CallStatsBadges
            accepted={callTarget.stats.accepted}
            denied={callTarget.stats.denied}
          />
        )}
        {callMethodUsed && CalledMethodIcon && (
          <span className="flex items-center gap-1">
            <CalledMethodIcon className="h-3 w-3" />
            {t(CALL_METHOD_LABEL_KEYS[callMethodUsed])}
          </span>
        )}
      </div>
    </div>
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
          disabled={noteEmpty || isSaving}
        />
      ) : (
        <Button
          color="light"
          disabled={noteEmpty}
          className="h-10 flex-1 rounded-r-none whitespace-nowrap"
          onClick={() => sendTeamsCall(callTarget.phone)}
        >
          <BiLogoMicrosoftTeams className="mr-2 h-5 w-5" />
          {t("teams_call")}
          {t("teams_call2") ? ` ${t("teams_call2")}` : ""}
        </Button>
      )}
      <Button
        color={sinRespuesta ? "light" : "blue"}
        disabled={sinRespuesta || noteEmpty || isSaving}
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
        <GeneralInfoGrid dict={dict} treatmentData={treatmentData} />
      </PlainSection>

      <FieldCard title={t("proto_section_who_called")}>{whoWasCalled}</FieldCard>

      <FieldCard
        title={t("proto_section_results")}
        aiFilled={resultAiFilled || notaAiFilled}
        grow
        scrollBody={false}
      >
        {resultFields}
      </FieldCard>

      <FieldCard title={t("proto_section_tags")} aiFilled={tagsAiFilled}>
        {tagsFields}
      </FieldCard>

      <StickyActions>{actions}</StickyActions>
    </BentoGrid>
  );
}
