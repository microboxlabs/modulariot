"use client";

/**
 * PROTOTYPE — the "Llamar a…" flow inside the treatment panel:
 *
 *   contacts (CallCenterMenu) → dialing (CallDialingStep) → form (PrototypeCallDriver)
 *
 * `CallDialingStep` has one call button per channel (phone / WhatsApp / Meet /
 * Teams); none of them is a real integration. The elapsed live-call time
 * becomes the logged call duration. The call is recorded in the Control Tower
 * treatment episode when the results form is saved.
 */

import { useEffect, useState } from "react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import type { SelectedOption } from "@/features/symptoms/types/side-info";
import PrototypeCallDriver, {
  type CallFormDraft,
} from "../prototype-call-driver";
import CallCenterMenu from "./call-center-menu";
import CallDialingStep from "./call-dialing-step";
import { formatChileanPhone } from "./format-chilean-phone";
import type { CallMethod } from "./call-method";
import type { CallTarget } from "./call-targets";

export type CallCenterFlowStep = "contacts" | "dialing" | "form";
type Step = CallCenterFlowStep;
/** What's reported upward via `onStepChange` — same as `Step`, except the
 *  "dialing" step splits into "dialing" (not started yet, back is allowed)
 *  and "calling" (live, back is locked). */
export type CallCenterReportedStep = Step | "calling";

/** Enough of a completed call to redraw its results form after this flow
 *  unmounts (the operator switched to another treatment type and came back).
 *  Held by `prototype-inline-form.tsx` and handed back as `resumeSnapshot`. */
export type CallSnapshot = {
  target: CallTarget;
  durationSeconds: number | null;
  methodUsed: CallMethod | null;
};

export default function PrototypeCallCenterFlow({
  dict,
  treatmentData,
  messageToCommunicate,
  setIsMenuOpen,
  onStepChange,
  onSwitchTreatment,
  resumeSnapshot,
  onCallConfirmed,
  onRepeatCallChange,
  formDraft,
  onFormDraftChange,
}: Readonly<{
  dict: I18nRecord;
  treatmentData: TreatmentsGeneralResponseItem | null;
  messageToCommunicate: string;
  setIsMenuOpen: (isMenuOpen: boolean) => void;
  /** Lets the map container (and the panel header) size/label per step. */
  onStepChange?: (step: CallCenterReportedStep) => void;
  /** Passed straight through to the final form's `CallSwitchDropdown`. */
  onSwitchTreatment?: (option: SelectedOption) => void;
  /** When set, this mount starts on the "form" step for this call instead of
   *  the contact list. */
  resumeSnapshot?: CallSnapshot | null;
  /** Fired when a call is confirmed (dialing → form). */
  onCallConfirmed?: (snapshot: CallSnapshot) => void;
  /** Fired true when the operator starts another call from the results form. */
  onRepeatCallChange?: (isRepeatCall: boolean) => void;
  /** Last-known results-form state, held by the parent so it survives this
   *  flow unmounting. */
  formDraft?: CallFormDraft | null;
  onFormDraftChange?: (draft: CallFormDraft | null) => void;
}>) {
  const [step, setStep] = useState<Step>(resumeSnapshot ? "form" : "contacts");
  const [dialingStarted, setDialingStarted] = useState(false);
  const [target, setTarget] = useState<CallTarget | null>(
    resumeSnapshot?.target ?? null
  );
  const [callDurationSeconds, setCallDurationSeconds] = useState<number | null>(
    resumeSnapshot?.durationSeconds ?? null
  );
  const [callMethodUsed, setCallMethodUsed] = useState<CallMethod | null>(
    resumeSnapshot?.methodUsed ?? null
  );

  useEffect(() => {
    const reported: CallCenterReportedStep =
      step === "dialing" && dialingStarted ? "calling" : step;
    onStepChange?.(reported);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, dialingStarted]);

  const handleCall = (next: CallTarget) => {
    setTarget(next);
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
    onFormDraftChange?.(null);
    if (target) {
      onCallConfirmed?.({
        target,
        durationSeconds: elapsedSeconds,
        methodUsed: method,
      });
    }
    setStep("form");
  };

  /** "Hacer otra llamada" from the results form: back to "who to call", and
   *  the header reads "Llamar → Llamar de nuevo" until that call is confirmed. */
  const handleMakeAnotherCall = () => {
    onRepeatCallChange?.(true);
    handleCancelCall();
  };

  return (
    <>
      {step === "contacts" && (
        <CallCenterMenu dict={dict} treatmentData={treatmentData} onCall={handleCall} />
      )}

      {step === "dialing" && target && (
        <CallDialingStep
          dict={dict}
          stats={target.stats}
          contactName={target.personName}
          contactRole={target.role}
          contactPhone={formatChileanPhone(target.phone)}
          allowedMethods={target.methods}
          reason={messageToCommunicate}
          onCancel={handleCancelCall}
          onConfirm={handleConfirmCall}
          onStartedChange={setDialingStarted}
        />
      )}

      {step === "form" && target && (
        <PrototypeCallDriver
          dict={dict}
          treatmentData={treatmentData}
          messageToCommunicate={messageToCommunicate}
          setIsMenuOpen={setIsMenuOpen}
          callTarget={target}
          callMethodUsed={callMethodUsed ?? undefined}
          // Disabled for now — see PrototypeCallDriver's `aiAssistEnabled` doc.
          aiAssistEnabled={false}
          callDurationSeconds={callDurationSeconds}
          onMakeAnotherCall={handleMakeAnotherCall}
          onSwitchTreatment={onSwitchTreatment}
          initialDraft={formDraft}
          onDraftChange={onFormDraftChange}
        />
      )}
    </>
  );
}
