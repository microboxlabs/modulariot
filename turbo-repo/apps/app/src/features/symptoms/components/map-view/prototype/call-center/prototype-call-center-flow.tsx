"use client";

import { phoneForMethod } from "./call-targets";

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

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { mutate } from "swr";
import {
  contactsKey,
  revalidateCase,
} from "@/features/symptoms/control-tower/control-tower-api";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { TreatmentsRequest } from "@/app/api/treatments/route.type";
import type { SelectedOption } from "@/features/symptoms/types/side-info";
import PrototypeCallDriver, {
  type CallFormDraft,
} from "../prototype-call-driver";
import CallCenterMenu, { type CallScript } from "./call-center-menu";
import CallDialingStep from "./call-dialing-step";
import type { TelephonyCallResult } from "./telnyx-call";
import { useTelephony } from "@/features/symptoms/control-tower/telephony-api";
import { readyTeamsLine } from "@/features/symptoms/control-tower/telephony-api.types";
import type { CallMethod } from "./call-method";
import type { CallTarget } from "./call-targets";
import {
  isEngineCase,
  type EngineTreatmentProgress,
} from "../prototype-api-guard";
import {
  useCallSession,
  type ActiveCall,
  type CallContext,
} from "./call-session";

export type CallCenterFlowStep = "contacts" | "dialing" | "form";
/** What's reported upward via `onStepChange` — same as `CallCenterFlowStep`, except the
 *  "dialing" step splits into "dialing" (not started yet, back is allowed)
 *  and "calling" (live, back is locked) without needing a step of its own —
 *  `CallDialingStep` still owns that transition internally. */
export type CallCenterReportedStep = CallCenterFlowStep | "calling";

/** Enough of a completed call's context to redraw the "form" step exactly as
 *  it looked right when confirmed — captured by `onCallConfirmed` and handed
 *  back in as `resumeSnapshot` so `prototype-inline-form.tsx` can send the
 *  operator straight back to that results form (not the contact list) after
 *  they've switched away to a different treatment type and hit back. This
 *  flow itself unmounts on that switch (a different menu's component takes
 *  its place entirely), so nothing captured here can live in this
 *  component's own state — it has to survive one level up. */
export type CallSnapshot = {
  script?: CallScript | null;
  defaultMessage?: string;
  contact: CallTarget | null;
  personName: string;
  role: string;
  phone: string;
  allowedMethods?: CallMethod[];
  durationSeconds: number | null;
  methodUsed: CallMethod | null;
  /** What the telephony provider reported; absent when the call was timed by hand. */
  telephony?: TelephonyCallResult | null;
};

/** The case page with the call panel open, to come back to from the call bar. */
function caseHref(pathname: string | null): string | null {
  if (!pathname || globalThis.window === undefined) return null;
  const params = new URLSearchParams(globalThis.window.location.search);
  params.set("open", "1");
  params.set("menu", "call_driver");
  return `${pathname}?${params.toString()}`;
}

function caseLabelOf(treatmentData: TreatmentsGeneralResponseItem | null) {
  const plate = treatmentData?.trip_info?.asset_id?.trim();
  const id = treatmentData?.symptom_info?.id;
  return plate || (id == null ? null : `#${id}`);
}

