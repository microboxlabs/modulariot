"use client";

/**
 * WhatsApp calls from contacts ringing in the tower. The server parks each
 * call and lists it here; "Contestar" places the operator's browser leg, which
 * the server bridges to the WhatsApp call. The first operator to answer takes
 * it. Shown only while WhatsApp calling is on and no other call is open.
 */

import { FaWhatsapp } from "react-icons/fa";
import { mutate } from "swr";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  answerWhatsAppCall,
  ringingWhatsAppCallsKey,
  useRingingWhatsAppCalls,
  useTelephony,
  type InboundWhatsAppCall,
} from "@/features/symptoms/control-tower/telephony-api";
import { useOptionalCallSession } from "./call-session";

export default function IncomingWhatsAppCalls({
  dict,
  answer = answerWhatsAppCall,
}: Readonly<{
  dict: I18nRecord;
  /** Test seam: the login that takes the call. */
  answer?: typeof answerWhatsAppCall;
}>) {
  const session = useOptionalCallSession();
  const { data: setup } = useTelephony(Boolean(session));
  const enabled = Boolean(setup?.whatsAppCalling);
  const { data: calls } = useRingingWhatsAppCalls(enabled && !session?.busy);
  if (!session || !enabled || session.busy || !calls?.length) return null;

  const take = (c: InboundWhatsAppCall) => {
    const name = c.callerName ?? c.callerNumber;
    session.startTelnyx({
      key: `wa-in:${c.id}`,
      context: { caseId: c.caseRef },
      contactName: name,
      contactRole: "",
      method: "whatsapp",
      calleeNumber: c.callerNumber,
      destination: c.callerNumber,
      caseRef: c.caseRef,
      token: () => answer(c.id),
    });
    void mutate(ringingWhatsAppCallsKey);
  };

  return (
    <section
      aria-label={tr("symptoms.wa_incoming_title", dict)}
      className="fixed bottom-4 right-4 z-50 flex w-72 flex-col gap-2"
    >
      {calls.map((c) => (
        <div
          key={c.id}
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-green-200 bg-white p-3 shadow-lg dark:border-green-800 dark:bg-gray-800"
        >
          <FaWhatsapp className="h-6 w-6 shrink-0 animate-pulse text-green-500" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium text-gray-900 dark:text-white">
              {tr("symptoms.wa_incoming_title", dict)}
            </p>
            <p className="truncate text-gray-700 dark:text-gray-300">
              {c.callerName ?? tr("symptoms.wa_incoming_unknown", dict)} ·{" "}
              {c.callerNumber}
            </p>
            {c.caseRef && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {tr("symptoms.wa_incoming_case", dict, { id: c.caseRef })}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => take(c)}
            className="rounded-lg bg-green-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-600"
          >
            {tr("symptoms.wa_incoming_answer", dict)}
          </button>
        </div>
      ))}
    </section>
  );
}
