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
import PrototypeCallDriver from "../prototype-call-driver";
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

export default function PrototypeCallCenterFlow({
  dict,
  treatmentData,
  messageToCommunicate,
  setIsMenuOpen,
  onStepChange,
  onSwitchTreatment,
}: Readonly<{
  dict: I18nRecord;
  treatmentData: TreatmentsGeneralResponseItem | null;
  messageToCommunicate: string;
  setIsMenuOpen: (isMenuOpen: boolean) => void;
  /** Lets the map container (and the panel header) size/label per step. */
  onStepChange?: (step: CallCenterReportedStep) => void;
  /** Passed straight through to the final form's `CallSwitchDropdown`. */
  onSwitchTreatment?: (option: SelectedOption) => void;
}>) {
  const [step, setStep] = useState<Step>("contacts");
  const [dialingStarted, setDialingStarted] = useState(false);
  const [target, setTarget] = useState<CallTarget | null>(null);
  const [callDurationSeconds, setCallDurationSeconds] = useState<number | null>(null);
  const [callMethodUsed, setCallMethodUsed] = useState<CallMethod | null>(null);

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
    setStep("form");
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
          onMakeAnotherCall={handleCancelCall}
          onSwitchTreatment={onSwitchTreatment}
        />
      )}
    </>
  );
}
