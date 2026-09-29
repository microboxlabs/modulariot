"use client";

import { useState } from "react";
import { HiShieldCheck, HiUserCircle } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useContentReviewPermission } from "../hooks/use-content-review-permission";
import { useOrganizationOwnerRole } from "../hooks/use-organization-owner-role";
import { usePermissionAssignmentForm } from "../hooks/use-permission-assignment-form";
import type { OrgMember } from "../types";
import {
  EnabledSwitchRow,
  MemberSearchInput,
  SaveFooter,
  UnavailableAssigneeRow,
} from "./permission-card-parts";

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
  const [roleSaveError, setRoleSaveError] = useState(false);
  const {
    enabled,
    setEnabled,
    assigneeIds,
    toggleAssignee,
    query,
    setQuery,
    visibleMembers,
    unavailableAssigneeIds,
    hasChanges,
    saveError,
    handleSave,
  } = usePermissionAssignmentForm(permission, members, save);

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
  const hasAssigneesToRender =
    members.length > 0 || unavailableAssigneeIds.length > 0;

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
            <EnabledSwitchRow
              idPrefix="content-review"
              label={tr("enabledLabel", permissionDict)}
              help={tr("enabledHelp", permissionDict)}
              checked={enabled}
              onChange={setEnabled}
            />

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
                <MemberSearchInput
                  label={tr("searchLabel", permissionDict)}
                  placeholder={tr("searchPlaceholder", permissionDict)}
                  value={query}
                  onChange={setQuery}
                />
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
                    <UnavailableAssigneeRow
                      key={personId}
                      personId={personId}
                      label={tr("unavailableMember", permissionDict)}
                      onToggle={toggleAssignee}
                    />
                  ))}
                </div>
              )}
            </div>

            <SaveFooter
              errors={[
                saveError && tr("saveError", permissionDict),
                roleSaveError && tr("roleSaveError", permissionDict),
              ]}
              disabled={isSaving || !hasChanges}
              onSave={handleSave}
              label={
                isSaving
                  ? tr("saving", permissionDict)
                  : tr("save", permissionDict)
              }
            />
          </>
        )}
      </div>
    </section>
  );
}
