"use client";
import { useId, useState } from "react";
import { createPortal } from "react-dom";
import type { ActionItem } from "../core/action-types";
import { isSafeActionUrl } from "../core/action-helpers";
import { usePortalDropdown } from "./use-portal-dropdown";

export interface ResolvedAction {
  readonly action: ActionItem;
  readonly href: string;
}
export interface ActionDropdownProps {
  readonly items: readonly ResolvedAction[];
  readonly ariaLabel: string;
  readonly theme?: "light" | "dark";
}
/** Resolved navigation links; no template evaluation or host routing dependency. */
export function ActionDropdown({
  items,
  ariaLabel,
  theme,
}: ActionDropdownProps) {
  const safeItems = items.filter(
    ({ href, action }) =>
      isSafeActionUrl(href) &&
      (action.target === "_self" || action.target === "_blank"),
  );
  const { open, pos, buttonRef, menuRef, close, toggle } = usePortalDropdown(
    safeItems.length > 0,
  );
  const id = useId();
  const [inheritedTheme, setInheritedTheme] = useState<"light" | "dark">(
    "light",
  );

  if (safeItems.length === 0) return null;
  return (
    <>
      <button
        type="button"
        ref={buttonRef}
        className="miot-action-dropdown__trigger"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(event) => {
          event.stopPropagation();
          const ancestor = buttonRef.current?.closest<HTMLElement>(
            "[data-miot-theme], .dark",
          );
          const ancestorTheme = ancestor ? "dark" : "light";
          setInheritedTheme(
            ancestor?.dataset.miotTheme === "light" ? "light" : ancestorTheme,
          );
          toggle();
        }}
      >
        <span aria-hidden="true">⋮</span>
      </button>
      {open &&
        buttonRef.current &&
        createPortal(
          <dialog
            open
            ref={menuRef}
            id={id}
            aria-label={ariaLabel}
            className="miot-action-dropdown"
            data-miot-theme={theme ?? inheritedTheme}
            style={{ top: pos.top, left: pos.left }}
          >
            {safeItems.map(({ action, href }, index) => (
              <a
                key={`${index}-${action.name}`}
                href={href}
                target={action.target}
                rel={
                  action.target === "_blank" ? "noopener noreferrer" : undefined
                }
                onClick={(event) => {
                  event.stopPropagation();
                  close();
                }}
              >
                {action.name}
                <span aria-hidden="true">
                  {action.target === "_blank" ? "↗" : "→"}
                </span>
              </a>
            ))}
          </dialog>,
          buttonRef.current.ownerDocument.body,
        )}
    </>
  );
}
