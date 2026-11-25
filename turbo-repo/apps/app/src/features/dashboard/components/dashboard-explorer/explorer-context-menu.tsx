"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type FC,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { twMerge } from "tailwind-merge";

export interface ExplorerMenuItem {
  key: string;
  label: string;
  icon: FC<ComponentProps<"svg">>;
  onSelect: () => void;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  /** Draws a divider above this item. */
  separated?: boolean;
}

interface ExplorerContextMenuProps {
  x: number;
  y: number;
  label: string;
  items: ExplorerMenuItem[];
  onClose: () => void;
}

const VIEWPORT_MARGIN_PX = 4;

/** Keeps the menu inside the viewport, flipping it up/left near an edge. */
function clampToViewport(
  x: number,
  y: number,
  menu: HTMLElement
): { left: number; top: number } {
  const { width, height } = menu.getBoundingClientRect();
  const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN_PX;
  const maxTop = window.innerHeight - height - VIEWPORT_MARGIN_PX;
  return {
    left: Math.max(VIEWPORT_MARGIN_PX, x > maxLeft ? x - width : x),
    top: Math.max(VIEWPORT_MARGIN_PX, y > maxTop ? y - height : y),
  };
}

function enabledButtons(menu: HTMLElement | null): HTMLButtonElement[] {
  return Array.from(
    menu?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []
  );
}

/** Moves focus up or down the menu, wrapping at the ends. */
function moveFocus(menu: HTMLElement | null, step: 1 | -1): void {
  const buttons = enabledButtons(menu);
  if (buttons.length === 0) return;
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next = (index + step + buttons.length) % buttons.length;
  buttons[next]?.focus();
}

function MenuButton({
  item,
  onClose,
}: Readonly<{ item: ExplorerMenuItem; onClose: () => void }>) {
  const Icon = item.icon;
  const select = () => {
    onClose();
    item.onSelect();
  };
  return (
    <>
      {item.separated && (
        <hr className="my-1 border-gray-200 dark:border-gray-600" />
      )}
      <button
        type="button"
        role="menuitem"
        disabled={item.disabled}
        onClick={select}
        className={twMerge(
          "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm",
          "text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none",
          "dark:text-gray-200 dark:hover:bg-gray-600 dark:focus:bg-gray-600",
          "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
          item.danger && "text-red-600 dark:text-red-400"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1">{item.label}</span>
        {item.shortcut && (
          <span aria-hidden className="text-xs text-gray-400">
            {item.shortcut}
          </span>
        )}
      </button>
    </>
  );
}

/**
 * The right-click menu at the pointer. Portaled to the body so the
 * panel's overflow does not clip it; mousedown inside is stopped so the
 * page's click-outside deselection does not run.
 */
export default function ExplorerContextMenu({
  x,
  y,
  label,
  items,
  onClose,
}: Readonly<ExplorerContextMenuProps>) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    if (menuRef.current) setPosition(clampToViewport(x, y, menuRef.current));
    enabledButtons(menuRef.current)[0]?.focus();
  }, [x, y]);

  useEffect(() => {
    const closeOutside = (event: globalThis.MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("mousedown", closeOutside);
    window.addEventListener("resize", onClose);
    window.addEventListener("blur", onClose);
    document.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("blur", onClose);
      document.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(menuRef.current, event.key === "ArrowDown" ? 1 : -1);
    }
  };

  const stop = (event: MouseEvent) => event.stopPropagation();

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onMouseDown={stop}
      onContextMenu={(event) => event.preventDefault()}
      style={position}
      className={twMerge(
        "fixed z-50 min-w-44 border border-gray-200 bg-white py-1 shadow-lg",
        "dark:border-gray-600 dark:bg-gray-700"
      )}
    >
      {items.map((item) => (
        <MenuButton key={item.key} item={item} onClose={onClose} />
      ))}
    </div>,
    document.body
  );
}
