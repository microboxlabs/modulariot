"use client";

import { HiUserCircle } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { Conversation } from "../conversation.types";
import { conversationName, formatListTime } from "../format";
import { groupConversations, type GroupBy } from "../grouping";
import ServiceBadge from "./service-badge";

interface ConversationListProps {
  readonly conversations: Conversation[];
  readonly isLoading: boolean;
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly groupBy: GroupBy;
  readonly onGroupByChange: (groupBy: GroupBy) => void;
  readonly dict: I18nRecord;
  readonly locale: string;
}

const GROUP_OPTIONS: readonly GroupBy[] = ["recent", "service", "driver"];
const GROUP_LABEL_KEY: Record<GroupBy, string> = {
  recent: "groupByRecent",
  service: "groupByService",
  driver: "groupByDriver",
};

/**
 * Left column: one row per conversation (driver name / phone, last-message preview, time, and an
 * unread badge), most-recently-active first. A "group by" control pivots the list flat, by service,
 * or by driver — a view over the per-phone threads, computed client-side.
 */
export default function ConversationList({
  conversations,
  isLoading,
  selectedId,
  onSelect,
  groupBy,
  onGroupByChange,
  dict,
  locale,
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

  const groups = groupConversations(conversations, groupBy, dict);

  return (
    <aside className={`${shell} self-start`}>
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
          {tr("listTitle", dict)}
        </h2>
        <label className="flex items-center text-xs text-gray-500 dark:text-gray-400">
          {/* Label kept for screen readers only — the select value already reads the current grouping,
              and an inline label wraps/cramps the 340px list header. */}
          <span className="sr-only">{tr("groupBy", dict)}</span>
          <select
            value={groupBy}
            onChange={(e) => onGroupByChange(e.target.value as GroupBy)}
            className="rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 py-1 pl-2 pr-6 text-xs text-gray-700 dark:text-gray-200 cursor-pointer"
            aria-label={tr("groupBy", dict)}
          >
            {GROUP_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {tr(GROUP_LABEL_KEY[option], dict)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ul>
        {groups.map((group) => (
          <li key={group.key}>
            {group.label !== null && (
              <div className="px-4 py-1.5 bg-gray-50 dark:bg-gray-900/40 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                {group.label}
              </div>
            )}
            <ul>
              {group.items.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  isActive={conversation.id === selectedId}
                  onSelect={onSelect}
                  dict={dict}
                  locale={locale}
                />
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function ConversationRow({
  conversation,
  isActive,
  onSelect,
  dict,
  locale,
}: {
  readonly conversation: Conversation;
  readonly isActive: boolean;
  readonly onSelect: (id: string) => void;
  readonly dict: I18nRecord;
  readonly locale: string;
}) {
  const hasUnread = conversation.unreadCount > 0;
  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      className={`w-full text-left flex items-center gap-3 px-4 h-16 cursor-pointer transition-all duration-300 border-b border-gray-200 dark:border-gray-700 ${
        isActive ? "bg-blue-50/50 dark:bg-blue-900/20" : "hover:bg-gray-100 dark:hover:bg-gray-700"
      }`}
    >
      <HiUserCircle
        className={`h-7 w-7 shrink-0 ${
          isActive ? "text-blue-500 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"
        }`}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 min-w-0">
            <span
              className={`block text-sm truncate ${
                isActive
                  ? "font-semibold text-blue-700 dark:text-blue-300"
                  : "font-medium text-gray-900 dark:text-white"
              }`}
            >
              {conversationName(conversation)}
            </span>
            {conversation.contextServiceCode && (
              <ServiceBadge code={conversation.contextServiceCode} dict={dict} />
            )}
          </span>
          <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
            {formatListTime(conversation.lastMessageAt, locale)}
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
  );
}
