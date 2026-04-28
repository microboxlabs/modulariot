"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "flowbite-react";
import { FaShare } from "react-icons/fa";
import { useDashboard } from "../../context/dashboard-context";
import { tr } from "@/features/i18n/tr.service";
import { ShareForm } from "../dashboard-settings-dropdown/share-form";

export default function DashboardShareDropdown() {
  const { dashboardName, dictionary } = useDashboard();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const closePanel = useCallback(() => setOpen(false), []);
  const togglePanel = () => setOpen((prev) => !prev);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        closePanel();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, closePanel]);

  return (
    <div ref={dropdownRef} className="relative">
      <Button
        color="alternative"
        size="sm"
        onClick={togglePanel}
        title={tr("dashboard.settings.shareDashboardTitle", dictionary)}
      >
        <FaShare />
      </Button>

      {open && (
        <div className="absolute z-50 right-0 top-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-[320px] w-[360px]">
          <ShareForm dashboardName={dashboardName} onClose={closePanel} />
        </div>
      )}
    </div>
  );
}
