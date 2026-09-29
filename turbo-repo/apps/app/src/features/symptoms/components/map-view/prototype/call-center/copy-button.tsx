"use client";

/**
 * Small icon button reused by every treatment/call-log row (generic
 * treatments and each individual call entry) to copy that row's own
 * action/date/message breakdown to the clipboard — `getText` builds the
 * exact string per caller since each row's fields differ.
 */

import { useState } from "react";
import { HiCheck, HiClipboardDocument } from "react-icons/hi2";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ShowNotification } from "@/features/notifications/notification";

export default function CopyButton({
  dict,
  getText,
}: {
  dict: I18nRecord;
  getText: () => string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(getText()).then(() => {
      setCopied(true);
      ShowNotification({
        type: "success",
        message: tr("common.copiedToClipboard", dict),
      });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={tr("common.copy", dict)}
      className="relative flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
    >
      <HiClipboardDocument
        className={`absolute h-3 w-3 transition-all duration-200 ${
          copied ? "scale-0 opacity-0" : "scale-100 opacity-100"
        }`}
      />
      <HiCheck
        className={`absolute h-3 w-3 text-green-500 transition-all duration-200 ${
          copied ? "scale-100 opacity-100" : "scale-0 opacity-0"
        }`}
      />
    </button>
  );
}
