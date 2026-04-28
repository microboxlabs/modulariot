"use client";

import { useOrgScopes } from "./use-org-scopes";
import { HiChevronDown, HiOfficeBuilding } from "react-icons/hi";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

interface OrgSwitcherProps {
  readonly dict: I18nRecord;
}

/**
 * Top-nav org switcher. Mirrors the dashboard-settings-dropdown panel style:
 * rounded-lg panel with shadow, bordered rows for each org, click-outside
 * and Escape-key dismissal.
 *
 * Hidden when the user has exactly one org (no switching needed).
 * The active org is highlighted with a blue left border accent.
 */
export default function OrgSwitcher({ dict }: OrgSwitcherProps) {
  const { activeOrg, availableOrgs, isLoading, switchOrg } = useOrgScopes();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const closePanel = useCallback(() => setOpen(false), []);

  const handleSwitch = useCallback(
    async (slug: string) => {
      if (slug === activeOrg?.slug) {
        closePanel();
        return;
      }
      setSwitching(true);
      closePanel();
      try {
        await switchOrg(slug);
      } catch (error) {
        console.error("Failed to switch organization", error);
        toast.error(
          error instanceof Error
            ? error.message
            : tr("orgSwitcher.changeOrgFailed", dict),
        );
        setSwitching(false);
      }
    },
    [activeOrg, switchOrg, closePanel, dict],
  );

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        closePanel();
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, closePanel]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };
    if (open) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, closePanel]);

  if (isLoading || !activeOrg || availableOrgs.length <= 1) return null;

  return (
    <div ref={dropdownRef} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={switching}
        className="h-10 select-none cursor-pointer flex items-center gap-1.5 px-2.5 bg-gray-100 dark:bg-gray-700 rounded-lg border border-transparent transition-all duration-300 hover:border-gray-300 dark:hover:border-gray-600 active:ring-2 active:ring-gray-300 dark:active:ring-gray-600 disabled:opacity-50"
      >
        <HiOfficeBuilding className="h-5 w-5 text-gray-500 dark:text-gray-400 shrink-0" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-[140px]">
          {activeOrg.displayName}
        </span>
        <HiChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform duration-200 shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute z-50 right-0 top-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-[240px] w-[280px] overflow-hidden">
          {availableOrgs.map((org, idx) => {
            const isActive = org.slug === activeOrg.slug;
            const isLast = idx === availableOrgs.length - 1;
            return (
              <button
                key={org.slug}
                type="button"
                onClick={() => handleSwitch(org.slug)}
                className={`w-full text-left flex items-center gap-3 px-4 h-14 cursor-pointer transition-all duration-300 ${
                  isActive
                    ? "bg-blue-50/50 dark:bg-blue-900/20"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                } ${isLast ? "" : "border-b border-gray-200 dark:border-gray-700"}`}
              >
                <HiOfficeBuilding
                  className={`h-5 w-5 shrink-0 ${
                    isActive
                      ? "text-blue-500 dark:text-blue-400"
                      : "text-gray-400 dark:text-gray-500"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm truncate ${
                      isActive
                        ? "font-semibold text-blue-700 dark:text-blue-300"
                        : "font-medium text-gray-900 dark:text-white"
                    }`}
                  >
                    {org.displayName}
                  </span>
                  {org.isParent && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Cuenta principal
                    </span>
                  )}
                  {!org.isParent && org.taxId && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {org.taxId}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
