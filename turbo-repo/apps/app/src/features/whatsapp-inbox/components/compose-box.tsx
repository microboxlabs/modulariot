"use client";

import { useState } from "react";
import { HiPaperAirplane } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { Conversation } from "../conversation.types";
import { sendTextMessage } from "../inbox-data-service";

/**
 * Agent reply box at the foot of the thread. Free-text is only valid inside WhatsApp's 24h window, so
 * when {@code windowOpen} is false it collapses to a hint (a template would be needed to reopen). The
 * reply carries the thread's service code so it lands on the same service thread. On success it clears
 * and asks the parent to refresh; a rejected send shows the modulith's reason inline.
 */
export default function ComposeBox({
  conversation,
  windowOpen,
  onSent,
  dict,
}: {
  readonly conversation: Conversation;
  readonly windowOpen: boolean;
  readonly onSent: () => void;
  readonly dict: I18nRecord;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = windowOpen && !sending && text.trim().length > 0;

  async function handleSend() {
    if (!canSend) {
      return;
    }
    setSending(true);
    setError(null);
    try {
      await sendTextMessage({
        to: conversation.phoneE164,
        body: text.trim(),
        serviceCode: conversation.contextServiceCode,
        driverId: conversation.driverId,
      });
      setText("");
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("sendError", dict));
    } finally {
      setSending(false);
    }
  }

  if (!windowOpen) {
    return (
      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
        {tr("windowClosedHint", dict)}
      </div>
    );
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 p-3">
      {error && <p className="mb-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          rows={1}
          placeholder={tr("composePlaceholder", dict)}
          className="flex-1 resize-none rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!canSend}
          aria-label={tr("send", dict)}
          className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-green-500 text-white hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <HiPaperAirplane className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
