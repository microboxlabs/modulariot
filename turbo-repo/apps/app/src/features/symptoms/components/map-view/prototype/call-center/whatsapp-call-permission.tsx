"use client";

/**
 * The WhatsApp call permission of the contact on the organization's number:
 * can call, permission pending, or no permission with a button to send the
 * request now. Shows nothing while WhatsApp calling is off, so the WhatsApp
 * button keeps opening wa.me as before.
 */

import { useState } from "react";
import useSWR from "swr";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { CONVERSATIONS_BASE } from "@/features/conversations/conversations-api";
import { controlTowerRequest } from "@/features/symptoms/control-tower/control-tower-api";

import {
  parseCallPermissionRequest,
  parseCallPermissionView,
  type CallPermissionState,
  type CallPermissionView,
} from "./whatsapp-call-permission.types";

export type {
  CallPermissionState,
  CallPermissionView,
  CallPermissionRequestResult,
} from "./whatsapp-call-permission.types";

const PERMISSIONS = `${CONVERSATIONS_BASE}/whatsapp-call-permissions`;

export const callPermissionKey = (phone: string) =>
  `${PERMISSIONS}?phone=${encodeURIComponent(phone)}`;

export function useWhatsAppCallPermission(phone: string | null | undefined) {
  return useSWR<CallPermissionView>(
    phone ? callPermissionKey(phone) : null,
    async (url: string) =>
      parseCallPermissionView(await controlTowerRequest<unknown>(url)),
    {
      revalidateOnFocus: true,
      refreshInterval: 15_000,
      shouldRetryOnError: false,
    }
  );
}

export async function requestWhatsAppCallPermission(
  phone: string,
  name?: string
) {
  return parseCallPermissionRequest(
    await controlTowerRequest<unknown>(`${PERMISSIONS}/requests`, {
      method: "POST",
      body: { phone, name },
    })
  );
}

const STATE_STYLE: Record<CallPermissionState, string> = {
  CAN_CALL: "text-green-700 dark:text-green-400",
  PENDING: "text-amber-700 dark:text-amber-400",
  NO_PERMISSION: "text-gray-600 dark:text-gray-400",
};

function formatDate(iso: string | null, lang: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(lang === "en" ? "en-US" : "es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** Why a request cannot be sent now, for the button's title. */
function refusalText(
  refusal: string | null,
  next: string | null,
  d: I18nRecord,
  lang: string
) {
  if (!refusal) return "";
  const text = trDynamic(`symptoms.wa_call_refusal_${refusal}`, d);
  return next
    ? `${text} ${tr("symptoms.wa_call_next_request", d, { at: formatDate(next, lang) })}`
    : text;
}

export default function WhatsAppCallPermission({
  dict,
  phone,
  name,
  lang = "es",
}: Readonly<{
  dict: I18nRecord;
  phone: string | null | undefined;
  name?: string;
  lang?: string;
}>) {
  const { data, error, mutate } = useWhatsAppCallPermission(phone);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!phone || data?.callingEnabled === false) return null;
  if (error) {
    return (
      <div
        role="alert"
        className="px-4 pb-2 text-center text-xs text-amber-700 dark:text-amber-400"
      >
        {tr("symptoms.wa_call_status_failed", dict)}{" "}
        <button
          type="button"
          onClick={() => {
            void mutate();
          }}
          className="underline"
        >
          {tr("symptoms.wa_call_retry_status", dict)}
        </button>
      </div>
    );
  }
  if (!data) return null;

  const send = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await requestWhatsAppCallPermission(phone, name);
      await mutate(result.view, { revalidate: false });
      setMessage(
        result.sent
          ? tr("symptoms.wa_call_request_sent", dict)
          : refusalText(result.refusal, result.nextRequestAt, dict, lang)
      );
    } catch {
      setMessage(tr("symptoms.wa_call_request_failed", dict));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-2 px-4 pb-2 text-xs"
      data-testid="wa-call-permission"
    >
      <span className={`font-medium ${STATE_STYLE[data.state]}`}>
        {trDynamic(`symptoms.wa_call_state_${data.state}`, dict)}
      </span>
      {data.state === "CAN_CALL" && data.expiresAt && (
        <span className="text-gray-500 dark:text-gray-400">
          {tr("symptoms.wa_call_until", dict, {
            at: formatDate(data.expiresAt, lang),
          })}
        </span>
      )}
      {data.state !== "CAN_CALL" && (
        <button
          type="button"
          onClick={send}
          disabled={busy || !data.canRequest}
          title={refusalText(data.refusal, data.nextRequestAt, dict, lang)}
          className="rounded-md border border-gray-300 px-2 py-0.5 font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          {tr("symptoms.wa_call_request", dict)}
        </button>
      )}
      {message && (
        <span className="w-full text-center text-gray-600 dark:text-gray-400">
          {message}
        </span>
      )}
    </div>
  );
}
