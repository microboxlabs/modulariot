"use client";
import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ColumnFilterInput,
  type ColumnFilterInputProps,
} from "./column-filter-input";

export interface ColumnFilterPopoverProps extends Omit<
  ColumnFilterInputProps,
  "cancelDebounceRef"
> {
  readonly title: string;
  readonly clearLabel: string;
  readonly theme?: "light" | "dark";
  readonly portalContainer?: HTMLElement;
}

/** Nonmodal, anchored filter editor with host-owned filter state. */
export function ColumnFilterPopover({
  title,
  clearLabel,
  theme,
  portalContainer,
  ...input
}: ColumnFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [inheritedTheme, setInheritedTheme] = useState<"light" | "dark">(
    "light",
  );
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<(() => void) | undefined>(undefined);
  const id = useId();
  const close = useCallback((restoreFocus: boolean) => {
    cancel.current?.();
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!open || !trigger.current || !dialog.current) return;
    const button = trigger.current;
    const panel = dialog.current;
    const doc = button.ownerDocument;
    const win = doc.defaultView;
    if (!win) return;
    const ancestor = button.closest<HTMLElement>("[data-miot-theme], .dark");
    const dark = ancestor && ancestor.dataset.miotTheme !== "light";
    setInheritedTheme(dark ? "dark" : "light");
    const positionPanel = () => {
      const rect = button.getBoundingClientRect();
      const { width, height } = panel.getBoundingClientRect();
      const below = rect.bottom + 4;
      const top =
        below + height > win.innerHeight - 8 ? rect.top - height - 4 : below;
      setPosition({
        top: Math.max(8, top),
        left: Math.max(8, Math.min(rect.left, win.innerWidth - width - 8)),
      });
    };
    const outside = (event: Event) => {
      const path = event.composedPath();
      if (!path.includes(panel) && !path.includes(button)) close(false);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    };
    positionPanel();
    panel.querySelector<HTMLElement>("input, select, button")?.focus();
    doc.addEventListener("pointerdown", outside);
    doc.addEventListener("focusin", outside);
    doc.addEventListener("keydown", keydown);
    win.addEventListener("scroll", positionPanel, true);
    win.addEventListener("resize", positionPanel);
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(positionPanel);
    observer?.observe(panel);
    return () => {
      cancel.current?.();
      observer?.disconnect();
      doc.removeEventListener("pointerdown", outside);
      doc.removeEventListener("focusin", outside);
      doc.removeEventListener("keydown", keydown);
      win.removeEventListener("scroll", positionPanel, true);
      win.removeEventListener("resize", positionPanel);
    };
  }, [open, close, input.columnKey, portalContainer]);

  const target = portalContainer ?? trigger.current?.ownerDocument.body;
  return (
    <>
      <button
        type="button"
        ref={trigger}
        className="miot-column-filter-popover__trigger"
        aria-label={title}
        title={title}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        data-active={Boolean(input.currentFilter)}
        onClick={(event) => {
          event.stopPropagation();
          if (open) close(false);
          else setOpen(true);
        }}
      >
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M2 3h16l-6 7v6l-4 2v-8z" />
        </svg>
      </button>
      {open &&
        target &&
        createPortal(
          <dialog
            open
            ref={dialog}
            id={id}
            aria-label={title}
            className="miot-column-filter-popover"
            data-miot-theme={theme ?? inheritedTheme}
            style={position}
          >
            <p>{title}</p>
            <ColumnFilterInput
              key={input.columnKey}
              {...input}
              cancelDebounceRef={cancel}
            />
            {input.currentFilter && (
              <button
                type="button"
                className="miot-column-filter-popover__clear"
                onClick={() => {
                  cancel.current?.();
                  input.onFilterChange(input.columnKey, null);
                  close(true);
                }}
              >
                {clearLabel}
              </button>
            )}
          </dialog>,
          target,
        )}
    </>
  );
}
