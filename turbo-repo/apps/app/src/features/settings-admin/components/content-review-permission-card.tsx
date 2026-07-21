"use client";

import { useEffect, useState } from "react";
import {
  HiCheckCircle,
  HiExclamationCircle,
  HiPhotograph,
} from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useContentReviewPermission } from "../hooks/use-content-review-permission";
import type { OrgMember } from "../types";

interface ContentReviewPermissionCardProps {
  readonly orgSlug: string;
  readonly members: OrgMember[];
  readonly membersLoading: boolean;
  readonly dict: I18nRecord;
}

export default function ContentReviewPermissionCard({
  orgSlug,
  members,
  membersLoading,
  dict,
}: ContentReviewPermissionCardProps) {
  const permissionDict = dict?.contentReviewPermission as I18nRecord;
  const { permission, isLoading, isSaving, error, save } =
    useContentReviewPermission(orgSlug);
  const [enabled, setEnabled] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    if (!permission) return;
    setEnabled(permission.enabled);
    setAssigneeIds(new Set(permission.assigneeIds));
  }, [permission]);

  const toggleAssignee = (personId: string) => {
    setAssigneeIds((current) => {
      const next = new Set(current);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaveError(false);
    try {
      await save({ enabled, assigneeIds: [...assigneeIds].sort() });
    } catch {
      setSaveError(true);
    }
  };

  const busy = isLoading || membersLoading;
  const memberIds = new Set(members.map((member) => member.id));
  const unavailableAssigneeIds = [...assigneeIds]
    .filter((personId) => !memberIds.has(personId))
    .sort();
  const hasAssigneesToRender =
    members.length > 0 || unavailableAssigneeIds.length > 0;

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <HiPhotograph className="mt-0.5 h-5 w-5 shrink-0 text-gray-500 dark:text-gray-400" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
            {tr("title", permissionDict)}
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {tr("description", permissionDict)}
          </p>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {busy && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("loading", dict)}
          </p>
        )}
        {!busy && error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {tr("loadError", permissionDict)}
          </p>
        )}
        {!busy && !error && (
          <>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              <span>
                <span className="block text-sm font-medium text-gray-900 dark:text-white">
                  {tr("enabledLabel", permissionDict)}
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  {tr("enabledHelp", permissionDict)}
                </span>
              </span>
            </label>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                {tr("assigneesLabel", permissionDict)}
              </p>
              {!hasAssigneesToRender ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {tr("noMembers", permissionDict)}
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {members.map((member) => (
                    <label
                      key={member.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
                    >
                      <input
                        type="checkbox"
                        checked={assigneeIds.has(member.id)}
                        onChange={() => toggleAssignee(member.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-gray-900 dark:text-white">
                          {member.displayName || member.email}
                        </span>
                        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                          {member.email}
                        </span>
                      </span>
                    </label>
                  ))}
                  {unavailableAssigneeIds.map((personId) => (
                    <label
                      key={personId}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-amber-300 px-3 py-2 dark:border-amber-700"
                    >
                      <input
                        type="checkbox"
                        checked
                        onChange={() => toggleAssignee(personId)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-gray-900 dark:text-white">
                          {personId}
                        </span>
                        <span className="block text-xs text-amber-700 dark:text-amber-300">
                          {tr("unavailableMember", permissionDict)}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {permission?.projectionStatus === "FAILED" && (
              <p className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                <HiExclamationCircle className="h-4 w-4 shrink-0" />
                {tr("projectionFailed", permissionDict)}
              </p>
            )}
            {permission?.projectionStatus === "SYNCED" &&
              permission.projectedAt && (
                <p className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                  <HiCheckCircle className="h-4 w-4 shrink-0" />
                  {tr("projectionSynced", permissionDict)}
                </p>
              )}
            {saveError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {tr("saveError", permissionDict)}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving
                  ? tr("saving", permissionDict)
                  : tr("save", permissionDict)}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
