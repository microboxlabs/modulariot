"use client";

import { HiUserCircle } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { Conversation } from "../conversation.types";
import { conversationName, formatListTime } from "../format";

interface ConversationListProps {
  readonly conversations: Conversation[];
  readonly isLoading: boolean;
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly dict: I18nRecord;
}

/**
 * Left column: one row per conversation (driver name / phone, last-message preview, time, and an
 * unread badge), most-recently-active first. Mirrors the org-switcher list styling.
 */
export default function ConversationList({
  conversations,
  isLoading,
  selectedId,
  onSelect,
  dict,
}: ConversationListProps) {
  const shell =
    "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden";

  if (isLoading && conversations.length === 0) {
    return (
      <aside className={shell}>
        <div className="p-4 text-sm text-gray-500 dark:text-gray-400">{tr("loading", dict)}</div>
      </aside>
    );
  }

  if (conversations.length === 0) {
    return (
      <aside className={shell}>
        <div className="p-4 text-sm text-gray-500 dark:text-gray-400">{tr("empty", dict)}</div>
      </aside>
    );
  }

  return (
    <aside className={`${shell} self-start`}>
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
          {tr("listTitle", dict)}
        </h2>
      </div>
      <ul>
        {conversations.map((conversation, idx) => {
          const isActive = conversation.id === selectedId;
          const isLast = idx === conversations.length - 1;
          const hasUnread = conversation.unreadCount > 0;
          return (
            <li key={conversation.id}>
              <button
                type="button"
                onClick={() => onSelect(conversation.id)}
                className={`w-full text-left flex items-center gap-3 px-4 h-16 cursor-pointer transition-all duration-300 ${
                  isActive
                    ? "bg-blue-50/50 dark:bg-blue-900/20"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                } ${isLast ? "" : "border-b border-gray-200 dark:border-gray-700"}`}
              >
                <HiUserCircle
                  className={`h-7 w-7 shrink-0 ${
                    isActive
                      ? "text-blue-500 dark:text-blue-400"
                      : "text-gray-400 dark:text-gray-500"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className={`block text-sm truncate ${
                        isActive
                          ? "font-semibold text-blue-700 dark:text-blue-300"
                          : "font-medium text-gray-900 dark:text-white"
                      }`}
                    >
                      {conversationName(conversation)}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                      {formatListTime(conversation.lastMessageAt)}
                    </span>
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                      {conversation.lastMessagePreview ?? ""}
                    </span>
                    {hasUnread && (
                      <span
                        className="shrink-0 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-green-500 text-white text-xs font-semibold"
                        aria-label={tr("unread", dict)}
                      >
                        {conversation.unreadCount}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
