"use client";

/**
 * PROTOTYPE — replaces the separate "reason" step + "calling" step with one
 * screen: the chosen contact shown as the same static row as "a quién
 * llamar" (see `contact-row.tsx`), then the message. There's no separate
 * "pick a method, then press start" — each method (phone / WhatsApp / Meet /
 * Teams) is its own call button, and all four are just channels for the same
 * live-call flow (WhatsApp included, it's not a message-send step).
 * Pressing one starts the call directly; once live, the whole row is
 * replaced by a single red "Marcar como realizada" button with a small "✕"
 * (Cancelar llamada) growing in beside it.
 *
 * With a Telnyx line, "phone" dials from the browser (`telnyx-call.ts`): the
 * red button hangs up, and the call's end fills the duration, whether it was
 * answered, and the provider's call id. Without one, it opens `tel:`.
 *
 * "teams" opens Microsoft Teams whenever the organization has a tested Teams
 * Phone connection, whatever its main line. Without one nothing opens, so the
 * step shows "Sin conexión Teams Phone" instead of a timer.
 *
 * The call itself lives in the call session (`call-session.tsx`), not here:
 * this step can unmount (panel closed, other page) and the call goes on,
 * shown in the call bar. Remounted, it shows the same call again.
 */

import WhatsAppCallPermission from "./whatsapp-call-permission";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FaPhoneAlt } from "react-icons/fa";
import { HiX } from "react-icons/hi";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { BentoGrid, fieldLabel } from "../prototype-form-kit";
import {
  ALL_CALL_METHODS,
  CALL_METHOD_ICONS,
  CALL_METHOD_LABEL_KEYS,
  type CallMethod,
} from "./call-method";
import type { TowerContactChannels } from "@/features/symptoms/control-tower/control-tower-api";
import { phoneForMethod, type CallStats } from "./call-targets";
import {
  channelLink,
  openTeamsCall,
  dialNumber,
  teamsCallLinks,
} from "./channel-link";
import type { FilledPart } from "@/features/symptoms/maintainer/script-fill";
import ScriptText from "@/features/symptoms/maintainer/script-text";
import ContactRow from "./contact-row";
import { startTelnyxCall, type TelephonyCallResult } from "./telnyx-call";
import {
  CHANNELS_BUSY,
  QUOTA_EXHAUSTED,
  fetchWebRtcToken,
  reportCallEnded,
  type TelephonyLine,
} from "@/features/symptoms/control-tower/telephony-api";
import {
  callSeconds,
  useCallSession,
  useNow,
  type CallContext,
} from "./call-session";
import { OtherCallNotice, formatDuration } from "./call-bar";

function CallTimer({
  notice,
  showTimer,
  seconds,
}: Readonly<{
  notice: string | null;
  showTimer: boolean;
  seconds: number;
}>) {
  if (notice) {
    return (
      <output className="text-sm font-medium text-amber-700 dark:text-amber-400">
        {notice}
      </output>
    );
  }
  return (
    <p
      className={`font-mono text-xl font-semibold tabular-nums text-gray-900 transition-all duration-300 dark:text-white ${
        showTimer ? "scale-100 opacity-100" : "scale-75 opacity-0"
      }`}
    >
      {formatDuration(seconds)}
    </p>
  );
}

