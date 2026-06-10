"use client";

import { HiUserGroup } from "react-icons/hi";
import { Tooltip } from "flowbite-react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

/**
 * Strip the Alfresco "GROUP_" authority prefix so candidate groups read as a
 * plain name (e.g. "GROUP_<name>" -> "<name>").
 */
function toGroupDisplayName(group: string): string {
  return group.replace(/^group_/i, "");
}

/**
 * Bento-header badge listing the candidate groups a pooled task is offered to.
 * Mirrors {@link TimeElement}'s bordered icon + tooltip styling. Renders nothing
 * when the task has no candidate groups.
 */
export default function CandidateGroupsElement({
  candidateGroups,
  dict,
}: {
  readonly candidateGroups?: string[];
  readonly dict: I18nRecord;
}) {
  const groups = (candidateGroups ?? [])
    .filter((g): g is string => typeof g === "string" && g.trim().length > 0)
    .map(toGroupDisplayName);

  if (groups.length === 0) {
    return null;
  }

  const label = (dict.bento as I18nRecord).candidate_groups as string;
  const groupNames = groups.join(", ");

  return (
    <Tooltip
      style="auto"
      content={
        <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-nowrap flex flex-col">
          <span className="font-medium">{label}</span>
          <span className="text-gray-900 dark:text-gray-100">{groupNames}</span>
        </div>
      }
    >
      <div className="h-10 flex justify-center items-center p-2 border border-gray-300 dark:border-gray-700 hover:border-gray-500 dark:hover:border-gray-500 rounded-lg transition-all duration-100 bg-white dark:bg-gray-800 gap-2 w-fit text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer">
        <div className="flex flex-row gap-2 items-center">
          <HiUserGroup className="w-5 h-5" width={30} height={30} />
          <p className="text-sm text-gray-900 dark:text-gray-100 lg:block hidden whitespace-nowrap">
            {groupNames}
          </p>
        </div>
      </div>
    </Tooltip>
  );
}
