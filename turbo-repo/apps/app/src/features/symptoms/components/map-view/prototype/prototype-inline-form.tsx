"use client";

import React, { useEffect, useState } from "react";
import { HiChevronLeft } from "react-icons/hi";
import { ToggleSwitch } from "flowbite-react";

import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { tr } from "@/features/i18n/tr.service";

import { SympthomTemplateResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import PrototypeCallCenterFlow, {
  type CallCenterReportedStep,
} from "./call-center/prototype-call-center-flow";
import { useFieldEditorMode } from "./call-center/field-editor-mode";
import WhatsAppContact from "../../blurrable-stepped-menu/menus/whatsapp-contact/whatsapp-contact";
import { FaPhoneAlt, FaWhatsapp } from "react-icons/fa";
import PrototypeIgnoreCondition from "./prototype-ignore-condition";
import PrototypeInvalidateSymptom from "./prototype-invalidate-symptom";
import { TiDelete } from "react-icons/ti";
import { MdBlock } from "react-icons/md";
import type { SelectedOption } from "@/features/symptoms/types/side-info";
import { ShowNotification } from "@/features/notifications/notification";
import type { TowerTreatmentType } from "@/features/symptoms/control-tower/control-tower-api";
import { TreatmentSessionProvider, useTreatmentSession } from "./treatment-session";

/** Panel header title per call-center debug-flow step — overrides the menu's
 *  static title while that flow is on screen. */
const CALL_FLOW_TITLE_KEYS: Record<CallCenterReportedStep, string> = {
  contacts: "proto_call_title_contacts",
  dialing: "proto_call_title_dialing",
  calling: "proto_call_title_calling",
  form: "proto_call_title_form",
};

interface InlineFormProps {
  setIsMenuOpen: (isMenuOpen: boolean) => void;
  isMenuOpen: boolean;
  dict: I18nRecord;
  selectedOption: string;
  /** Lets the call flow's own `CallSwitchDropdown` jump straight to another
   *  treatment form (e.g. "Ignorar condición") without leaving the panel —
   *  see `handleSwitchFromCall` below. */
  setSelectedOption: (option: SelectedOption) => void;
  treatmentData: TreatmentsGeneralResponseItem | null;
  treatments_templates: SympthomTemplateResponse | null;
  /** Lets the map container size the panel per call-flow step. */
  onCallFlowStepChange?: (step: CallCenterReportedStep | null) => void;
}

/**
 * PROTOTYPE — inline variant of `blurrable-stepped-menu/symptom-form.tsx`.
 *
 * Rendered *inside* the timeline side panel instead of a fixed full-screen
 * blurred modal. Mirrors the bento document viewer morph
 * (`task-bento-form/bento-media-section.tsx`), where the panel grows and swaps
 * its content in place rather than opening a dialog. Every form in the panel
 * records into one Control Tower treatment episode (see `treatment-session.tsx`).
 */
export default function PrototypeInlineForm(props: InlineFormProps) {
  const { treatmentData } = props;
  return (
    <TreatmentSessionProvider
      symptomId={treatmentData?.symptom_info?.id}
      assetId={treatmentData?.trip_info?.asset_id ?? undefined}
      tripId={treatmentData?.trip_info?.trip_id ?? undefined}
    >
      <InlineFormBody {...props} />
    </TreatmentSessionProvider>
  );
}

function InlineFormBody({
  setIsMenuOpen,
  isMenuOpen,
  dict,
  selectedOption,
  setSelectedOption,
  treatmentData,
  treatments_templates,
  onCallFlowStepChange,
}: InlineFormProps) {
  const session = useTreatmentSession();
  const [fieldEditorMode, setFieldEditorMode] = useFieldEditorMode();

  // Mirrors the call-center flow's reported step locally so the header can
  // title/lock itself off it — `onCallFlowStepChange` alone only reaches the
  // map container, which doesn't need this component to also hold it.
  const [callFlowStep, setCallFlowStep] = useState<CallCenterReportedStep | null>(
    null
  );
  // Bumped to force-remount `PrototypeCallCenterFlow`, discarding all its
  // internal state — the only way to send "back to contacts" from outside it,
  // since it owns that step itself.
  const [callCenterResetKey, setCallCenterResetKey] = useState(0);

  const isCallDriverDebugFlow = selectedOption === "call_driver";
  // Once the call has gone live (or the results form is up), there's no way
  // back until the treatment is actually saved.
  const backLocked =
    isCallDriverDebugFlow && (callFlowStep === "calling" || callFlowStep === "form");

  // Set when the operator jumps straight from the call form to a different
  // treatment type via `CallSwitchDropdown` (see `handleSwitchFromCall`) —
  // prefixes that other form's header with "Llamada →" so it's clear this
  // treatment started out as a call. Cleared once back on "call_driver"
  // itself or the panel closes, so it never bleeds into a later, unrelated
  // visit to the same form picked normally from "Otras opciones".
  const [cameFromCall, setCameFromCall] = useState(false);
  useEffect(() => {
    if (selectedOption === "call_driver" || !isMenuOpen) {
      setCameFromCall(false);
    }
  }, [selectedOption, isMenuOpen]);

  // Only the call-center debug flow has steps that affect panel width — clear
  // it whenever that flow isn't the one on screen, so a stale "dialing"/"form"
  // step from a previous visit doesn't stick around sizing the panel.
  useEffect(() => {
    if (!isCallDriverDebugFlow) {
      onCallFlowStepChange?.(null);
      setCallFlowStep(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOption]);

  // The native "leave site?" prompt covers what in-app back-button locking
  // can't: a reload (F5), closing the tab, or typing a new URL.
  useEffect(() => {
    if (!backLocked) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [backLocked]);

  const handleCallFlowStepChange = (step: CallCenterReportedStep) => {
    setCallFlowStep(step);
    onCallFlowStepChange?.(step);
  };

  const handleBackClick = () => {
    if (isCallDriverDebugFlow && callFlowStep === "dialing") {
      // Not-yet-started dialing step: back means "who to call", not "leave
      // this menu" — remounting the flow drops it back to its first step.
      setCallCenterResetKey((k) => k + 1);
      return;
    }
    setIsMenuOpen(false);
  };

  // call driver
  const messageToCommunicate = treatments_templates?.data?.message ?? "";

  // ignore condition
  const [duration, setDuration] = useState<number>(0);
  const [scope, setScope] = useState<string>("");

  // invalidate symptom
  const [reason, setReason] = useState<string>("");

  /** Opens (or resumes) the panel's treatment episode as `type`. */
  const openEpisode = (type: TowerTreatmentType) => {
    session.ensureOpen(type).catch((error: unknown) =>
      ShowNotification({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      })
    );
  };

  // Lets the call flow's `CallSwitchDropdown` jump to a different treatment
  // form without leaving the panel. The episode stays the same one — the
  // switched-to form records its decision into it.
  const handleSwitchFromCall = (option: SelectedOption) => {
    setCameFromCall(true);
    setSelectedOption(option);
  };

  const menus = {
    call_driver: {
      title: (dict.symptoms as I18nRecord).call_driver,
      preactions: () => openEpisode("CALL"),
      component: (
        <div className="w-full h-full flex flex-row items-start justify-center">
          <PrototypeCallCenterFlow
            key={callCenterResetKey}
            dict={dict as I18nRecord}
            treatmentData={treatmentData}
            messageToCommunicate={messageToCommunicate}
            setIsMenuOpen={setIsMenuOpen}
            onStepChange={handleCallFlowStepChange}
            onSwitchTreatment={handleSwitchFromCall}
          />
        </div>
      ),
      icon: <FaPhoneAlt className="h-5 w-5" />,
    },
    contact_via_whatsapp: {
      title: (dict.symptoms as I18nRecord).contact_via_whatsapp,
      // No preaction: sending a WhatsApp doesn't open a treatment.
      preactions: undefined,
      component: (
        // key by trip so the form re-seeds its defaults if the selected treatment changes.
        <WhatsAppContact
          key={treatmentData?.trip_info?.trip_id ?? "no-trip"}
          dict={dict}
          treatmentData={treatmentData}
          setIsMenuOpen={setIsMenuOpen}
        />
      ),
      icon: <FaWhatsapp className="h-6 w-6" />,
    },
    ignore_condition: {
      title: (dict.symptoms as I18nRecord).ignore_condition,
      preactions: () => openEpisode("IGNORE_CONDITION"),
      component: (
        <PrototypeIgnoreCondition
          dict={dict as I18nRecord}
          treatmentData={treatmentData}
          setDuration={setDuration}
          duration={duration}
          scope={scope}
          setScope={setScope}
          setIsMenuOpen={setIsMenuOpen}
        />
      ),
      icon: <TiDelete className="h-8 w-8" />,
    },
    invalidate_symptom: {
      title: (dict.symptoms as I18nRecord).invalidate_symptom,
      preactions: () => openEpisode("INVALIDATE_SYMPTOM"),
      component: (
        <PrototypeInvalidateSymptom
          dict={dict}
          treatmentData={treatmentData}
          reason={reason}
          setReason={setReason}
          setIsMenuOpen={setIsMenuOpen}
        />
      ),
      icon: <MdBlock className="h-7 w-7" />,
    },
  };

  useEffect(() => {
    if (isMenuOpen) {
      menus[selectedOption as keyof typeof menus]?.preactions?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMenuOpen]);

  const selectedMenu = menus[selectedOption as keyof typeof menus];
  if (!selectedMenu) return null;

  const dictSy = dict.symptoms as I18nRecord;
  const headerTitle =
    isCallDriverDebugFlow && callFlowStep
      ? tr(`symptoms.${CALL_FLOW_TITLE_KEYS[callFlowStep]}`, dict)
      : cameFromCall
        ? `${tr("symptoms.call_origin_label", dict)} → ${selectedMenu.title as string}`
        : (selectedMenu.title as string);

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-gray-900 rounded-lg overflow-hidden">
      {/* Header — fixed, separated from the body by a bar */}
      <div className="shrink-0 flex items-center gap-1.5 border-b border-gray-200 dark:border-gray-700 px-3 py-2">
        <button
          type="button"
          onClick={handleBackClick}
          disabled={backLocked}
          aria-label={dictSy.proto_back as string}
          className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
        >
          <HiChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-medium text-gray-900 dark:text-white">
          {headerTitle}
        </h1>
        <div className="ml-auto flex shrink-0 items-center gap-4">
          <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
            {fieldEditorMode
              ? tr("symptoms.field_editor_mode_on", dict)
              : tr("symptoms.field_editor_mode_off", dict)}
            <ToggleSwitch
              checked={fieldEditorMode}
              onChange={setFieldEditorMode}
              title={tr("symptoms.field_editor_mode_toggle", dict)}
            />
          </label>
        </div>
      </div>
      {/* Body — a fixed-height bento, no scroll (see prototype-form-kit). */}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-3 bg-gray-50 dark:bg-gray-900">
        {selectedMenu.component}
      </div>
    </div>
  );
}
