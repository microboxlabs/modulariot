"use client";

import { HiUserCircle } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { OrgMember } from "../types";

interface MembersListProps {
  readonly members: OrgMember[];
  readonly isLoading: boolean;
  readonly error: unknown;
  readonly dict: I18nRecord;
}

/**
 * Flat list of Alfresco people in the org's group. Read-only for Phase 3;
 * the "assign to org" and "remove from org" actions land in Phase 5.
 */
export default function MembersList({
  members,
  isLoading,
  error,
  dict,
}: MembersListProps) {
  return (
    <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
            {tr("membersTitle", dict)}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {tr("membersDescription", dict)}
          </p>
        </div>
        {!isLoading && !error && (
          <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
            {members.length}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        {isLoading && (
          <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
            {tr("loading", dict)}
          </p>
        )}
        {!isLoading && error != null && (
          <p className="px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {tr("loadError", dict)}
          </p>
        )}
        {!isLoading && !error && members.length === 0 && (
          <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
            {tr("membersEmpty", dict)}
          </p>
        )}
        {!isLoading && !error && members.length > 0 && (
          <ul>
            {members.map((member, idx) => {
              const isLast = idx === members.length - 1;
              return (
                <li
                  key={member.id}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    !isLast
                      ? "border-b border-gray-200 dark:border-gray-700"
                      : ""
                  }`}
                >
                  <HiUserCircle className="h-8 w-8 text-gray-400 dark:text-gray-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {member.displayName || member.email}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {member.email}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
