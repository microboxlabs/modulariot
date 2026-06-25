"use client";

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useOrgMembers } from "../hooks/use-org-members";
import { useOrgModules } from "../hooks/use-org-modules";
import MembersList from "./members-list";
import ModulesList from "./modules-list";
import WhatsAppChannelCard from "../whatsapp/whatsapp-channel-card";

interface OrgDetailPanelProps {
  readonly orgSlug: string | null;
  readonly dict: I18nRecord;
}

/**
 * Right-column detail view. Shows the selected org's members and enabled
 * modules. Both sections load independently via SWR; the hooks skip the
 * fetch when orgSlug is null.
 */
export default function OrgDetailPanel({ orgSlug, dict }: OrgDetailPanelProps) {
  const {
    members,
    isLoading: membersLoading,
    error: membersError,
  } = useOrgMembers(orgSlug);
  const {
    modules,
    isLoading: modulesLoading,
    error: modulesError,
  } = useOrgModules(orgSlug);

  if (!orgSlug) {
    return (
      <div className="flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-sm text-gray-500 dark:text-gray-400">
        {tr("noSelection", dict)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 min-h-0">
      <ModulesList
        modules={modules}
        isLoading={modulesLoading}
        error={modulesError}
        dict={dict}
      />
      <WhatsAppChannelCard orgSlug={orgSlug} dict={dict} />
      <MembersList
        members={members}
        isLoading={membersLoading}
        error={membersError}
        dict={dict}
      />
    </div>
  );
}
