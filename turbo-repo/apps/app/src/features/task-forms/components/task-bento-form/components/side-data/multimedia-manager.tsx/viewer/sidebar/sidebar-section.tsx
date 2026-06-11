"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { HiChevronDown, HiQuestionMarkCircle } from "react-icons/hi2";
import Markdown from "react-markdown";

// ============================================================================
// Markdown tooltip (portal-based)
// ============================================================================

function DescriptionTooltip({ description }: Readonly<{ description: string }>) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const [visible, setVisible] = useState(false);
  const coordsRef = useRef({ top: 0, left: 0 });

  function show() {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    coordsRef.current = { top: rect.bottom + 4, left: rect.left + rect.width / 2 };
    setVisible(true);
  }

  function hide() {
    hideTimer.current = setTimeout(() => setVisible(false), 150);
  }

  useEffect(() => {
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []);

  const clampToViewport = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const { top, left } = coordsRef.current;
    const pad = 8;
    const rect = el.getBoundingClientRect();
    const halfW = rect.width / 2;

    let clampedLeft = left;
    if (left - halfW < pad) clampedLeft = halfW + pad;
    else if (left + halfW > window.innerWidth - pad) clampedLeft = window.innerWidth - pad - halfW;

    let clampedTop = top;
    if (top + rect.height > window.innerHeight - pad) {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      if (triggerRect) clampedTop = triggerRect.top - rect.height - 4;
    }

    el.style.top = `${clampedTop}px`;
    el.style.left = `${clampedLeft}px`;
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="More information"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onKeyDown={(e) => { if (e.key === "Escape") hide(); }}
        className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <HiQuestionMarkCircle className="w-3.5 h-3.5" />
      </button>
      {visible && createPortal(
        <div
          ref={clampToViewport}
          role="tooltip"
          className="fixed z-9999 w-max max-w-sm"
          style={{ transform: "translateX(-50%)" }}
          onMouseEnter={show}
          onMouseLeave={hide}
        >
          <div className="overflow-hidden rounded-md border border-gray-300 bg-gray-900 shadow-lg dark:border-gray-500 dark:bg-gray-800">
            <div
              className={[
                "max-h-64 overscroll-none overflow-x-hidden overflow-y-auto",
                "px-3 py-2 text-left text-xs text-white",
                "[&_h1]:mb-2 [&_h1]:border-b [&_h1]:border-gray-500 [&_h1]:pb-1 [&_h1]:text-lg [&_h1]:font-bold",
                "[&_h2]:mb-1.5 [&_h2]:text-base [&_h2]:font-bold",
                "[&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold",
                "[&_p]:mb-2 [&_p]:last:mb-0",
                "[&_strong]:font-bold [&_em]:italic",
                "[&_code]:rounded [&_code]:bg-gray-700 [&_code]:px-1 [&_code]:text-xs",
                "[&_ul]:mb-1 [&_ul]:list-disc [&_ul]:pl-4",
                "[&_ol]:mb-1 [&_ol]:list-decimal [&_ol]:pl-4",
                "[&_li]:mb-0.5",
              ].join(" ")}
              style={{ overflowWrap: "break-word", wordBreak: "break-word" }}
            >
              <Markdown>{description}</Markdown>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ============================================================================
// SidebarSection
// ============================================================================

export function SidebarSection({
  title,
  defaultExpanded = false,
  description,
  children,
}: Readonly<{
  title: string;
  defaultExpanded?: boolean;
  description?: string;
  children: ReactNode;
}>) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  return (
    <div className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
      <button
        type="button"
        onClick={() => setIsExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {title}
          </span>
          {description && <DescriptionTooltip description={description} />}
        </span>
        <HiChevronDown
          className={`w-3.5 h-3.5 text-gray-400 dark:text-gray-500 transition-transform duration-200 shrink-0 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isExpanded ? "max-h-[2499.75px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-4 py-2 pb-4">{children}</div>
      </div>
    </div>
  );
}
