"use client";

import { useEffect, useMemo, useState } from "react";
import { HiAcademicCap, HiSearch, HiUserCircle } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useHarnessTrainerPermission } from "../hooks/use-harness-trainer-permission";
import { useOrganizationOwnerRole } from "../hooks/use-organization-owner-role";
import type { OrgMember } from "../types";

interface HarnessTrainerPermissionCardProps {
  readonly orgSlug: string;
  readonly members: OrgMember[];
  readonly membersLoading: boolean;
  readonly membersError: Error | null;
  readonly dict: I18nRecord;
}

export default function HarnessTrainerPermissionCard({
  orgSlug,
  members,
  membersLoading,
  membersError,
  dict,
}: HarnessTrainerPermissionCardProps) {
  const trainerDict = dict?.harnessTrainerPermission as I18nRecord;
  const { permission, isLoading, isSaving, error, save } =
    useHarnessTrainerPermission(orgSlug);
  const {
    role: ownerRole,
    isLoading: ownerRoleLoading,
    error: ownerRoleError,
  } = useOrganizationOwnerRole(orgSlug);
  const [enabled, setEnabled] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState(false);
  const [query, setQuery] = useState("");

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
      await save({
        enabled,
        assigneeIds: [...assigneeIds].sort((left, right) =>
          left.localeCompare(right)
        ),
      });
    } catch {
      setSaveError(true);
    }
  };

  const busy = isLoading || membersLoading || ownerRoleLoading;
  const loadError = error || membersError || ownerRoleError;
  const ownerIds = new Set(ownerRole?.assigneeIds ?? []);
  const memberIds = new Set(members.map((member) => member.id));
  const unavailableAssigneeIds = [...assigneeIds]
    .filter((personId) => !memberIds.has(personId))
    .sort((left, right) => left.localeCompare(right));
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleMembers = useMemo(
    () =>
      members.filter((member) => {
        if (!normalizedQuery) return true;
        return [member.displayName, member.email].some((value) =>
          value?.toLocaleLowerCase().includes(normalizedQuery)
        );
      }),
    [members, normalizedQuery]
  );
  const hasChanges =
    permission != null &&
    (enabled !== permission.enabled ||
      assigneeIds.size !== permission.assigneeIds.length ||
      permission.assigneeIds.some((personId) => !assigneeIds.has(personId)));

  return (
    <section className="shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <HiAcademicCap className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
            {tr("title", trainerDict)}
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {tr("description", trainerDict)}
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {tr("ownersNote", trainerDict)}
          </p>
        </div>
      </div>

      <div>
        {busy && (
          <p className="px-4 py-5 text-sm text-gray-500 dark:text-gray-400">
            {tr("loading", dict)}
          </p>
        )}
        {!busy && loadError && (
          <p className="px-4 py-5 text-sm text-red-600 dark:text-red-400">
            {tr("loadError", trainerDict)}
          </p>
        )}
        {!busy && !loadError && (
          <>
            <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-4 py-4 dark:border-gray-700">
              <div className="min-w-0">
                <span
                  id="harness-trainer-enabled-label"
                  className="block text-sm font-medium text-gray-900 dark:text-white"
                >
                  {tr("enabledLabel", trainerDict)}
                </span>
                <span
                  id="harness-trainer-enabled-help"
                  className="block text-xs text-gray-500 dark:text-gray-400"
                >
                  {tr("enabledHelp", trainerDict)}
                </span>
              </div>
              <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                <input
                  type="checkbox"
                  role="switch"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                  aria-labelledby="harness-trainer-enabled-label"
                  aria-describedby="harness-trainer-enabled-help"
                  className="peer sr-only"
                />
                <span className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-transform after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 dark:bg-gray-600 dark:after:border-gray-500" />
              </label>
            </div>

            <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {tr("assignedCount", trainerDict, {
                    count: String(assigneeIds.size),
                  })}
                </p>
                <label className="relative block sm:w-72">
                  <span className="sr-only">
                    {tr("searchLabel", trainerDict)}
                  </span>
                  <HiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={tr("searchPlaceholder", trainerDict)}
                    className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </label>
              </div>
            </div>

            {members.length === 0 && unavailableAssigneeIds.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
                {tr("noMembers", trainerDict)}
              </p>
            ) : (
              <div className="max-h-96 overflow-y-auto overscroll-contain">
                {visibleMembers.map((member) => {
                  const name = member.displayName || member.email;
                  const isOwner = ownerIds.has(member.id);
                  return (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 dark:border-gray-700"
                    >
                      <HiUserCircle className="h-8 w-8 shrink-0 text-gray-400 dark:text-gray-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
                          {name}
                        </span>
                        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                          {member.email}
                        </span>
                      </span>
                      {isOwner && (
                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          {tr("ownerBadge", trainerDict)}
                        </span>
                      )}
                      <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                        <input
                          type="checkbox"
                          role="switch"
                          checked={isOwner || assigneeIds.has(member.id)}
                          disabled={isOwner}
                          title={
                            isOwner ? tr("ownersNote", trainerDict) : undefined
                          }
                          onChange={() => toggleAssignee(member.id)}
                          aria-label={tr("memberPermissionLabel", trainerDict, {
                            member: name,
                          })}
                          className="peer sr-only"
                        />
                        <span className="h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-transform after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-60 dark:bg-gray-600 dark:after:border-gray-500" />
                      </label>
                    </div>
                  );
                })}
                {visibleMembers.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    {tr("noSearchResults", trainerDict)}
                  </p>
                )}
                {unavailableAssigneeIds.map((personId) => (
                  <div
                    key={personId}
                    className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 last:border-b-0 dark:border-amber-800 dark:bg-amber-900/20"
                  >
                    <input
                      type="checkbox"
                      checked
                      onChange={() => toggleAssignee(personId)}
                      aria-label={`${personId}: ${tr("unavailableMember", trainerDict)}`}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-gray-900 dark:text-white">
                        {personId}
                      </span>
                      <span className="block text-xs text-amber-700 dark:text-amber-300">
                        {tr("unavailableMember", trainerDict)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {saveError && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {tr("saveError", trainerDict)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? tr("saving", trainerDict) : tr("save", trainerDict)}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