export default function CallDialingStep({
  dict,
  stats,
  contactName,
  contactRole,
  contactPhone,
  channels,
  allowedMethods,
  contactId,
  reason,
  reasonParts,
  goal,
  goalParts,
  line = null,
  teamsLine = null,
  telephonyPending = false,
  telephonyFailed = false,
  onCancel,
  onConfirm,
  onStartedChange,
  dial = startTelnyxCall,
  token = fetchWebRtcToken,
  endCall = reportCallEnded,
  caseRef = null,
  openTeams = openTeamsCall,
  sessionKey,
  callContext,
}: Readonly<{
  dict: I18nRecord;
  /** The contact's call counts from the book; absent for the driver or a new number. */
  stats?: CallStats | null;
  contactName: string;
  contactRole: string;
  contactPhone?: string;
  channels?: TowerContactChannels | null;
  /** The channels the contact can be reached on. Empty shows "Sin canales registrados". */
  allowedMethods: readonly CallMethod[];
  /** The contact book id, for the link to edit a contact with no channels. */
  contactId?: string;
  /** The message to communicate, pre-filled upstream (treatment template) —
   *  shown here as a read-only "script to follow" while calling, not an
   *  editable field. */
  reason: string;
  /** The step's goal, filled with the case: what the call must obtain. */
  goal?: string;
  /** The message and goal in parts, when they come from a step's script: blanks show in amber. */
  reasonParts?: FilledPart[];
  goalParts?: FilledPart[];
  /** The organization's telephony line; a Telnyx line places "phone" calls from the browser. */
  line?: TelephonyLine | null;
  /** The organization's tested TEAMS_PHONE line, used by "teams" even when `line` is Telnyx. */
  teamsLine?: TelephonyLine | null;
  telephonyPending?: boolean;
  telephonyFailed?: boolean;
  onCancel: (elapsedSeconds: number) => void;
  /** `result` is set when the provider placed the call and reported how it ended. */
  onConfirm: (
    elapsedSeconds: number,
    method: CallMethod,
    result?: TelephonyCallResult
  ) => void;
  /** Fires the moment a method button is pressed (call goes live) — lets the
   *  panel header lock the back button and swap its title. */
  onStartedChange?: (started: boolean) => void;
  /** Test seams: place the call and get the login. */
  dial?: typeof startTelnyxCall;
  token?: typeof fetchWebRtcToken;
  endCall?: typeof reportCallEnded;
  /** The case the call is about, for the usage ledger. */
  caseRef?: string | null;
  openTeams?: (links: { app: string; web: string }) => void;
  /** Identifies this step's call in the call session; defaults to the case and contact. */
  sessionKey?: string;
  /** What the call bar shows and the case panel restores from. */
  callContext?: Partial<CallContext>;
}>) {
  const t = (k: string) => tr(`symptoms.${k}`, dict);
  const { lang } = useParams<{ lang: string }>();
  const session = useCallSession();
  const methods = ALL_CALL_METHODS.filter((m) => allowedMethods.includes(m));
  const key = sessionKey ?? `${caseRef ?? ""}:${contactId ?? contactName}`;
  // The session's call is this step's when it was started for this contact
  // and case; any other call that is not over blocks starting a new one.
  const own = session.call?.key === key ? session.call : null;
  const other = !own && session.busy ? session.call : null;
  const started = own?.status === "live";
  const dropped = own?.status === "dropped" ? own : null;
  const method: CallMethod = own?.method ?? "phone";
  const browserAttempt = started && own?.kind === "telnyx";
  const dialReady = own?.dialReady ?? false;
  const phase = browserAttempt ? (own?.phase ?? null) : null;
  const failure = own?.status === "failed" ? own.error : null;
  const refusal = failure?.refusal ?? null;
  const teamsNotice = started && own?.notice ? t(own.notice) : null;
  const now = useNow(started);
  const shownSeconds = own ? callSeconds(own, now) : 0;
  const [showCancel, setShowCancel] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;
  const onStartedChangeRef = useRef(onStartedChange);
  onStartedChangeRef.current = onStartedChange;

  // An ended call (here or from the call bar, on any page) moves on to the results form.
  const confirmedRef = useRef<string | null>(null);
  const ownId = own?.id;
  const ownStatus = own?.status;
  useEffect(() => {
    if (own?.status !== "ended" || !own.result) return;
    if (confirmedRef.current === own.id) return;
    confirmedRef.current = own.id;
    const r = own.result;
    if (r.telephony)
      onConfirmRef.current(r.durationSeconds, r.method, r.telephony);
    else onConfirmRef.current(r.durationSeconds, r.method);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownId, ownStatus]);

  const reportedStarted = useRef(false);
  useEffect(() => {
    if (reportedStarted.current === started) return;
    reportedStarted.current = started;
    onStartedChangeRef.current?.(started);
  }, [started]);

  const destination = dialNumber(channels?.phone ?? contactPhone);
  // Provider token/admission APIs require E.164. Service numbers use the
  // native phone in the same timed call and CALL-result flow.
  const serviceNumber = destination !== null && !destination.startsWith("+");
  const viaTelnyx = (id: CallMethod) =>
    id === "phone" &&
    line?.provider === "TELNYX" &&
    destination !== null &&
    !serviceNumber;
  // "teams" calls from Teams on any Teams Phone line; "phone" only when Teams
  // Phone is the main line.
  const teamsConnection =
    [line, teamsLine].find((l) => l?.provider === "TEAMS_PHONE" && l.ready) ??
    null;
  const teamsVia = (id: CallMethod): TelephonyLine | null => {
    if (destination === null || serviceNumber) return null;
    if (id === "teams") return teamsConnection;
    if (id === "phone" && line?.provider === "TEAMS_PHONE")
      return teamsConnection;
    return null;
  };

  const startInput = (id: CallMethod) => ({
    key,
    context: { ...callContext, caseId: callContext?.caseId ?? caseRef },
    contactName,
    contactRole,
    method: id,
    calleeNumber: destination,
  });

  function startManualCall(id: CallMethod, notice: string | null = null) {
    session.startManual({ ...startInput(id), notice });
  }

  function startMethod(id: CallMethod) {
    const viaTeams = teamsVia(id);
    if (viaTeams) {
      const links = teamsCallLinks(destination);
      if (!links) return;
      openTeams(links);
      session.startTeams({
        ...startInput(id),
        connectionId: viaTeams.connectionId,
      });
      return;
    }
    if (viaTelnyx(id)) {
      session.startTelnyx({
        ...startInput(id),
        destination: destination ?? "",
        caseRef,
        dial,
        token,
        endCall,
      });
      return;
    }
    // Opens the channel's app (dialer, WhatsApp chat with the script typed);
    // the call is timed here either way. A "teams" press with no Teams Phone
    // line opens nothing.
    let notice: string | null = null;
    if (id === "teams")
      notice = teamsConnection
        ? "call_teams_no_number"
        : "call_teams_no_connection";
    const link = channelLink(id, channels?.[id] ?? contactPhone, reason);
    if (link?.startsWith("https://"))
      window.open(link, "_blank", "noopener,noreferrer");
    else if (link) window.location.href = link;
    startManualCall(id, notice);
  }

  // Buttons to start a call: none while this call is on or cut, or another is open.
  const idle = !started && !dropped && !other;

  const cancelCall = () => {
    session.cancel();
    onCancel(shownSeconds);
  };

  // Both the cancel button and the timer mount at scale-0/opacity-0 first,
  // then flip a frame later so the transition actually plays instead of
  // popping in at once.
  useEffect(() => {
    if (!started) {
      setShowCancel(false);
      setShowTimer(false);
      return;
    }
    const id = requestAnimationFrame(() => {
      setShowCancel(true);
      setShowTimer(true);
    });
    return () => cancelAnimationFrame(id);
  }, [started]);

  return (
    <BentoGrid>
      {/* Top quarter: the same static contact row as "a quién llamar",
          instead of a bespoke header — same card, just not clickable. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-transparent dark:bg-gray-800/40">
        <div className="shrink-0">
          <ContactRow
            personName={contactName}
            roleLabel={contactRole}
            phone={phoneForMethod(
              { phone: contactPhone ?? "", channels },
              method
            )}
            stats={stats}
            pulsing={started}
            bgClassName="bg-white dark:bg-gray-800/40"
          />
        </div>

        {!started && methods.includes("whatsapp") && (
          <WhatsAppCallPermission
            dict={dict}
            phone={channels?.whatsapp ?? contactPhone}
            name={contactName}
            lang={lang}
          />
        )}

        <div className="flex min-h-0 flex-3 flex-col items-center p-4">
          <div
            className={`grid shrink-0 transition-[grid-template-rows] duration-300 ease-out ${
              showTimer ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="overflow-hidden">
              <CallTimer
                notice={teamsNotice}
                showTimer={showTimer}
                seconds={shownSeconds}
              />
              {phase !== null && phase !== "active" && (
                <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                  {t(`call_phase_${phase}`)}
                </p>
              )}
            </div>
          </div>

          <div className="mt-1 flex min-h-0 w-full flex-1 flex-col gap-2 text-left">
            <span className={`shrink-0 ${fieldLabel}`}>
              {t("proto_section_message")}
            </span>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800/60">
              {reason ? (
                <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                  {reasonParts ? (
                    <ScriptText
                      parts={reasonParts}
                      title={t("call_script_blank_hint")}
                    />
                  ) : (
                    reason
                  )}
                </p>
              ) : (
                <p className="text-sm italic text-gray-400 dark:text-gray-500">
                  {t("call_reason_placeholder")}
                </p>
              )}
            </div>
            {goal?.trim() && (
              <p className="shrink-0 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:bg-blue-900/20 dark:text-blue-100">
                <span className="font-medium">{t("call_goal")}: </span>
                {goalParts ? (
                  <ScriptText
                    parts={goalParts}
                    title={t("call_script_blank_hint")}
                  />
                ) : (
                  goal
                )}
              </p>
            )}
          </div>
        </div>

        {failure && (
          <div
            role="alert"
            className="mx-4 mb-2 shrink-0 text-sm text-red-600 dark:text-red-400"
          >
            {refusal === QUOTA_EXHAUSTED && <p>{t("call_quota_exhausted")}</p>}
            {refusal === CHANNELS_BUSY && <p>{t("call_channels_busy")}</p>}
            {!refusal && (
              <p>
                {t("call_telnyx_failed")}
                {failure.message ? `: ${failure.message}` : ""}
              </p>
            )}
            {destination && (
              <a
                href={`tel:${destination}`}
                onClick={() => startManualCall("phone")}
                className="font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                {t("call_use_phone")}
              </a>
            )}
          </div>
        )}
        {(telephonyPending || telephonyFailed) && (
          <p
            role={telephonyFailed ? "alert" : "status"}
            className="mx-4 mb-2 text-sm text-gray-500"
          >
            {telephonyFailed
              ? t("call_telephony_load_failed")
              : t("call_telephony_loading")}
          </p>
        )}

        {/* Inside the card, pinned to its bottom (last item in the column)
            instead of a separate actions row below the card. Before the call
            starts, every method is its own call button — no "pick a method,
            then press start" step. Once live, they're replaced by the
            confirm/cancel pair. */}
        <div className="flex w-full shrink-0 flex-row items-center justify-center gap-3 p-4 pt-0!">
          {dropped && (
            <div
              role="alert"
              className="flex flex-col items-center gap-2 text-sm"
            >
              <p className="text-amber-700 dark:text-amber-400">
                {t("call_dropped_on_reload")} ·{" "}
                <span className="font-mono tabular-nums">
                  {formatDuration(shownSeconds)}
                </span>
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={session.confirm}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
                >
                  {t("call_record_result")}
                </button>
                <button
                  type="button"
                  onClick={session.clear}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  {t("call_again_label")}
                </button>
              </div>
            </div>
          )}
          {other && <OtherCallNotice dict={dict} call={other} />}
          {idle && methods.length === 0 && (
            <div className="flex flex-col items-center gap-1 text-sm">
              <p className="text-gray-700 dark:text-gray-300">
                {t("call_center_no_channels")}
              </p>
              {contactId && (
                <Link
                  href={`/${lang}/users/settings/contact-book?edit=${encodeURIComponent(contactId)}`}
                  className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  {t("call_center_edit_contact")}
                </Link>
              )}
            </div>
          )}
          {idle &&
            methods.map((id) => {
              const Icon = CALL_METHOD_ICONS[id];
              const label = t(CALL_METHOD_LABEL_KEYS[id]);
              return (
                <button
                  key={id}
                  type="button"
                  disabled={
                    (id === "teams" || (id === "phone" && !serviceNumber)) &&
                    (telephonyPending || telephonyFailed)
                  }
                  onClick={() => startMethod(id)}
                  title={label}
                  aria-label={label}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500 text-white shadow-sm transition-colors hover:bg-green-600"
                >
                  <Icon className="h-5 w-5" />
                </button>
              );
            })}

          {started && (
            <>
              <button
                type="button"
                onClick={session.confirm}
                disabled={browserAttempt && !dialReady}
                title={t("call_modal_confirm")}
                aria-label={t("call_modal_confirm")}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-colors hover:bg-red-600"
              >
                <FaPhoneAlt className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={cancelCall}
                title={t("call_modal_cancel")}
                aria-label={t("call_modal_cancel")}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-700 shadow-sm transition-all duration-300 dark:bg-gray-700 dark:text-gray-200 ${
                  showCancel ? "scale-100 opacity-100" : "scale-0 opacity-0"
                }`}
              >
                <HiX className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </BentoGrid>
  );
}
