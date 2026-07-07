"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Markdown from "react-markdown";

// Portal-based so it escapes any ancestor's overflow-hidden (e.g. rounded
// cards, expand/collapse wrappers) — a plain flowbite Tooltip gets clipped
// by those since it positions inline in the DOM instead of via a portal.
export default function MarkdownTooltip({
  content,
  children,
}: {
  content: string;
  children: ReactNode;
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(false);
  const coordsRef = useRef({ top: 0, left: 0 });

  function show() {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    coordsRef.current = {
      top: rect.bottom + 6,
      left: rect.left + rect.width / 2,
    };
    setVisible(true);
  }

  function hide() {
    hideTimer.current = setTimeout(() => setVisible(false), 150);
  }

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const clampToViewport = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const { top, left } = coordsRef.current;
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;

    const rect = el.getBoundingClientRect();
    const pad = 8;
    const halfW = rect.width / 2;

    let clampedLeft = left;
    if (left - halfW < pad) {
      clampedLeft = halfW + pad;
    } else if (left + halfW > window.innerWidth - pad) {
      clampedLeft = window.innerWidth - pad - halfW;
    }

    let clampedTop = top;
    if (top + rect.height > window.innerHeight - pad) {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      if (triggerRect) {
        clampedTop = triggerRect.top - rect.height - 6;
      }
    }

    el.style.top = `${clampedTop}px`;
    el.style.left = `${clampedLeft}px`;
  }, []);

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex"
        tabIndex={0}
        role="button"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {visible &&
        createPortal(
          <div
            ref={clampToViewport}
            role="tooltip"
            className="fixed z-9999 w-max max-w-xs"
            style={{ transform: "translateX(-50%)" }}
            onMouseEnter={show}
            onMouseLeave={hide}
          >
            <div
              className={[
                "rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800",
                "max-h-100 overscroll-none overflow-x-hidden overflow-y-auto",
                "px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200",
                "[&_h1]:mb-2 [&_h1]:border-b [&_h1]:border-gray-300 dark:[&_h1]:border-gray-500 [&_h1]:pb-1 [&_h1]:text-lg [&_h1]:font-bold",
                "[&_h2]:mb-1.5 [&_h2]:text-base [&_h2]:font-bold",
                "[&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold",
                "[&_p]:mb-2 [&_p]:last:mb-0",
                "[&_br]:block [&_br]:content-[''] [&_br]:mb-1",
                "[&_strong]:font-bold [&_em]:italic",
                "[&_code]:rounded [&_code]:bg-gray-100 dark:[&_code]:bg-gray-700 [&_code]:px-1 [&_code]:text-xs",
                "[&_a]:underline [&_a]:text-blue-600 dark:[&_a]:text-blue-300",
                "[&_ul]:mb-1 [&_ul]:list-disc [&_ul]:pl-4",
                "[&_ol]:mb-1 [&_ol]:list-decimal [&_ol]:pl-4",
                "[&_li]:mb-0.5",
                "[&_hr]:my-2 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-gray-300 dark:[&_hr]:border-gray-500",
                "[&_blockquote]:mb-1 [&_blockquote]:border-l-2 [&_blockquote]:border-gray-300 dark:[&_blockquote]:border-gray-500 [&_blockquote]:pl-2 [&_blockquote]:italic [&_blockquote]:text-gray-500 dark:[&_blockquote]:text-gray-300",
                "[&_pre]:mb-1 [&_pre]:rounded [&_pre]:bg-gray-100 dark:[&_pre]:bg-gray-700 [&_pre]:p-2 [&_pre]:text-xs",
                "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
              ].join(" ")}
              style={{ overflowWrap: "break-word", wordBreak: "break-word" }}
            >
              <Markdown>{content}</Markdown>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
