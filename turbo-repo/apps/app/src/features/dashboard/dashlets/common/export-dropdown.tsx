"use client";

import { createPortal } from "react-dom";
import { HiArrowDownTray } from "react-icons/hi2";
import { RiFileChartLine } from "react-icons/ri";
import { usePortalDropdown } from "./use-portal-dropdown";

interface ExportDropdownProps {
  ariaLabel: string;
  csvLabel: string;
  onExportCsv: () => void;
}

export function ExportDropdown({
  ariaLabel,
  csvLabel,
  onExportCsv,
}: Readonly<ExportDropdownProps>) {
  const { open, pos, buttonRef, menuRef, close, toggle } =
    usePortalDropdown();

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className="no-drag shrink-0 cursor-pointer rounded p-1 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
      >
        <HiArrowDownTray className="h-4 w-4" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] min-w-[140px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
            style={{
              top: pos.top,
              left: pos.left,
              transform: "translateX(-100%)",
            }}
          >
            <button
              type="button"
              onClick={() => {
                onExportCsv();
                close();
              }}
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <RiFileChartLine className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
              <span>{csvLabel}</span>
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
