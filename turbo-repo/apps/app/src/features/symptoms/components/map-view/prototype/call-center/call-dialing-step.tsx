"use client";

/**
 * PROTOTYPE — replaces the separate "reason" step + "calling" step with one
 * screen: the chosen contact shown as the same static row as "a quién
 * llamar" (see `contact-row.tsx`), then the message. There's no separate
 * "pick a method, then press start" — each method (phone / WhatsApp / Meet /
 * Teams) is its own call button, and all four are just channels for the same
 * live-call flow (none of them are real integrations here — WhatsApp
 * included, it's not a message-send step). Pressing one starts the call
 * directly; once live, the whole row is replaced by a single red "Marcar
 * como realizada" button with a small "✕" (Cancelar llamada) growing in
 * beside it.
 */

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
import type { CallStats } from "./call-targets";
import ContactRow from "./contact-row";

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
  allowedMethods,
  reason,
  onCancel,
  onConfirm,
  onStartedChange,
}: Readonly<{
  dict: I18nRecord;
  /** The contact's call history from the Control Tower API; absent for the driver. */
  stats?: CallStats | null;
  contactName: string;
  contactRole: string;
  contactPhone?: string;
  /** Which channels this contact can be reached on — empty/absent means no
   *  restriction (every method is offered), same as a seeded "who to call"
   *  option always has. */
  allowedMethods?: CallMethod[];
  /** The message to communicate, pre-filled upstream (treatment template) —
   *  shown here as a read-only "script to follow" while calling, not an
   *  editable field. */
  reason: string;
  onCancel: (elapsedSeconds: number) => void;
  onConfirm: (elapsedSeconds: number, method: CallMethod) => void;
  /** Fires the moment a method button is pressed (call goes live) — lets the
   *  panel header lock the back button and swap its title. */
  onStartedChange?: (started: boolean) => void;
}>) {
  const t = (k: string) => tr(`symptoms.${k}`, dict);
  const methods =
    allowedMethods && allowedMethods.length > 0 ? allowedMethods : ALL_CALL_METHODS;
  const [started, setStarted] = useState(false);
  const [method, setMethod] = useState<CallMethod>("phone");
  const [showCancel, setShowCancel] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (!started) return;
    startRef.current = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [started]);

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
            phone={contactPhone}
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
                {formatDuration(elapsed)}
              </p>
            </div>
          </div>

          <div className="mt-1 flex min-h-0 w-full flex-1 flex-col gap-2 text-left">
            <span className={`shrink-0 ${fieldLabel}`}>{t("proto_section_message")}</span>
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
          </div>
        </div>

        {/* Inside the card, pinned to its bottom (last item in the column)
            instead of a separate actions row below the card. Before the call
            starts, every method is its own call button — no "pick a method,
            then press start" step. Once live, they're replaced by the
            confirm/cancel pair. */}
        <div className="flex w-full shrink-0 flex-row items-center justify-center gap-3 p-4 pt-0!">
          {!started &&
            methods.map((id) => {
              const Icon = CALL_METHOD_ICONS[id];
              const label = t(CALL_METHOD_LABEL_KEYS[id]);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
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
                onClick={() => onConfirm(elapsed, method)}
                title={t("call_modal_confirm")}
                aria-label={t("call_modal_confirm")}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-colors hover:bg-red-600"
              >
                <FaPhoneAlt className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => onCancel(elapsed)}
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
