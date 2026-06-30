"use client";

import { useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useConversations } from "../use-conversations";
import ConversationList from "./conversation-list";
import MessageThread from "./message-thread";

interface ConversationsPageContentProps {
  readonly dict: I18nRecord;
  readonly locale: string;
}

/**
 * WhatsApp Conversations inbox — two-column master/detail over the active org's message pool.
 * Left: conversation list (polled). Right: the selected thread (polled), which clears the unread
 * badge on open. The active org is resolved server-side by the proxy routes.
 */
export default function ConversationsPageContent({ dict, locale }: ConversationsPageContentProps) {
  const { conversations, isLoading, error, refresh } = useConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      <div className="flex items-center gap-3">
        <FaWhatsapp className="h-6 w-6 text-green-500" />
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {tr("title", dict)}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{tr("description", dict)}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {tr("loadError", dict)}
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[340px_1fr] gap-4">
        <ConversationList
          conversations={conversations}
          isLoading={isLoading}
          selectedId={selectedId}
          onSelect={setSelectedId}
          dict={dict}
          locale={locale}
        />
        <MessageThread
          conversationId={selectedId}
          conversation={selected}
          dict={dict}
          locale={locale}
          onRead={refresh}
        />
      </div>
    </div>
  );
}
