"use client";

import { useRef, useState } from "react";
import { HiClipboardList } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import { LynxMark } from "@modulariot/ui/brand/logo";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import ParametrizedFilterBar from "@/features/layout/components/secured-navbar/searchbar/parametrized-filter-bar";
import { getNavegationParams } from "@/features/layout/components/secured-navbar/searchbar/navegation_params";
import UserDropdown from "@/features/layout/components/user-dropdown/user-dropdown";
import type { NavBarMessages } from "@/features/layout/components/secured-navbar/secured-navbar.types";
import { SidebarProvider } from "@/features/sidebar/context/sidebar-context";
import { SidebarNavigationProvider } from "@/features/layout/context/sidebar-navigation-context";
import {
  HeaderPageActions,
  HeaderPageActionsProvider,
  SystemActions,
  UnifiedHeader,
  UnifiedSidebar,
} from "@/features/layout/components/unified-header";
import {
  AssignmentBarActions,
  FloatingActionsCart,
  SearchField,
} from "./mock-actions";

interface PreviewProps {
  dict: I18nRecord;
  messages: NavBarMessages;
  lang: string;
}

type ActionsMode = "bar" | "floating";

/* --------------------------------------------------------------------------
 * Segmented control
 * ------------------------------------------------------------------------ */

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: Readonly<{
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
}>) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-gray-300 p-0.5 dark:border-gray-600">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={twMerge(
            "rounded px-3 py-1 font-medium",
            value === o.value
              ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
              : "text-gray-600 dark:text-gray-300"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Preview shell
 *
 * Full-width header row with the owl in its left square; the sidebar sits
 * under it, and the filter bar + content sit beside the sidebar so the L2
 * panel only pushes that column.
 * ------------------------------------------------------------------------ */

function PreviewInner({ dict, messages }: Readonly<PreviewProps>) {
  const [showFilterBar, setShowFilterBar] = useState(true);
  const [actionsMode, setActionsMode] = useState<ActionsMode>("bar");
  const frameRef = useRef<HTMLDivElement>(null);

  const base = (dict.base ?? {}) as I18nRecord;
  const sidebarDict = (((dict.layout as I18nRecord)?.secured as I18nRecord)
    ?.sidebar ?? {}) as I18nRecord;
  const filterParams = getNavegationParams(dict, 0).shipping ?? [];

  const filterBarNode =
    showFilterBar && filterParams.length > 0 ? (
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-900">
        <ParametrizedFilterBar dict={dict} navegation_params={filterParams} />
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          Unified header — structuring test
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          The existing sidebar (IconBar + SecondaryPanel) + one header owning
          the breadcrumb/actions row.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800">
        <label className="flex items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400">Page actions</span>
          <Segmented
            value={actionsMode}
            onChange={setActionsMode}
            options={[
              { value: "bar", label: "in bar" },
              { value: "floating", label: "floating" },
            ]}
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showFilterBar}
            onChange={(e) => setShowFilterBar(e.target.checked)}
          />
          Route filter bar
        </label>
      </div>

      {/* Page-scoped actions injected into the header's page group */}
      {actionsMode === "bar" && (
        <HeaderPageActions>
          <AssignmentBarActions />
        </HeaderPageActions>
      )}

      {/* Framed mock "viewport" */}
      <div
        ref={frameRef}
        className="relative h-140 overflow-hidden rounded-xl border border-gray-300 shadow-sm dark:border-gray-600"
      >
        <div className="flex h-full flex-col">
          <UnifiedHeader
            brand={
              <LynxMark className="h-8 w-8 text-gray-900 dark:text-white" />
            }
            breadcrumb={
              <Breadcrumb
                path={["breadcrumb.tasks", "breadcrumb.shipping"]}
                rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
                dict={base}
                disableLinks
              />
            }
            search={<SearchField />}
            systemActions={
              <SystemActions dict={dict} isSearchEnabled={false} />
            }
            userActions={<UserDropdown messages={messages} />}
          />

          <div className="flex min-h-0 flex-1">
            <div className="h-full shrink-0">
              <UnifiedSidebar dict={sidebarDict} showLogo={false} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              {filterBarNode}
              <div className="min-w-0 flex-1 overflow-auto bg-gray-50 p-6 dark:bg-gray-900">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Route content renders here. Open a section in the sidebar to
                  see the L2 panel push only this column.
                </p>
              </div>
            </div>
          </div>
        </div>

        {actionsMode === "floating" && (
          <FloatingActionsCart boundsRef={frameRef} />
        )}
      </div>

      {/* Legend for the actions strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            n: "1",
            t: "Page-based",
            d: "Per-route controls a page injects via <HeaderPageActions> — the assignment-page tools here. 'in bar' = header page group; 'floating' = draggable cart.",
          },
          {
            n: "2",
            t: "System-based",
            d: "Harness chat toggle, notifications bell, day/night toggle.",
          },
          { n: "3", t: "User-based", d: "The user menu." },
        ].map((g) => (
          <div
            key={g.n}
            className="rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="mb-1 font-semibold text-gray-900 dark:text-white">
              {g.n}. {g.t}
            </div>
            <p className="text-gray-500 dark:text-gray-400">{g.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function UnifiedHeaderPreview(props: Readonly<PreviewProps>) {
  return (
    // Own SidebarProvider so the mock's L2 panel doesn't drive the real
    // sidebar that SecuredLayout still renders on this route.
    <SidebarProvider>
      <SidebarNavigationProvider isHarnessSettingsEnabled={false}>
        <HeaderPageActionsProvider>
          <PreviewInner {...props} />
        </HeaderPageActionsProvider>
      </SidebarNavigationProvider>
    </SidebarProvider>
  );
}
