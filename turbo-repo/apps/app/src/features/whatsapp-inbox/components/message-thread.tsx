"use client";

import { useEffect } from "react";
import { Spinner } from "flowbite-react";
import { HiCheck, HiOutlineExclamationCircle } from "react-icons/hi";
import { HiMiniCheckCircle } from "react-icons/hi2";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { Conversation, Message, MessageStatus } from "../conversation.types";
import { conversationName, formatClockTime } from "../format";
import { useMessages } from "../use-messages";
import { markConversationRead } from "../inbox-data-service";

interface MessageThreadProps {
  readonly conversationId: string | null;
  readonly conversation: Conversation | null;
  readonly dict: I18nRecord;
  readonly onRead: () => void;
}

/**
 * Right column: the selected conversation's timeline as chat bubbles — driver replies on the left,
 * our outbound on the right with delivery-status ticks. Opening a thread with unread messages
 * clears its badge (and refreshes the list so the badge disappears there too).
 */
export default function MessageThread({
  conversationId,
  conversation,
  dict,
  onRead,
}: MessageThreadProps) {
  const { messages, isLoading, error } = useMessages(conversationId);

  const unreadCount = conversation?.unreadCount ?? 0;
  useEffect(() => {
    if (!conversationId || unreadCount <= 0) return;
    markConversationRead(conversationId)
      .then(onRead)
      .catch(() => {
        /* a failed mark-read is non-blocking; the badge just lingers until next time */
      });
  }, [conversationId, unreadCount, onRead]);

  if (!conversationId || !conversation) {
    return (
      <div className="flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-sm text-gray-500 dark:text-gray-400">
        {tr("noSelection", dict)}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
          {conversationName(conversation)}
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">{conversation.phoneE164}</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-2">
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400">{tr("loadError", dict)}</div>
        )}
        {isLoading && messages.length === 0 && (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        )}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} dict={dict} />
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message, dict }: { message: Message; dict: I18nRecord }) {
  const outbound = message.direction === "OUTBOUND";
  return (
    <div className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-lg px-3 py-2 text-sm ${
          outbound
            ? "bg-green-100 dark:bg-green-900/40 text-gray-900 dark:text-gray-100"
            : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{renderContent(message, dict)}</p>
        <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-gray-500 dark:text-gray-400">
          {formatClockTime(message.createdAt)}
          {outbound && <StatusTicks status={message.status} dict={dict} />}
        </span>
      </div>
    </div>
  );
}

function renderContent(message: Message, dict: I18nRecord): string {
  if (message.body && message.body.trim()) {
    return message.body;
  }
  if (message.type === "TEMPLATE" && message.templateName) {
    return `${tr("template", dict)}: ${message.templateName}`;
  }
  if (message.mediaRef) {
    return `${tr("attachment", dict)} (${message.mediaFileName ?? message.type.toLowerCase()})`;
  }
  return "";
}

function StatusTicks({ status, dict }: { status: MessageStatus; dict: I18nRecord }) {
  switch (status) {
    case "READ":
      return (
        <HiMiniCheckCircle className="h-3.5 w-3.5 text-blue-500" title={tr("statusRead", dict)} />
      );
    case "DELIVERED":
      return (
        <HiMiniCheckCircle
          className="h-3.5 w-3.5 text-gray-400"
          title={tr("statusDelivered", dict)}
        />
      );
    case "SENT":
      return <HiCheck className="h-3.5 w-3.5 text-gray-400" title={tr("statusSent", dict)} />;
    case "FAILED":
      return (
        <HiOutlineExclamationCircle
          className="h-3.5 w-3.5 text-red-500"
          title={tr("statusFailed", dict)}
        />
      );
    default:
      return null;
  }
}