/** A call of this case kept by the call session, rebuilt as the flow's starting point. */
function snapshotFromCall(call: ActiveCall): CallSnapshot {
  const target = call.context.target;
  return {
    script: call.context.script,
    defaultMessage: call.context.defaultMessage,
    contact: target,
    personName: call.contactName,
    role: call.contactRole,
    phone: target
      ? phoneForMethod(target, call.method)
      : (call.calleeNumber ?? ""),
    allowedMethods: target?.methods,
    durationSeconds: call.result?.durationSeconds ?? null,
    methodUsed: call.result?.method ?? null,
    telephony: call.result?.telephony ?? null,
  };
}

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
  resumeSnapshot,
  onCallConfirmed,
  onRepeatCallChange,
  formDraft,
  onFormDraftChange,
  skippedTo,
  onSkip,
  onCallStart,
}: Readonly<{
  skippedTo: number | null;
  onSkip: (step: number) => void;
  /** "Llamar" was pressed on a contact: the treatment must be open by now. */
  onCallStart?: () => Promise<boolean>;
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
  /** When set, this mount starts straight on the "form" step showing this
   *  call's context instead of the contact list — used when the operator
   *  switched away from an already-completed call and hit back. */
  resumeSnapshot?: CallSnapshot | null;
  /** Fired the moment a call is confirmed (dialing → form), so the parent can
   *  hold onto enough context to resume here later even after this whole
   *  flow unmounts. */
  onCallConfirmed?: (snapshot: CallSnapshot) => void;
  /** Fired true the moment the operator starts a second (or later) call via
   *  "Guardar y hacer otra llamada" — see `handleMakeAnotherCall`. */
  onRepeatCallChange?: (isRepeatCall: boolean) => void;
  /** Last-known results-form state, held by the parent so it survives this
   *  flow unmounting — handed to the form to restore. */
  formDraft?: CallFormDraft | null;
  onFormDraftChange?: (draft: CallFormDraft | null) => void;
}>) {
  const session = useCallSession();
  const treatmentProgress = useRef<EngineTreatmentProgress>({});
  const pathname = usePathname();
  const caseId =
    treatmentData?.symptom_info?.id == null
      ? null
      : String(treatmentData.symptom_info.id);
  // A call of this case still open in the call session (the panel was closed,
  // the operator went to another page, or reloaded): start where it is.
  const [sessionCall] = useState(() =>
    !resumeSnapshot &&
    session.call &&
    session.call.status !== "failed" &&
    session.call.context.caseId === caseId
      ? session.call
      : null
  );
  const restoredEnded = sessionCall?.status === "ended";
  const resume =
    resumeSnapshot ?? (sessionCall ? snapshotFromCall(sessionCall) : null);
  const [step, setStep] = useState<CallCenterFlowStep>(() => {
    if (resumeSnapshot || restoredEnded) return "form";
    return sessionCall ? "dialing" : "contacts";
  });
  const [dialingStarted, setDialingStarted] = useState(false);
  const [adoptedSessionKey, setAdoptedSessionKey] = useState(sessionCall?.key);
  const [activeContact, setActiveContact] = useState<CallTarget | null>(
    resume?.contact ?? null
  );
  const [activePersonName, setActivePersonName] = useState(
    resume?.personName ?? ""
  );
  const [activeRole, setActiveRole] = useState(resume?.role ?? "");
  const [activePhone, setActivePhone] = useState(resume?.phone ?? "");
  const [activeAllowedMethods, setActiveAllowedMethods] = useState<
    CallMethod[] | undefined
  >(resume?.allowedMethods);
  const [callDurationSeconds, setCallDurationSeconds] = useState<number | null>(
    resume?.durationSeconds ?? null
  );
  const [callMethodUsed, setCallMethodUsed] = useState<CallMethod | null>(
    resume?.methodUsed ?? null
  );
  const [callTelephony, setCallTelephony] =
    useState<TelephonyCallResult | null>(resume?.telephony ?? null);
  // Only the Control Tower save path persists provider call results.
  const providerCalls = isEngineCase(treatmentRequest);
  const { data: telephony, error: telephonyError } =
    useTelephony(providerCalls);

  useEffect(() => {
    const reported: CallCenterReportedStep =
      step === "dialing" && dialingStarted ? "calling" : step;
    onStepChange?.(reported);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, dialingStarted]);

  const defaultMessage = useRef(resume?.defaultMessage ?? messageToCommunicate);
  const [activeScript, setActiveScript] = useState<CallScript | null>(
    resume?.script ?? null
  );

  // The restored call's script replaces the treatment's default message
  // again, and an ended call reaches the parent as confirmed.
  useEffect(() => {
    if (sessionCall?.context.message)
      setMessageToCommunicate(sessionCall.context.message);
    if (restoredEnded && resume) onCallConfirmed?.(resume);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A call of this case that shows up after mounting (restored after a
  // reload, or started before the panel finished loading) takes over the
  // contact list.
  const adopt = (call: ActiveCall) => {
    setAdoptedSessionKey(call.key);
    const snap = snapshotFromCall(call);
    defaultMessage.current = snap.defaultMessage ?? defaultMessage.current;
    setActiveScript(snap.script ?? null);
    if (call.context.message) setMessageToCommunicate(call.context.message);
    setActiveContact(snap.contact);
    setActivePersonName(snap.personName);
    setActiveRole(snap.role);
    setActivePhone(snap.phone);
    setActiveAllowedMethods(snap.allowedMethods);
    setDialingStarted(false);
    setStep("dialing");
  };
  const lateCall =
    step === "contacts" &&
    session.call &&
    session.call.status !== "failed" &&
    session.call.context.caseId === caseId
      ? session.call
      : null;
  useEffect(() => {
    if (lateCall) adopt(lateCall);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lateCall?.id]);

  const callContext: Partial<CallContext> = {
    caseId,
    caseHref: caseHref(pathname),
    caseLabel: caseLabelOf(treatmentData),
    target: activeContact,
    script: activeScript,
    defaultMessage: defaultMessage.current,
    message: messageToCommunicate,
  };

  const handleCall = async (target: CallTarget, script?: CallScript) => {
    if (onCallStart && !(await onCallStart())) return;
    setAdoptedSessionKey(undefined);
    if (!activeScript) defaultMessage.current = messageToCommunicate;
    // The step's script replaces the treatment's default message, so the
    // dialing step and the results form show what this step says.
    setActiveScript(script ?? null);
    setMessageToCommunicate(script?.message || defaultMessage.current);
    setActiveContact(target);
    setActivePersonName(target.personName);
    setActiveRole(target.role);
    setActivePhone(target.phone);
    setActiveAllowedMethods(target.methods);
    setDialingStarted(false);
    setStep("dialing");
  };

  const handleCancelCall = () => {
    setDialingStarted(false);
    setStep("contacts");
  };

  const handleConfirmCall = (
    elapsedSeconds: number,
    method: CallMethod,
    result: TelephonyCallResult | null = null
  ) => {
    const selectedPhone = phoneForMethod(
      { phone: activePhone, channels: activeContact?.channels },
      method
    );
    setActivePhone(selectedPhone);
    setCallDurationSeconds(elapsedSeconds);
    setCallMethodUsed(method);
    setCallTelephony(result);
    onFormDraftChange?.(null);
    onCallConfirmed?.({
      script: activeScript,
      defaultMessage: defaultMessage.current,
      contact: activeContact,
      personName: activePersonName,
      role: activeRole,
      phone: selectedPhone,
      allowedMethods: activeAllowedMethods,
      durationSeconds: elapsedSeconds,
      methodUsed: method,
      telephony: result,
    });
    setStep("form");
  };

  /** "Hacer otra llamada" from the results form — back to "who to call",
   *  same as cancelling a live call, not straight back into dialing. Also
   *  flags every step from here on (until this second call reaches its own
   *  "form") as a repeat round, so the panel header can read "Llamar → Llamar
   *  de nuevo" on "who to call" instead of the plain first-call title —
   *  cancelling a live call on the FIRST attempt doesn't set this, only
   *  actually finishing one call and choosing to start another does. */
  const handleMakeAnotherCall = () => {
    void revalidateCase(treatmentData?.symptom_info?.id);
    void mutate(contactsKey);
    onRepeatCallChange?.(true);
    session.clearIfOver(caseId);
    handleCancelCall();
  };

  return (
    <>
      {step === "contacts" && (
        <div className="flex min-h-0 w-full flex-1 flex-col">
          <CallCenterMenu
            dict={dict}
            treatmentData={treatmentData}
            skippedTo={skippedTo}
            onSkip={onSkip}
            onCall={handleCall}
          />
        </div>
      )}

      {step === "dialing" && (
        <CallDialingStep
          dict={dict}
          stats={activeContact?.stats}
          history={activeContact?.history}
          contactName={activePersonName}
          contactRole={activeRole}
          contactPhone={activePhone}
          channels={activeContact?.channels}
          allowedMethods={activeAllowedMethods ?? []}
          contactId={activeContact?.contactId}
          reason={messageToCommunicate}
          reasonParts={
            activeScript?.message === messageToCommunicate
              ? activeScript.messageParts
              : undefined
          }
          goal={activeScript?.goal}
          goalParts={activeScript?.goalParts}
          line={providerCalls ? (telephony?.active ?? null) : null}
          teamsLine={providerCalls ? readyTeamsLine(telephony) : null}
          telephonyPending={providerCalls && !telephony && !telephonyError}
          telephonyFailed={providerCalls && Boolean(telephonyError)}
          whatsAppCalling={providerCalls && Boolean(telephony?.whatsAppCalling)}
          caseRef={
            treatmentData?.symptom_info?.id != null
              ? String(treatmentData.symptom_info.id)
              : null
          }
          onCancel={handleCancelCall}
          onConfirm={handleConfirmCall}
          onStartedChange={setDialingStarted}
          sessionKey={
            adoptedSessionKey ??
            `${caseId ?? ""}:${activeContact?.id ?? activePersonName}`
          }
          callContext={callContext}
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
          initialCallTargetContactId={activeContact?.contactId}
          initialCallTargetStats={activeContact?.stats}
          callMethodUsed={callMethodUsed ?? undefined}
          // Disabled for now — see PrototypeCallDriver's `aiAssistEnabled` doc.
          aiAssistEnabled={false}
          callDurationSeconds={callDurationSeconds}
          callTelephony={callTelephony}
          onMakeAnotherCall={handleMakeAnotherCall}
          onSwitchTreatment={onSwitchTreatment}
          initialDraft={formDraft}
          onDraftChange={onFormDraftChange}
          treatmentProgress={treatmentProgress.current}
        />
      )}
    </>
  );
}
