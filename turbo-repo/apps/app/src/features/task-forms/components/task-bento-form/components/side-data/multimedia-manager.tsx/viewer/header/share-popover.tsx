"use client";

import { useState, useRef, useCallback } from "react";
import { Tooltip } from "flowbite-react";
import {
  HiShare,
  HiLink,
  HiEnvelope,
  HiArrowTopRightOnSquare,
} from "react-icons/hi2";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { toast } from "sonner";
import { useClickOutside } from "@/features/common/hooks/use-click-outside";

export function SharePopover({
  fileUrl,
  fileName,
  dictionary,
}: Readonly<{
  fileUrl: string;
  fileName: string;
  dictionary: I18nRecord;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setIsOpen(false), []);

  useClickOutside(ref, isOpen, close);

  const fullUrl = `${globalThis.location.origin}${fileUrl}`;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(fullUrl);
    toast.success(tr("bento.multimedia.viewer_link_copied", dictionary));
    setIsOpen(false);
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(fileName);
    const body = encodeURIComponent(`${fileName}\n\n${fullUrl}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
    setIsOpen(false);
  };

  const handleOpenTab = () => {
    window.open(fileUrl, "_blank");
    setIsOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <Tooltip content={tr("bento.multimedia.viewer_share", dictionary)} placement="bottom">
        <button
          type="button"
          onClick={() => setIsOpen((p) => !p)}
          className="p-1.5 xl:p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
        >
          <HiShare className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
      </Tooltip>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full flex items-center whitespace-nowrap gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
          >
            <HiLink className="w-3.5 h-3.5 shrink-0 text-gray-400" />
            {tr("bento.multimedia.viewer_copy_link", dictionary)}
          </button>
          <button
            type="button"
            onClick={handleEmail}
            className="w-full flex items-center whitespace-nowrap gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
          >
            <HiEnvelope className="w-3.5 h-3.5 shrink-0 text-gray-400" />
            {tr("bento.multimedia.viewer_share_email", dictionary)}
          </button>
          <button
            type="button"
            onClick={handleOpenTab}
            className="w-full flex items-center whitespace-nowrap gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
          >
            <HiArrowTopRightOnSquare className="w-3.5 h-3.5 shrink-0 text-gray-400" />
            {tr("bento.multimedia.viewer_open_new_tab", dictionary)}
          </button>
        </div>
      )}
    </div>
  );
}
