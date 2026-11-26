"use client";

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from "react";
import { Button } from "flowbite-react";
import {
  HiPlus,
  HiArrowUturnLeft,
  HiArrowUturnRight,
  HiArrowsPointingOut,
  HiOutlineSquares2X2,
  HiPencilSquare,
} from "react-icons/hi2";
import { DashboardGrid } from "@microboxlabs/miot-dashboard-ui/react";
import "@microboxlabs/miot-dashboard-ui/styles.css";
import Link from "next/link";
import { useSearchParams, usePathname, useParams } from "next/navigation";
import { KIOSK_PARAM } from "@/features/layout/hooks/use-kiosk-mode";
import { useDashboard } from "../../context/dashboard-context";
import { tr } from "@/features/i18n/tr.service";
import { useDashboardAccess } from "@/features/common/providers/client-api.provider";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { EmptyState } from "../empty-state";
import type { Visibility } from "../dashboard-setup/setup.types";
import { DashboardGridSkeleton } from "../dashboard-skeleton";
import type { DashboardPermissionsOptions } from "@microboxlabs/miot-dashboard-ui/react";

// ── Placeholder (skeleton or empty state) ──────────────────────────────

interface DashboardPlaceholderProps {
  isLoaded: boolean;
  dictionary: I18nRecord;
  onAdd?: () => void;
  canManagePermissions: boolean;
  permissions?: DashboardPermissionsOptions;
  started: boolean;
  tags: readonly string[];
  onFinishSetup: (
    tags: string[] | undefined,
    visibility?: Visibility
  ) => Promise<boolean>;
  visibility: Visibility;
  onVisibilityChange: (visibility: Visibility) => Promise<boolean>;
}

function DashboardPlaceholder({
  isLoaded,
  dictionary,
  onAdd,
  canManagePermissions,
  permissions,
  started,
  tags,
  onFinishSetup,
  visibility,
  onVisibilityChange,
}: Readonly<DashboardPlaceholderProps>) {
  if (isLoaded) {
    return (
      <EmptyState
        dictionary={dictionary}
        onAdd={onAdd}
        canManagePermissions={canManagePermissions}
        permissions={permissions}
        started={started}
        tags={tags}
        onFinishSetup={onFinishSetup}
        visibility={visibility}
        onVisibilityChange={onVisibilityChange}
      />
    );
  }
  return <DashboardGridSkeleton />;
}
import { WidgetRenderer } from "../widget-renderer";
import { AddWidgetModal } from "../add-widget-modal/add-widget-modal";
import { type GridLayoutItem, type Widget } from "../../types/dashboard.types";

import { DashboardSettingsDropdown } from "../dashboard-settings-dropdown";
import type { DashboardSettingsHost } from "../dashboard-settings-dropdown/dashboard-settings-dropdown";
import DashboardShareDropdown from "../dashboard-share-dropdown/dashboard-share-dropdown";
import { DashboardFilterBadges } from "../dashboard-filters-card/dashboard-filters-card";
import { SectionHeader } from "@/features/layout/components/section-header/section-header";
import { nameInFolder } from "../dashboard-explorer/explorer-tree";

const NO_FOLDERS: readonly { name: string; href: string }[] = [];

/**
 * Whether the setup's permissions step is the caller's to take. The legacy
 * host keeps permissions inside its settings dropdown, so not there.
 */
function canManagePermissionsIn(
  host: DashboardSettingsHost | undefined
): boolean {
  return host?.canManagePermissions === true && !!host.onManagePermissions;
}

function renderRootWidget(widget: Widget) {
  return <WidgetRenderer widget={widget} isRoot />;
}

/**
 * Main dashboard view component
 * Renders all root-level widgets with edit mode controls using react-grid-layout
 */
