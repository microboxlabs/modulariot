"use client";

import { HiAcademicCap, HiUserCircle } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useHarnessTrainerPermission } from "../hooks/use-harness-trainer-permission";
import { useOrganizationOwnerRole } from "../hooks/use-organization-owner-role";
import { usePermissionAssignmentForm } from "../hooks/use-permission-assignment-form";
import type { OrgMember } from "../types";
import {
  EnabledSwitchRow,
  MemberSearchInput,
  SaveFooter,
  UnavailableAssigneeRow,
} from "./permission-card-parts";

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
  const form = usePermissionAssignmentForm(permission, members, save);

  const busy = isLoading || membersLoading || ownerRoleLoading;
  const loadError = error || membersError || ownerRoleError;
  const ownerIds = new Set(ownerRole?.assigneeIds ?? []);

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
          <EnabledSwitchRow
            idPrefix="harness-trainer"
            label={tr("enabledLabel", trainerDict)}
            help={tr("enabledHelp", trainerDict)}
            checked={form.enabled}
            onChange={form.setEnabled}
          />

          <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {tr("assignedCount", trainerDict, {
                count: String(form.assigneeIds.size),
              })}
            </p>
            <MemberSearchInput
              label={tr("searchLabel", trainerDict)}
              placeholder={tr("searchPlaceholder", trainerDict)}
              value={form.query}
              onChange={form.setQuery}
            />
          </div>

          {members.length === 0 && form.unavailableAssigneeIds.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
              {tr("noMembers", trainerDict)}
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto overscroll-contain">
              {form.visibleMembers.map((member) => {
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
                        checked={isOwner || form.assigneeIds.has(member.id)}
                        disabled={isOwner}
                        title={
                          isOwner ? tr("ownersNote", trainerDict) : undefined
                        }
                        onChange={() => form.toggleAssignee(member.id)}
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
              {form.visibleMembers.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  {tr("noSearchResults", trainerDict)}
                </p>
              )}
              {form.unavailableAssigneeIds.map((personId) => (
                <UnavailableAssigneeRow
                  key={personId}
                  personId={personId}
                  label={tr("unavailableMember", trainerDict)}
                  onToggle={form.toggleAssignee}
                />
              ))}
            </div>
          )}

          <SaveFooter
            errors={[form.saveError && tr("saveError", trainerDict)]}
            disabled={isSaving || !form.hasChanges}
            onSave={form.handleSave}
            label={
              isSaving ? tr("saving", trainerDict) : tr("save", trainerDict)
            }
          />
        </>
      )}
    </section>
  );
}
