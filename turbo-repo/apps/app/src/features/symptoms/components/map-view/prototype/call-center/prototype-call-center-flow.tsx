"use client";

/**
 * PROTOTYPE — debug variant of the "Llamar a…" menu entry. Same props as
 * `PrototypeCallDriver` (so `prototype-inline-form` can swap the two behind
 * the debug toggle) but wraps it in a small local flow instead of opening the
 * form straight away:
 *
 *   contacts (CallCenterMenu) → dialing (CallDialingStep) → form (PrototypeCallDriver)
 *
 * The contact list no longer picks a calling method itself — `CallDialingStep`
 * has its own row of per-channel call buttons (phone / WhatsApp / Meet /
 * Teams), all riding the same live-call flow (none of them are real
 * integrations, WhatsApp included — it's not a message-send step here). Every
 * step but the last is a plain step in this panel, not a modal — cancelling
 * the call just returns to the contact list. `CallDialingStep` shows
 * `messageToCommunicate` (the treatment template's default) as a read-only
 * script to follow rather than an editable field — it's still edited on the
 * final form — and the elapsed live-call time becomes the logged call
 * duration.
 */

import { useEffect, useState } from "react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { TreatmentsRequest } from "@/app/api/treatments/route.type";
import type { SelectableOption } from "@/features/settings-admin/selectables/types";
import type { SelectedOption } from "@/features/symptoms/types/side-info";
import PrototypeCallDriver from "../prototype-call-driver";
import CallCenterMenu from "./call-center-menu";
import CallDialingStep from "./call-dialing-step";
import { useCallHistory } from "./call-history-store";
import type { CallMethod } from "./call-method";

export type CallCenterFlowStep = "contacts" | "dialing" | "form";
type Step = CallCenterFlowStep;
/** What's reported upward via `onStepChange` — same as `Step`, except the
 *  "dialing" step splits into "dialing" (not started yet, back is allowed)
 *  and "calling" (live, back is locked) without needing a step of its own —
 *  `CallDialingStep` still owns that transition internally. */
export type CallCenterReportedStep = Step | "calling";

export default function PrototypeCallCenterFlow({
  dict,
  treatmentData,
  messageToCommunicate,
  setMessageToCommunicate,
  treatmentRequest,
  setTreatmentRequest,
  setIsMenuOpen,
  onStepChange,
  onSwitchTreatment,
}: {
  dict: I18nRecord;
  treatmentData: TreatmentsGeneralResponseItem | null;
  messageToCommunicate: string;
  setMessageToCommunicate: (message: string) => void;
  treatmentRequest: TreatmentsRequest;
  setTreatmentRequest: (treatmentRequest: TreatmentsRequest) => void;
  setIsMenuOpen: (isMenuOpen: boolean) => void;
  /** Lets the map container (and the panel header) size/label per step —
   *  narrower + a different title while dialing, back to its usual width and
   *  a "results" title on the final treatment form. */
  onStepChange?: (step: CallCenterReportedStep) => void;
  /** Passed straight through to the final form's `CallSwitchDropdown` — see
   *  `PrototypeCallDriver`'s prop of the same name. */
  onSwitchTreatment?: (option: SelectedOption) => void;
}) {
  const [step, setStep] = useState<Step>("contacts");
  const [dialingStarted, setDialingStarted] = useState(false);
  const [activeContact, setActiveContact] = useState<SelectableOption | null>(null);
  const [activePersonName, setActivePersonName] = useState("");
  const [activeRole, setActiveRole] = useState("");
  const [activePhone, setActivePhone] = useState("");
  const [activeAllowedMethods, setActiveAllowedMethods] = useState<
    CallMethod[] | undefined
  >(undefined);
  const [callDurationSeconds, setCallDurationSeconds] = useState<number | null>(null);
  const [callMethodUsed, setCallMethodUsed] = useState<CallMethod | null>(null);
  // Real (not mocked) last-call time per contact actually called — persisted
  // (see `call-history-store.ts`) so the contacts list still shows it as
  // green/sorted-last after this flow unmounts, e.g. once "Finalizar
  // Tratamiento" navigates away, rather than only for this flow instance.
  const { history: recentCallTimes, recordCall } = useCallHistory();

  useEffect(() => {
    const reported: CallCenterReportedStep =
      step === "dialing" && dialingStarted ? "calling" : step;
    onStepChange?.(reported);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, dialingStarted]);

  const handleCall = (
    contact: SelectableOption,
    phone: string,
    personName: string,
    role: string,
    allowedMethods?: CallMethod[]
  ) => {
    setActiveContact(contact);
    setActivePersonName(personName);
    setActiveRole(role);
    setActivePhone(phone);
    setActiveAllowedMethods(allowedMethods);
    setDialingStarted(false);
    setStep("dialing");
  };

  const handleCancelCall = () => {
    setDialingStarted(false);
    setStep("contacts");
  };

  const handleConfirmCall = (elapsedSeconds: number, method: CallMethod) => {
    setCallDurationSeconds(elapsedSeconds);
    setCallMethodUsed(method);
    if (activeContact) {
      recordCall(activeContact.id);
    }
    setStep("form");
  };

  /** "Hacer otra llamada" from the results form — back to "who to call",
   *  same as cancelling a live call, not straight back into dialing. */
  const handleMakeAnotherCall = handleCancelCall;

  return (
    <>
      {step === "contacts" && (
        <CallCenterMenu
          dict={dict}
          treatmentData={treatmentData}
          onCall={handleCall}
          recentCallTimes={recentCallTimes}
        />
      )}

      {step === "dialing" && (
        <CallDialingStep
          dict={dict}
          contactId={activeContact?.id}
          contactName={activePersonName}
          contactRole={activeRole}
          contactPhone={activePhone}
          allowedMethods={activeAllowedMethods}
          reason={messageToCommunicate}
          onCancel={handleCancelCall}
          onConfirm={handleConfirmCall}
          onStartedChange={setDialingStarted}
        />
      )}

      {step === "form" && (
        <PrototypeCallDriver
          dict={dict}
          treatmentData={treatmentData}
          messageToCommunicate={messageToCommunicate}
          setMessageToCommunicate={setMessageToCommunicate}
          treatmentRequest={treatmentRequest}
          setTreatmentRequest={setTreatmentRequest}
          setIsMenuOpen={setIsMenuOpen}
          initialCallTargetId={activeContact?.id}
          initialCallTargetName={activePersonName}
          initialCallTargetRole={activeRole}
          initialCallTargetPhone={activePhone}
          callMethodUsed={callMethodUsed ?? undefined}
          // Disabled for now — see PrototypeCallDriver's `aiAssistEnabled` doc.
          aiAssistEnabled={false}
          callDurationSeconds={callDurationSeconds}
          onMakeAnotherCall={handleMakeAnotherCall}
          onSwitchTreatment={onSwitchTreatment}
        />
      )}
    </>
  );
}
