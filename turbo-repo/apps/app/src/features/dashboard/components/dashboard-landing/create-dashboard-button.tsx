"use client";

import { useState } from "react";
import { HiPlus } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { CreateDashboardModal } from "./create-dashboard-modal";

interface CreateDashboardButtonProps {
  dict: I18nRecord;
  ctaLabel: string;
  siteName: string | null;
}

export function CreateDashboardButton({
  dict,
  ctaLabel,
  siteName,
}: Readonly<CreateDashboardButtonProps>) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-800"
      >
        <HiPlus className="mr-2 h-4 w-4" />
        {ctaLabel}
      </button>
      <CreateDashboardModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        dict={dict}
        siteName={siteName}
      />
    </>
  );
}
