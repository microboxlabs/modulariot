"use client";

import { useEffect, useMemo, useState } from "react";
import { HiSearch, HiShieldCheck, HiUserCircle } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useContentReviewPermission } from "../hooks/use-content-review-permission";
import { useOrganizationOwnerRole } from "../hooks/use-organization-owner-role";
import type { OrgMember } from "../types";

interface ContentReviewPermissionCardProps {
  readonly orgSlug: string;
  readonly members: OrgMember[];
  readonly membersLoading: boolean;
  readonly membersError: Error | null;
  readonly dict: I18nRecord;
}

export default function ContentReviewPermissionCard({
  orgSlug,
  members,
  membersLoading,
  membersError,
  dict,
}: ContentReviewPermissionCardProps) {
  const permissionDict = dict?.contentReviewPermission as I18nRecord;
  const { permission, isLoading, isSaving, error, save } =
    useContentReviewPermission(orgSlug);
  const {
    role: ownerRole,
    isLoading: ownerRoleLoading,
    isSaving: ownerRoleSaving,
    error: ownerRoleError,
    save: saveOwnerRole,
  } = useOrganizationOwnerRole(orgSlug);
  const [enabled, setEnabled] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState(false);
  const [roleSaveError, setRoleSaveError] = useState(false);
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

  const handleRoleChange = async (personId: string, role: string) => {
    if (!ownerRole) return;
    const nextOwnerIds = new Set(ownerRole.assigneeIds);
    if (role === "OWNER") nextOwnerIds.add(personId);
    else nextOwnerIds.delete(personId);

    setRoleSaveError(false);
    try {
      await saveOwnerRole({
        assigneeIds: [...nextOwnerIds].sort((left, right) =>
          left.localeCompare(right)
        ),
      });
    } catch {
      setRoleSaveError(true);
    }
  };

  const busy = isLoading || membersLoading || ownerRoleLoading;
  const loadError = error || membersError || ownerRoleError;
  const ownerIds = new Set(ownerRole?.assigneeIds ?? []);
  const memberIds = new Set(members.map((member) => member.id));
  const unavailableAssigneeIds = [...assigneeIds]
    .filter((personId) => !memberIds.has(personId))
    .sort((left, right) => left.localeCompare(right));
  const hasAssigneesToRender =
    members.length > 0 || unavailableAssigneeIds.length > 0;
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
        <HiShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
            {tr("accessTitle", permissionDict)}
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {tr("accessDescription", permissionDict)}
          </p>
        </div>
        {!membersLoading && membersError == null && (
          <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {tr("memberCount", permissionDict, {
              count: String(members.length),
            })}
          </span>
        )}
      </div>

      <div>
        {busy && (
          <p className="px-4 py-5 text-sm text-gray-500 dark:text-gray-400">
            {tr("loading", dict)}
          </p>
        )}
        {!busy && loadError && (
          <p className="px-4 py-5 text-sm text-red-600 dark:text-red-400">
            {tr("loadError", permissionDict)}
          </p>
        )}
        {!busy && !loadError && (
          <>
            <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-4 py-4 dark:border-gray-700">
              <div className="min-w-0">
                <span
                  id="content-review-enabled-label"
                  className="block text-sm font-medium text-gray-900 dark:text-white"
                >
                  {tr("enabledLabel", permissionDict)}
                </span>
                <span
                  id="content-review-enabled-help"
                  className="block text-xs text-gray-500 dark:text-gray-400"
                >
                  {tr("enabledHelp", permissionDict)}
                </span>
              </div>
              <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                <input
                  type="checkbox"
                  role="switch"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                  aria-labelledby="content-review-enabled-label"
                  aria-describedby="content-review-enabled-help"
                  className="peer sr-only"
                />
                <span className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-transform after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 dark:bg-gray-600 dark:after:border-gray-500" />
              </label>
            </div>

            <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    {tr("membersTitle", dict)}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {tr("assignedCount", permissionDict, {
                      count: String(assigneeIds.size),
                    })}
                  </p>
                </div>
                <label className="relative block sm:w-72">
                  <span className="sr-only">
                    {tr("searchLabel", permissionDict)}
                  </span>
                  <HiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={tr("searchPlaceholder", permissionDict)}
                    className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </label>
              </div>
            </div>

            <div>
              {!hasAssigneesToRender ? (
                <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
                  {tr("noMembers", permissionDict)}
                </p>
              ) : (
                <div className="max-h-96 overflow-y-auto overscroll-contain">
                  <div className="sticky top-0 z-10 hidden grid-cols-[minmax(0,1fr)_10rem_11rem] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 sm:grid">
                    <span>{tr("memberColumn", permissionDict)}</span>
                    <span>{tr("accessColumn", permissionDict)}</span>
                    <span className="text-right">
                      {tr("permissionColumn", permissionDict)}
                    </span>
                  </div>
                  {visibleMembers.map((member) => (
                    <div
                      key={member.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 dark:border-gray-700 sm:grid-cols-[minmax(0,1fr)_10rem_11rem]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <HiUserCircle className="h-8 w-8 shrink-0 text-gray-400 dark:text-gray-500" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
                            {member.displayName || member.email}
                          </span>
                          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                            {member.email}
                          </span>
                        </span>
                      </div>
                      <select
                        value={ownerIds.has(member.id) ? "OWNER" : "MEMBER"}
                        disabled={
                          ownerRoleSaving ||
                          (ownerIds.has(member.id) && ownerIds.size === 1)
                        }
                        title={
                          ownerIds.has(member.id) && ownerIds.size === 1
                            ? tr("lastOwnerHelp", permissionDict)
                            : undefined
                        }
                        onChange={(event) =>
                          handleRoleChange(member.id, event.target.value)
                        }
                        aria-label={tr("memberRoleLabel", permissionDict, {
                          member: member.displayName || member.email,
                        })}
                        className="w-fit rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
                      >
                        <option value="MEMBER">
                          {tr("memberAccess", permissionDict)}
                        </option>
                        <option value="OWNER">
                          {tr("ownerAccess", permissionDict)}
                        </option>
                      </select>
                      <label className="relative ml-auto inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          role="switch"
                          checked={assigneeIds.has(member.id)}
                          onChange={() => toggleAssignee(member.id)}
                          aria-label={tr(
                            "memberPermissionLabel",
                            permissionDict,
                            {
                              member: member.displayName || member.email,
                            }
                          )}
                          className="peer sr-only"
                        />
                        <span className="h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-transform after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 dark:bg-gray-600 dark:after:border-gray-500" />
                      </label>
                    </div>
                  ))}
                  {visibleMembers.length === 0 && (
                    <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      {tr("noSearchResults", permissionDict)}
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
                        aria-label={`${personId}: ${tr(
                          "unavailableMember",
                          permissionDict
                        )}`}
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
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {saveError && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {tr("saveError", permissionDict)}
                  </p>
                )}
                {roleSaveError && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {tr("roleSaveError", permissionDict)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
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
