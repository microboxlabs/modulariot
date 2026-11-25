"use client";

import { useCallback, useRef, useState } from "react";
import type { ComponentProps, FC } from "react";
import {
  HiChevronDown,
  HiPlus,
  HiOutlineFolder,
  HiOutlineViewGrid,
} from "react-icons/hi";
import { Button } from "flowbite-react";
import { twMerge } from "tailwind-merge";
import { useDismiss } from "./use-dismiss";

interface ExplorerNewMenuProps {
  newLabel: string;
  newFileLabel: string;
  newFolderLabel: string;
  onNewFile: () => void;
  onNewFolder: () => void;
  /** While a new item is being named, nothing new can be started. */
  createDisabled: boolean;
  /** Also off when the caller may not create dashboards here. */
  fileDisabled?: boolean;
}

interface NewMenuItem {
  icon: FC<ComponentProps<"svg">>;
  label: string;
  onSelect: () => void;
  disabled: boolean;
}

/** "New ▾": a small menu with what can be created. */
function NewMenu({
  label,
  items,
  disabled,
}: Readonly<{ label: string; items: NewMenuItem[]; disabled: boolean }>) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useDismiss(root, open, close);

  return (
    <div ref={root} className="relative">
      {/* The settings pages' main action: same colour and size. */}
      <Button
        color="blue"
        size="sm"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="shrink-0 whitespace-nowrap"
      >
        <HiPlus className="mr-1 h-4 w-4" />
        {label}
        <HiChevronDown className="ml-1 h-4 w-4" />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          {items.map(({ icon: Icon, label: itemLabel, onSelect, disabled }) => (
            <button
              key={itemLabel}
              type="button"
              role="menuitem"
              disabled={disabled}
              onClick={() => {
                setOpen(false);
                onSelect();
              }}
              className={twMerge(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700",
                "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
              )}
            >
              <Icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              {itemLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The page's "New" menu: a dashboard or a folder. */
export default function ExplorerNewMenu({
  newLabel,
  newFileLabel,
  newFolderLabel,
  onNewFile,
  onNewFolder,
  createDisabled,
  fileDisabled = false,
}: Readonly<ExplorerNewMenuProps>) {
  return (
    <NewMenu
      label={newLabel}
      disabled={createDisabled}
      items={[
        {
          icon: HiOutlineViewGrid,
          label: newFileLabel,
          onSelect: onNewFile,
          disabled: fileDisabled,
        },
        {
          icon: HiOutlineFolder,
          label: newFolderLabel,
          onSelect: onNewFolder,
          disabled: false,
        },
      ]}
    />
  );
}
