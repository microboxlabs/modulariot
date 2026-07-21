"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  HiBell,
  HiCheck,
  HiLightningBolt,
  HiOutlineArrowRight,
  HiOutlineClock,
  HiOutlinePlus,
  HiOutlineX,
} from "react-icons/hi";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useLoadNotifications } from "@/features/notifications/hooks/use-load-notifications";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import { jobTypeLabel, relativeAge, shortJobId, type JobEventPayload } from "../integration-job.types";
import { useJobEvents } from "../use-job-events";

/**
 * Topbar notification bell.
 *
 * Keeps the historical behavior (unread Alfresco notification count, link to
 * the /notifications inbox) and adds a live "integration activity" dropdown
 * fed by the quarkus-sse `integrations.job` stream, with a deep link into the
 * job console.
 */

const TRANSITION_ICON: Record<
  JobEventPayload["transition"],
  { icon: typeof HiCheck; className: string }
> = {
  enqueued: { icon: HiOutlinePlus, className: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300" },
  claimed: { icon: HiLightningBolt, className: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300" },
  succeeded: { icon: HiCheck, className: "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300" },
  retry_scheduled: {
    icon: HiOutlineClock,
    className: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
  },
  failed: { icon: HiOutlineX, className: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300" },
  retried: { icon: HiLightningBolt, className: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300" },
};

interface NotificationBellProps {
  readonly dict: I18nRecord;
}

export default function NotificationBell({ dict }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const { data: notifications } = useLoadNotifications();
  const { activeOrg } = useOrgScopes();
  const { events, unseen, connected, markAllSeen } = useJobEvents(activeOrg?.slug ?? null);

  let unreadNotifications = 0;
  if (notifications?.notifications && Array.isArray(notifications.notifications)) {
    unreadNotifications = notifications.notifications.filter(
      (notification: { is_read?: boolean }) => !notification.is_read,
    ).length;
  }
  const badgeCount = unreadNotifications + unseen;

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const bellDict = dict;
  const shown = events.slice(0, 12);

  function toggleOpen() {
    setOpen((wasOpen) => {
      if (!wasOpen) markAllSeen();
      return !wasOpen;
    });
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className="h-10 w-10 select-none cursor-pointer relative flex items-center justify-center p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border border-transparent transition-all duration-300 hover:border-gray-300 dark:hover:border-gray-600 active:ring-2 active:ring-gray-300 dark:active:ring-gray-600"
      >
        {badgeCount > 0 && (
          <div
            className={`absolute flex items-center justify-center ${
              badgeCount.toString().length > 1 ? "w-7 -left-3" : "w-5 -left-1"
            } h-5 bg-red-400 dark:bg-red-600 text-xs font-medium text-white rounded-full -top-2 min-w-[1.25rem]`}
          >
            {badgeCount > 99 ? "99+" : badgeCount}
          </div>
        )}
        <span className="sr-only">{tr("pages.integrationJobs.bell.title", bellDict)}</span>
        <HiBell className="h-6 w-6 text-gray-500 dark:text-gray-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-96 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {/* header */}
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {tr("pages.integrationJobs.bell.title", bellDict)}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? "animate-pulse bg-green-500" : "bg-gray-400"}`} />
              {connected
                ? tr("pages.integrationJobs.live.connected", bellDict)
                : tr("pages.integrationJobs.live.disconnected", bellDict)}
            </span>
            <span className="flex-1" />
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              {tr("pages.integrationJobs.bell.viewAll", bellDict)}
              {unreadNotifications > 0 ? ` (${unreadNotifications})` : ""}
            </Link>
          </div>

          {/* integration activity feed */}
          <div className="max-h-96 overflow-auto">
            <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {tr("pages.integrationJobs.bell.integrations", bellDict)}
            </div>
            {shown.length === 0 && (
              <div className="px-4 pb-6 pt-4 text-center text-xs text-gray-400 dark:text-gray-500">
                {tr("pages.integrationJobs.bell.empty", bellDict)}
              </div>
            )}
            {shown.map((entry) => {
              const { icon: Icon, className } = TRANSITION_ICON[entry.payload.transition];
              const title = `${jobTypeLabel(entry.payload.jobType)} — ${tr(
                `pages.integrationJobs.transitions.${entry.payload.transition}`,
                bellDict,
              )}`;
              const detailParts = [
                entry.payload.correlationKey ?? shortJobId(entry.payload.jobId),
                `${entry.payload.attempts}/${entry.payload.maxAttempts}`,
              ];
              if (entry.payload.lastError) detailParts.push(entry.payload.lastError);
              return (
                <Link
                  key={entry.id}
                  href="/integrations/jobs"
                  onClick={() => setOpen(false)}
                  className="flex gap-3 border-b border-gray-50 px-4 py-2.5 last:border-0 hover:bg-gray-50 dark:border-gray-700/50 dark:hover:bg-gray-700/40"
                >
                  <span
                    className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${className}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-gray-900 dark:text-white">{title}</span>
                    <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">
                      {detailParts.join(" · ")}
                    </span>
                  </span>
                  <span className="flex-shrink-0 text-[10px] text-gray-400 dark:text-gray-500">
                    {relativeAge(new Date(entry.receivedAt).toISOString())}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* footer */}
          <div className="flex items-center border-t border-gray-100 px-4 py-2.5 dark:border-gray-700">
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {tr("pages.integrationJobs.bell.hint", bellDict)}
            </span>
            <span className="flex-1" />
            <Link
              href="/integrations/jobs"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              {tr("pages.integrationJobs.bell.openConsole", bellDict)}
              <HiOutlineArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
