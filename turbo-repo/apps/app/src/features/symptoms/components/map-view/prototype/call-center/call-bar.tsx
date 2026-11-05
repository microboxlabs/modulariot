"use client";

/**
 * The call bar: while a call is open it stays on every secured page, so the
 * operator can look at the map or another page and still see who they are
 * talking to, for how long, and end the call. Clicking it goes back to the
 * case with the dialing step (or the results form) open.
 */

import { usePathname, useRouter } from "next/navigation";
import { FaMicrophone, FaMicrophoneSlash, FaPhoneAlt } from "react-icons/fa";
import { HiX } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { CALL_METHOD_ICONS } from "./call-method";
import {
  callSeconds,
  useCallSession,
  useNow,
  type ActiveCall,
} from "./call-session";

export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

/** Opens the call's case: a route change when elsewhere, a focus request on the case page. */
export function useGoToCall() {
  const router = useRouter();
  const pathname = usePathname();
  const session = useCallSession();
  return (call: ActiveCall) => {
    const href = call.context.caseHref;
    if (href && href.split("?")[0] !== pathname) router.push(href);
    session.requestFocus();
  };
}

/** Shown instead of the call buttons while another call is open. */
export function OtherCallNotice({
  dict,
  call,
}: Readonly<{ dict: I18nRecord; call: ActiveCall }>) {
  const goToCall = useGoToCall();
  return (
    <div role="status" className="flex flex-col items-center gap-2 text-sm">
      <p className="text-center text-gray-700 dark:text-gray-300">
        {tr("symptoms.call_other_active", dict, { name: call.contactName })}
      </p>
      <button
        type="button"
        onClick={() => goToCall(call)}
        className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
      >
        {tr("symptoms.call_go_to_active", dict)}
      </button>
    </div>
  );
}

function statusText(
  call: ActiveCall,
  t: (k: string) => string
): string | null {
  if (call.status === "ended") return t("call_ended_pending");
  if (call.status === "dropped") return t("call_dropped_on_reload");
  if (call.status === "failed") return t("call_failed_short");
  if (call.notice) return t(call.notice);
  if (call.phase && call.phase !== "active") return t(`call_phase_${call.phase}`);
  return null;
}

const roundButton =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50";

function LiveActions({
  call,
  t,
}: Readonly<{ call: ActiveCall; t: (k: string) => string }>) {
  const session = useCallSession();
  const muteLabel = call.muted ? t("call_unmute") : t("call_mute");
  return (
    <>
      {call.kind === "telnyx" && (
        <button
          type="button"
          onClick={() => session.setMuted(!call.muted)}
          disabled={!call.dialReady}
          title={muteLabel}
          aria-label={muteLabel}
          aria-pressed={call.muted}
          className={`${roundButton} bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200`}
        >
          {call.muted ? (
            <FaMicrophoneSlash className="h-4 w-4" />
          ) : (
            <FaMicrophone className="h-4 w-4" />
          )}
        </button>
      )}
      <button
        type="button"
        onClick={session.confirm}
        disabled={call.kind === "telnyx" && !call.dialReady}
        title={t("call_modal_confirm")}
        aria-label={t("call_modal_confirm")}
        className={`${roundButton} bg-red-500 text-white hover:bg-red-600`}
      >
        <FaPhoneAlt className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={session.cancel}
        title={t("call_modal_cancel")}
        aria-label={t("call_modal_cancel")}
        className={`${roundButton} bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200`}
      >
        <HiX className="h-4 w-4" />
      </button>
    </>
  );
}

function OverActions({
  call,
  t,
}: Readonly<{ call: ActiveCall; t: (k: string) => string }>) {
  const session = useCallSession();
  const goToCall = useGoToCall();
  const canRecord = call.status === "ended" || call.status === "dropped";
  return (
    <>
      {canRecord && (
        <button
          type="button"
          onClick={() => {
            if (call.status === "dropped") session.confirm();
            goToCall(call);
          }}
          className="shrink-0 rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
        >
          {t("call_record_result")}
        </button>
      )}
      {call.status !== "ended" && (
        <button
          type="button"
          onClick={session.clear}
          title={t("call_dismiss")}
          aria-label={t("call_dismiss")}
          className={`${roundButton} bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200`}
        >
          <HiX className="h-4 w-4" />
        </button>
      )}
    </>
  );
}

export default function CallBar({ dict }: Readonly<{ dict: I18nRecord }>) {
  const session = useCallSession();
  const goToCall = useGoToCall();
  const call = session.call;
  const now = useNow(call?.status === "live");
  if (!call) return null;
  const t = (k: string) => tr(`symptoms.${k}`, dict);
  const Icon = CALL_METHOD_ICONS[call.method];
  const status = statusText(call, t);
  const showTimer = call.status !== "failed" && !call.notice;
  const tone =
    call.status === "live"
      ? "border-green-300 dark:border-green-700"
      : "border-amber-300 dark:border-amber-700";

  return (
    // Top center, under the navbar: the map's own controls sit on its
    // corners, and the map keeps taking clicks around the bar.
    <section
      aria-label={t("call_bar_label")}
      className={`fixed left-1/2 top-[4.5rem] z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full border bg-white py-1 pl-1 pr-2 shadow-lg dark:bg-gray-800 ${tone}`}
    >
      <button
        type="button"
        onClick={() => goToCall(call)}
        title={t("call_bar_back")}
        className="flex min-w-0 items-center gap-2 rounded-full py-1 pl-2 pr-1 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${
            call.status === "live" ? "animate-pulse bg-green-500" : "bg-amber-500"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-medium text-gray-900 dark:text-white">
            {call.contactName}
            {call.contactRole && (
              <span className="font-normal text-gray-500 dark:text-gray-400">
                {" "}
                · {call.contactRole}
              </span>
            )}
          </span>
          <span className="truncate text-xs text-gray-500 dark:text-gray-400">
            {[call.context.caseLabel, status].filter(Boolean).join(" · ")}
          </span>
        </span>
        {showTimer && (
          <span className="ml-1 font-mono text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
            {formatDuration(callSeconds(call, now))}
          </span>
        )}
      </button>
      {call.status === "live" ? (
        <LiveActions call={call} t={t} />
      ) : (
        <OverActions call={call} t={t} />
      )}
    </section>
  );
}
