"use client";

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useOrgMembers } from "../hooks/use-org-members";
import { useOrgModules } from "../hooks/use-org-modules";
import ModulesList from "./modules-list";
import GpsWebhookCard from "../gps-webhooks/gps-webhook-card";
import WhatsAppChannelCard from "../whatsapp/whatsapp-channel-card";
import ContentReviewPermissionCard from "./content-review-permission-card";
import type { OrgSummary } from "../types";

interface OrgDetailPanelProps {
  readonly organization: OrgSummary | null;
  readonly dict: I18nRecord;
}

/**
 * Right-column detail view. Shows the selected org's members and enabled
 * modules. Both sections load independently via SWR; the hooks skip the
 * fetch when orgSlug is null.
 */
export default function OrgDetailPanel({
  organization,
  dict,
}: OrgDetailPanelProps) {
  const orgSlug = organization?.slug ?? null;
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
    <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
      <ModulesList
        modules={modules}
        isLoading={modulesLoading}
        error={modulesError}
        dict={dict}
      />
      <ContentReviewPermissionCard
        orgSlug={orgSlug}
        members={members}
        membersLoading={membersLoading}
        membersError={membersError}
        canManage={
          organization?.role === "SITE_MANAGER" ||
          organization?.role === "GROUP_ADMIN"
        }
        dict={dict}
      />
      <WhatsAppChannelCard orgSlug={orgSlug} dict={dict} />
      <GpsWebhookCard orgSlug={orgSlug} dict={dict} />
    </div>
  );
}
