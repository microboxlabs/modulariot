"use client";

/**
 * The page's own breadcrumb bar while a folder is open: "Dashboards", then
 * every folder from the top level down to the open one. The ones above it
 * are buttons that open them, and places to drop items into, so they can be
 * moved up without leaving the folder. Looks like the app's breadcrumb,
 * which it stands in for.
 */
import type { DragEvent, ReactNode } from "react";
import {
  Breadcrumb as FlowbiteBreadcrumb,
  BreadcrumbItem,
} from "flowbite-react";
import { twMerge } from "tailwind-merge";

interface ExplorerBreadcrumbProps {
  /** The open folder's ancestors and itself, top first; empty at the top. */
  path: readonly { id: string; name: string }[];
  rootLabel: string;
  rootIcon: ReactNode;
  /** The breadcrumb's own name, for screen readers. */
  label: string;
  onOpen: (folderId: string | null) => void;
  /** Set while items are dragged, so the folders above take a drop. */
  drop?: {
    targetId: string | null | undefined;
    onOver: (folderId: string | null) => void;
    onDrop: (folderId: string | null) => void;
  };
}

function dropProps(
  folderId: string | null,
  drop: ExplorerBreadcrumbProps["drop"]
) {
  if (!drop) return {};
  return {
    onDragOver: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      drop.onOver(folderId);
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      drop.onDrop(folderId);
    },
  };
}

export default function ExplorerBreadcrumb({
  path,
  rootLabel,
  rootIcon,
  label,
  onOpen,
  drop,
}: Readonly<ExplorerBreadcrumbProps>) {
  const crumbs = [{ id: null, name: rootLabel }, ...path];
  return (
    <FlowbiteBreadcrumb aria-label={label}>
      {crumbs.map((crumb, index) => {
        const isCurrent = index === crumbs.length - 1;
        const isDropTarget =
          drop !== undefined && !isCurrent && drop.targetId === crumb.id;
        return (
          <BreadcrumbItem
            key={crumb.id ?? "root"}
            icon={index === 0 ? () => rootIcon : undefined}
          >
            {isCurrent ? (
              <span
                aria-current="page"
                className="max-w-64 truncate text-gray-900 dark:text-white"
              >
                {crumb.name}
              </span>
            ) : (
              <button
                type="button"
                title={crumb.name}
                onClick={() => onOpen(crumb.id)}
                {...dropProps(crumb.id, drop)}
                className={twMerge(
                  "max-w-48 cursor-pointer truncate rounded underline-offset-2 hover:text-gray-900 hover:underline dark:hover:text-white",
                  isDropTarget &&
                    "bg-primary-50 px-1 ring-1 ring-primary-400 dark:bg-primary-900/40"
                )}
              >
                {crumb.name}
              </button>
            )}
          </BreadcrumbItem>
        );
      })}
    </FlowbiteBreadcrumb>
  );
}
