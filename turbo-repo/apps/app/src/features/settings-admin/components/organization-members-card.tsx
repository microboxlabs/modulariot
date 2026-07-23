"use client";

import { HiUserCircle, HiUsers } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { OrgMember } from "../types";

interface OrganizationMembersCardProps {
  readonly members: OrgMember[];
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly dict: I18nRecord;
}

/** Read-only roster for regular organization members. */
export default function OrganizationMembersCard({
  members,
  isLoading,
  error,
  dict,
}: Readonly<OrganizationMembersCardProps>) {
  return (
    <section className="shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <HiUsers className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
            {tr("membersTitle", dict)}
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {tr("membersDescription", dict)}
          </p>
        </div>
        {!isLoading && error == null && (
          <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {members.length}
          </span>
        )}
      </div>

      {isLoading && (
        <p className="px-4 py-5 text-sm text-gray-500 dark:text-gray-400">
          {tr("loading", dict)}
        </p>
      )}
      {!isLoading && error && (
        <p className="px-4 py-5 text-sm text-red-600 dark:text-red-400">
          {tr("loadError", dict)}
        </p>
      )}
      {!isLoading && error == null && members.length === 0 && (
        <p className="px-4 py-5 text-sm text-gray-500 dark:text-gray-400">
          {tr("membersEmpty", dict)}
        </p>
      )}
      {!isLoading && error == null && members.length > 0 && (
        <ul>
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 dark:border-gray-700"
            >
              <HiUserCircle className="h-8 w-8 shrink-0 text-gray-400 dark:text-gray-500" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
                  {member.displayName || member.email}
                </span>
                <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                  {member.email}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
