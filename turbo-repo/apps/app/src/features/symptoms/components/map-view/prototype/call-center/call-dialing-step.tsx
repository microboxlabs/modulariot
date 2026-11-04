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
 */

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
import type { CallStats } from "./call-targets";
import {
  channelLink,
  openTeamsCall,
  phoneDigits,
  teamsCallLinks,
} from "./channel-link";
import ContactRow from "./contact-row";
import {
  pendingTeamsCall,
  startTelnyxCall,
  type CallPhase,
  type LiveCall,
  type TelephonyCallResult,
} from "./telnyx-call";
import {
  fetchWebRtcToken,
  type TelephonyLine,
} from "@/features/symptoms/control-tower/telephony-api";

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
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
  goal,
  line = null,
  telephonyPending = false,
  telephonyFailed = false,
  onCancel,
  onConfirm,
  onStartedChange,
  dial = startTelnyxCall,
  token = fetchWebRtcToken,
  openTeams = openTeamsCall,
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
  /** The organization's telephony line; a Telnyx line places "phone" calls from the browser. */
  line?: TelephonyLine | null;
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
  openTeams?: (links: { app: string; web: string }) => void;
}>) {
  const t = (k: string) => tr(`symptoms.${k}`, dict);
  const { lang } = useParams<{ lang: string }>();
  const methods = ALL_CALL_METHODS.filter((m) => allowedMethods.includes(m));
  const [started, setStarted] = useState(false);
  const [method, setMethod] = useState<CallMethod>("phone");
  const [showCancel, setShowCancel] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  // A browser call through Telnyx: its phase, when it was answered, and the
  // handle to hang it up. Null for a call timed by hand.
  const [phase, setPhase] = useState<CallPhase | null>(null);
  const [answeredAt, setAnsweredAt] = useState<number | null>(null);
  const [dialError, setDialError] = useState<string | null>(null);
  const [browserAttempt, setBrowserAttempt] = useState(false);
  const [dialReady, setDialReady] = useState(false);
  const liveRef = useRef<LiveCall | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  useEffect(() => {
    if (!started) return;
    startRef.current = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [started]);

  // Leaving the step ends a call still on the line.
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      abortRef.current?.abort();
      liveRef.current?.hangup();
    };
  }, []);

  const destination = phoneDigits(channels?.phone ?? contactPhone);
  const viaTelnyx = (id: CallMethod) =>
    id === "phone" && line?.provider === "TELNYX" && destination !== null;
  // With Teams Phone both "phone" and "teams" call the number from Teams.
  const viaTeams = (id: CallMethod) =>
    (id === "phone" || id === "teams") &&
    line?.provider === "TEAMS_PHONE" &&
    destination !== null;
  const [teamsCall, setTeamsCall] = useState<number | null>(null);

  async function placeTelnyxCall() {
    cancelledRef.current = false;
    abortRef.current = new AbortController();
    setDialError(null);
    setAnsweredAt(null);
    setBrowserAttempt(true);
    setDialReady(false);
    setPhase("connecting");
    try {
      const login = await token();
      if (cancelledRef.current) return;
      liveRef.current = await dial({
        token: login.token,
        callerNumber: login.callerNumber,
        destination: `+${destination}`,
        remoteElement: audioRef.current,
        signal: abortRef.current.signal,
        onPhase: (next, at) => {
          setPhase(next);
          setAnsweredAt(at);
        },
        onEnd: (result) => {
          liveRef.current = null;
          if (!cancelledRef.current) {
            if (!result.callId) {
              setPhase(null);
              setDialError(t("call_telnyx_failed"));
              setStarted(false);
              onStartedChange?.(false);
              return;
            }
            onConfirmRef.current(result.durationSeconds, "phone", result);
          }
        },
      });
      setDialReady(true);
      if (cancelledRef.current) liveRef.current?.hangup();
    } catch (cause) {
      if (cancelledRef.current) return;
      setPhase(null);
      setDialError(cause instanceof Error ? cause.message : String(cause));
      setStarted(false);
      onStartedChange?.(false);
    }
  }

  // A Telnyx call counts from the answer; a call timed by hand from the press.
  let shownSeconds = elapsed;
  if (phase !== null)
    shownSeconds =
      answeredAt === null
        ? 0
        : Math.max(0, Math.floor((Date.now() - answeredAt) / 1000));

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
      {/* The callee's voice in a browser call. */}
      <audio ref={audioRef} autoPlay className="hidden" />
      {/* Top quarter: the same static contact row as "a quién llamar",
          instead of a bespoke header — same card, just not clickable. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-transparent dark:bg-gray-800/40">
        <div className="shrink-0">
          <ContactRow
            personName={contactName}
            roleLabel={contactRole}
            phone={
              started && (method === "phone" || method === "whatsapp")
                ? (channels?.[method] ?? contactPhone)
                : contactPhone
            }
            stats={stats}
            pulsing={started}
            bgClassName="bg-white dark:bg-gray-800/40"
          />
        </div>

        <div className="flex min-h-0 flex-3 flex-col items-center p-4">
          <div
            className={`grid shrink-0 transition-[grid-template-rows] duration-300 ease-out ${
              showTimer ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="overflow-hidden">
              <p
                className={`font-mono text-xl font-semibold tabular-nums text-gray-900 transition-all duration-300 dark:text-white ${
                  showTimer ? "scale-100 opacity-100" : "scale-75 opacity-0"
                }`}
              >
                {formatDuration(shownSeconds)}
              </p>
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
                  {reason}
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
                {goal}
              </p>
            )}
          </div>
        </div>

        {dialError && (
          <p
            role="alert"
            className="mx-4 mb-2 shrink-0 text-sm text-red-600 dark:text-red-400"
          >
            {t("call_telnyx_failed")}: {dialError}
          </p>
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
          {!started && methods.length === 0 && (
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
          {!started &&
            methods.map((id) => {
              const Icon = CALL_METHOD_ICONS[id];
              const label = t(CALL_METHOD_LABEL_KEYS[id]);
              return (
                <button
                  key={id}
                  type="button"
                  disabled={
                    id === "phone" && (telephonyPending || telephonyFailed)
                  }
                  onClick={() => {
                    if (viaTeams(id)) {
                      const links = teamsCallLinks(contactPhone);
                      if (links) openTeams(links);
                      setTeamsCall(Date.now());
                      setMethod(id);
                      setStarted(true);
                      onStartedChange?.(true);
                      return;
                    }
                    if (viaTelnyx(id)) {
                      setMethod(id);
                      setStarted(true);
                      onStartedChange?.(true);
                      void placeTelnyxCall();
                      return;
                    }
                    // Opens the channel's app (dialer, WhatsApp chat with the
                    // script typed); the call is timed here either way.
                    setBrowserAttempt(false);
                    setPhase(null);
                    setAnsweredAt(null);
                    setDialError(null);
                    const link = channelLink(
                      id,
                      channels?.[id] ?? contactPhone,
                      reason
                    );
                    if (link?.startsWith("https://"))
                      window.open(link, "_blank", "noopener,noreferrer");
                    else if (link) window.location.href = link;
                    setMethod(id);
                    setStarted(true);
                    onStartedChange?.(true);
                  }}
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
                onClick={() => {
                  // Hanging up a browser call reports its end through onEnd.
                  if (liveRef.current) liveRef.current.hangup();
                  else if (teamsCall !== null)
                    onConfirm(
                      elapsed,
                      method,
                      pendingTeamsCall(`+${destination}`, teamsCall, Date.now())
                    );
                  else if (!browserAttempt) onConfirm(elapsed, method);
                }}
                disabled={browserAttempt && !dialReady}
                title={t("call_modal_confirm")}
                aria-label={t("call_modal_confirm")}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-colors hover:bg-red-600"
              >
                <FaPhoneAlt className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  cancelledRef.current = true;
                  abortRef.current?.abort();
                  liveRef.current?.hangup();
                  onCancel(elapsed);
                }}
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
