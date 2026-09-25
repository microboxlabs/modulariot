"use client";

import { usePathname } from "next/navigation";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import CustomThemeToggle from "@/features/theme/components/CustomThemeToggle";
import NotificationBell from "@/features/integration-jobs/components/notification-bell";
import HarnessChatToggleButton from "@/features/harness-chat/harness-chat-toggle-button";

/**
 * System-scoped header controls: harness chat toggle, notifications, and the
 * day/night toggle. Same components the old navbar rendered — regrouped here
 * as the header's "system" action cluster.
 */
export function SystemActions({
  dict,
  isSearchEnabled = true,
}: Readonly<{ dict: I18nRecord; isSearchEnabled?: boolean }>) {
  const pathname = usePathname();

  return (
    <>
      {isSearchEnabled && <HarnessChatToggleButton dict={dict} />}
      {!pathname.includes("/notifications") && <NotificationBell dict={dict} />}
      <div className="hidden md:block">
        <CustomThemeToggle />
      </div>
    </>
  );
}