interface DashboardViewProps {
  /** Rendered before the edit-mode button, e.g. a host's save controls. */
  headerActions?: ReactNode;
  settingsHost?: DashboardSettingsHost;
  /**
   * The breadcrumb's first crumb, a sidebar label key: "home" for the legacy
   * dashboards, "dashboardServer" ("Dashboards") for the organization's.
   */
  breadcrumbRoot?: string;
  /** Where the first crumb leads back to; plain text without it. */
  breadcrumbRootHref?: string;
  /**
   * The folders the dashboard is in, top first, as crumbs between the first
   * one and its name. A name saved with them in front ("Ops/Fleet") shows
   * without them, as in the list.
   */
  breadcrumbFolders?: readonly { name: string; href: string }[];
}

export function DashboardView({
  headerActions,
  settingsHost,
  breadcrumbRoot = "home",
  breadcrumbRootHref,
  breadcrumbFolders = NO_FOLDERS,
}: Readonly<DashboardViewProps> = {}) {
  const {
    registry,
    widgets,
    editMode,
    isKiosk,
    isLoaded,
    dashboardName,
    setDashboardName,
    dictionary,
    siteId,
    hostAccess,
    started,
    tags,
    visibility,
    setDetails,
    toggleEditMode,
    setEditMode,
    updateWidgetLayouts,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useDashboard();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const params = useParams<{ lang: string; slug: string }>();

  const legacyAccess = useDashboardAccess(
    hostAccess ? null : siteId,
    params.slug
  );
  const { canEdit, canManagePermissions } = hostAccess ?? legacyAccess;

  // Force edit mode off for read-only users so they can never accidentally
  // stay in edit mode if their role was downgraded mid-session.
  useEffect(() => {
    if (!canEdit && editMode) {
      setEditMode(false);
    }
  }, [canEdit, editMode, setEditMode]);

  const kioskUrl = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(KIOSK_PARAM, "true");
    return `${pathname}?${params.toString()}`;
  }, [searchParams, pathname]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const hasWidgets = isLoaded && widgets.length > 0;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editMode) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== "z") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (target?.isContentEditable) return;

      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
    };
    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [editMode, undo, redo]);

  const handleLayoutCommit = useCallback(
    (items: GridLayoutItem[]) => {
      if (canEdit && editMode) updateWidgetLayouts(null, items);
    },
    [canEdit, editMode, updateWidgetLayouts]
  );

  /** Leaving the setup's tags step: its tags are saved and the setup is over. */
  const saveDetails = settingsHost?.saveDetails;
  const finishSetup = useCallback(
    async (nextTags: string[] | undefined, nextVisibility?: Visibility) => {
      const details = {
        ...(nextTags === undefined ? {} : { tags: nextTags }),
        started: true,
        ...(nextVisibility === undefined ? {} : { visibility: nextVisibility }),
      };
      if (saveDetails) return saveDetails(details);
      setDetails(details);
      return true;
    },
    [setDetails, saveDetails]
  );

  const changeVisibility = useCallback(
    async (next: Visibility) => {
      if (saveDetails) return saveDetails({ visibility: next });
      setDetails({ visibility: next });
      return true;
    },
    [setDetails, saveDetails]
  );

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header (hidden in kiosk mode) */}
      {!isKiosk && (
        <SectionHeader
          path={[
            breadcrumbRoot,
            ...breadcrumbFolders.map((folder) => folder.name),
            nameInFolder(dashboardName, breadcrumbFolders),
          ]}
          crumbHrefs={[
            undefined,
            ...breadcrumbFolders.map((folder) => folder.href),
          ]}
          rootIcon={<HiOutlineSquares2X2 className="mr-2 h-4 w-4" />}
          rootHref={breadcrumbRootHref}
          breadcrumbDict={
            (
              ((dictionary as I18nRecord)["layout"] as I18nRecord)[
                "secured"
              ] as I18nRecord
            )["sidebar"] as I18nRecord
          }
          lang={params.lang}
          filterDict={dictionary}
          editableLastCrumb={editMode}
          onEditLastCrumb={setDashboardName}
          leftContent={
            isLoaded ? undefined : (
              <div className="h-7 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            )
          }
          rightContent={
            <div className="flex shrink-0 items-center gap-2">
              {editMode && (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    color="light"
                    onClick={undo}
                    disabled={!canUndo()}
                    title={`${tr("dashboard.undo", dictionary)} (Ctrl+Z)`}
                  >
                    <HiArrowUturnLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    color="light"
                    onClick={redo}
                    disabled={!canRedo()}
                    title={`${tr("dashboard.redo", dictionary)} (Ctrl+Shift+Z)`}
                  >
                    <HiArrowUturnRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {headerActions}
              {hasWidgets && canEdit && (
                <Button
                  color={editMode ? "blue" : "light"}
                  onClick={toggleEditMode}
                  size="sm"
                  className="font-light flex flex-row gap-1"
                >
                  <HiPencilSquare className="h-4 w-4" />
                  {tr("dashboard.editMode", dictionary)}
                </Button>
              )}
              {canEdit && (!hostAccess || settingsHost) && (
                <DashboardSettingsDropdown
                  canManagePermissions={
                    settingsHost?.canManagePermissions ?? canManagePermissions
                  }
                  host={settingsHost}
                />
              )}
              <DashboardShareDropdown />
              <Link
                href={kioskUrl}
                target="_blank"
                title={tr("dashboard.kioskMode", dictionary)}
                className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-2.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
              >
                <HiArrowsPointingOut className="h-4 w-4" />
              </Link>
            </div>
          }
        />
      )}

      {/* Filter badges row — transparent, sits between header and content */}
      {!isKiosk && (
        <div className="shrink-0 px-2 py-2 bg-white dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          <DashboardFilterBadges />
        </div>
      )}

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4">
        <div className="w-full min-h-full">
          {hasWidgets ? (
            <DashboardGrid
              widgets={widgets}
              registry={registry}
              editMode={canEdit && editMode}
              onLayoutCommit={handleLayoutCommit}
              renderWidget={renderRootWidget}
            />
          ) : (
            <DashboardPlaceholder
              isLoaded={isLoaded}
              dictionary={dictionary}
              onAdd={canEdit ? () => setIsAddModalOpen(true) : undefined}
              canManagePermissions={canManagePermissionsIn(settingsHost)}
              permissions={settingsHost?.permissions}
              started={started}
              tags={tags}
              onFinishSetup={finishSetup}
              visibility={visibility}
              onVisibilityChange={changeVisibility}
            />
          )}

          {/* Add new widget button — outside the scaled grid */}
          {hasWidgets && editMode && (
            <div className="flex justify-center pt-4">
              <Button color="light" onClick={() => setIsAddModalOpen(true)}>
                <HiPlus className="mr-2 h-4 w-4" />
                {tr("dashboard.addWidget", dictionary)}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Add widget modal */}
      <AddWidgetModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        parentId={null}
        parentComponentId={null}
      />

      {/* Custom styles for root grid */}
      <style>{`
        /* Widget controls - hidden by default */
        .widget-controls {
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease;
        }

        /* Show controls ONLY when this specific widget is hovered */
        .widget-wrapper:hover > .widget-controls {
          opacity: 1;
          pointer-events: auto;
        }

        /* Hide parent controls when ANY child widget is hovered */
        .widget-wrapper:has(.widget-wrapper:hover) > .widget-controls {
          opacity: 0 !important;
          pointer-events: none !important;
        }

        .dashboard-root-grid {
          user-select: none;
          -webkit-user-select: none;
        }

        .dashboard-root-grid .react-grid-item {
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        /* Placeholder shown when dragging/resizing */
        .dashboard-root-grid .react-grid-item.react-grid-placeholder {
          background: rgba(59, 130, 246, 0.08) !important;
          border: 2px dashed rgba(59, 130, 246, 0.4) !important;
          border-radius: 0.5rem;
          opacity: 1 !important;
        }

        .dashboard-root-grid .react-grid-item.react-draggable-dragging {
          z-index: 40;
          box-shadow:
            0 20px 25px -5px rgba(0, 0, 0, 0.1),
            0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        /* Hide all resize handles by default and reset transforms */
        .dashboard-root-grid .react-grid-item > .react-resizable-handle {
          background: none !important;
          opacity: 0;
          transition: opacity 0.15s ease;
          transform: none !important;
          z-index: 20;
        }

        .dashboard-root-grid .react-grid-item > .react-resizable-handle::after {
          transform: none !important;
        }

        /* Show handles on hover */
        .dashboard-root-grid .react-grid-item:hover > .react-resizable-handle {
          opacity: 1;
        }

        /* East (right) handle - thin border line */
        .dashboard-root-grid .react-grid-item > .react-resizable-handle-e {
          width: 6px !important;
          height: 100% !important;
          right: 0 !important;
          top: 0 !important;
          bottom: auto !important;
          left: auto !important;
          cursor: ew-resize;
        }
        .dashboard-root-grid
          .react-grid-item
          > .react-resizable-handle-e::after {
          content: "";
          position: absolute;
          right: 2px;
          top: 50%;
          transform: translateY(-50%) !important;
          width: 2px;
          height: 32px;
          background: rgba(156, 163, 175, 0.35);
          border-radius: 1px;
          border: none !important;
        }

        /* West (left) handle - thin border line */
        .dashboard-root-grid .react-grid-item > .react-resizable-handle-w {
          width: 6px !important;
          height: 100% !important;
          left: 0 !important;
          top: 0 !important;
          bottom: auto !important;
          right: auto !important;
          cursor: ew-resize;
        }
        .dashboard-root-grid
          .react-grid-item
          > .react-resizable-handle-w::after {
          content: "";
          position: absolute;
          left: 2px;
          top: 50%;
          transform: translateY(-50%) !important;
          width: 2px;
          height: 32px;
          background: rgba(156, 163, 175, 0.35);
          border-radius: 1px;
          border: none !important;
        }

        /* South (bottom) handle - thin border line */
        .dashboard-root-grid .react-grid-item > .react-resizable-handle-s {
          height: 6px !important;
          width: 100% !important;
          bottom: 0 !important;
          left: 0 !important;
          top: auto !important;
          right: auto !important;
          cursor: ns-resize;
        }
        .dashboard-root-grid
          .react-grid-item
          > .react-resizable-handle-s::after {
          content: "";
          position: absolute;
          bottom: 2px;
          left: 50%;
          transform: translateX(-50%) !important;
          height: 2px;
          width: 32px;
          background: rgba(156, 163, 175, 0.35);
          border-radius: 1px;
          border: none !important;
        }

        /* Southeast corner handle - diagonal lines */
        .dashboard-root-grid .react-grid-item > .react-resizable-handle-se {
          width: 16px !important;
          height: 16px !important;
          right: 0 !important;
          bottom: 0 !important;
          top: auto !important;
          left: auto !important;
          cursor: nwse-resize;
        }
        .dashboard-root-grid
          .react-grid-item
          > .react-resizable-handle-se::after {
          content: "";
          position: absolute;
          right: 4px;
          bottom: 4px;
          width: 8px;
          height: 8px;
          border-right: 2px solid rgba(156, 163, 175, 0.35);
          border-bottom: 2px solid rgba(156, 163, 175, 0.35);
          border-radius: 0 0 2px 0;
          background: none !important;
          transform: none !important;
        }

        /* Southwest corner handle - small dot */
        .dashboard-root-grid .react-grid-item > .react-resizable-handle-sw {
          width: 12px !important;
          height: 12px !important;
          left: 0 !important;
          bottom: 0 !important;
          top: auto !important;
          right: auto !important;
          cursor: nesw-resize;
        }
        .dashboard-root-grid
          .react-grid-item
          > .react-resizable-handle-sw::after {
          content: "";
          position: absolute;
          left: 3px;
          bottom: 3px;
          width: 6px;
          height: 6px;
          background: rgba(156, 163, 175, 0.6);
          border-radius: 50%;
          border: none !important;
          transform: none !important;
        }

        /* Hover state - make handles more visible */
        .dashboard-root-grid
          .react-grid-item:hover
          > .react-resizable-handle::after {
          background: rgba(107, 114, 128, 0.8);
        }
      `}</style>
    </div>
  );
}
