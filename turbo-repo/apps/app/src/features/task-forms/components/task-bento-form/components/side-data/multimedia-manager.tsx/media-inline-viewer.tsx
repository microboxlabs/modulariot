"use client";

import { useState, useEffect } from "react";
import {
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiXMark,
} from "react-icons/hi2";
import { FaCheck, FaTimes } from "react-icons/fa";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { getCategories } from "./clasification-form";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import { AlfrescoFileEntry } from "./image.types";

export type MediaViewerItem = {
  type: "image" | "document";
  file: AlfrescoFileEntry;
  refreshKey?: number;
};

type ItemStatus = "pending" | "accepted" | "denied";

export default function MediaInlineViewer({
  items,
  initialIndex = 0,
  onClose,
  showConfirmActions = false,
  dictionary,
}: {
  items: MediaViewerItem[];
  initialIndex?: number;
  onClose: () => void;
  showConfirmActions?: boolean;
  dictionary: I18nRecord;
}) {
  const [currentIndex, setCurrentIndex] = useState(
    Math.max(0, Math.min(initialIndex, items.length - 1))
  );
  const [statuses, setStatuses] = useState<Record<string, ItemStatus>>({});
  const [docBlobUrls, setDocBlobUrls] = useState<Record<string, string>>({});
  const [loadingDocs, setLoadingDocs] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCurrentIndex(Math.max(0, Math.min(initialIndex, items.length - 1)));
  }, [initialIndex, items.length]);

  const current = items[currentIndex];
  const id = current?.file?.entry?.id;

  // Fetch PDF blob when navigating to a document
  useEffect(() => {
    if (!current || current.type !== "document" || !id) return;
    if (docBlobUrls[id] || loadingDocs.has(id)) return;

    setLoadingDocs((prev) => new Set(prev).add(id));
    fetch(`/app/api/bento/content?nodeId=${id}`)
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        setDocBlobUrls((prev) => ({ ...prev, [id]: url }));
      })
      .catch(() => {})
      .finally(() => {
        setLoadingDocs((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      });
  }, [current, id, docBlobUrls, loadingDocs]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(docBlobUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) return null;

  const categories = getCategories(dictionary);
  const tag = current.file.entry.properties["mintral:contentType"];
  const categoryLabel = categories[tag as keyof typeof categories]?.label;
  const status: ItemStatus = id ? (statuses[id] ?? "pending") : "pending";

  const imageUrl =
    current.type === "image"
      ? `/app/api/bento/content?nodeId=${id}${current.refreshKey ? `&r=${current.refreshKey}` : ""}`
      : null;
  const docUrl = current.type === "document" && id ? docBlobUrls[id] : null;
  const isDocLoading =
    current.type === "document" && id ? loadingDocs.has(id) : false;

  return (
    <div className="flex flex-col w-full h-full bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
      {/* Header - fleet management nav style */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        {/* Left: close + file metadata */}
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors shrink-0"
            aria-label="Close viewer"
          >
            <HiXMark className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {current.file.entry.name}
          </span>
          {categoryLabel && (
            <span className="text-xs text-gray-500 dark:text-gray-400 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 flex-shrink-0 hidden sm:inline-block">
              {categoryLabel}
            </span>
          )}
          {current.file.entry.modifiedAt && (
            <span className="text-xs text-gray-500 dark:text-gray-400 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 flex-shrink-0 hidden md:inline-block">
              {formatDateString(current.file.entry.modifiedAt)}
            </span>
          )}
          {current.file.entry.modifiedByUser?.id && (
            <span className="text-xs text-gray-500 dark:text-gray-400 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 flex-shrink-0 hidden md:inline-block">
              {current.file.entry.modifiedByUser.id}
            </span>
          )}
          {showConfirmActions && (
            <span
              className={`text-xs rounded-full px-2 py-0.5 flex-shrink-0 font-medium ${
                status === "accepted"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : status === "denied"
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
              }`}
            >
              {status === "accepted"
                ? "Accepted"
                : status === "denied"
                  ? "Denied"
                  : "Pending"}
            </span>
          )}
        </div>

        {/* Right: counter + nav + accept/deny */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400 px-1 tabular-nums">
            {currentIndex + 1}/{items.length}
          </span>
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous"
          >
            <HiOutlineChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            type="button"
            disabled={currentIndex === items.length - 1}
            onClick={() =>
              setCurrentIndex((i) => Math.min(items.length - 1, i + 1))
            }
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Next"
          >
            <HiOutlineChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          {showConfirmActions && (
            <>
              <button
                type="button"
                onClick={() =>
                  id && setStatuses((p) => ({ ...p, [id]: "denied" }))
                }
                className="flex items-center gap-1.5 px-3 py-1.5 ml-1 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-medium"
              >
                <FaTimes className="w-3.5 h-3.5" />
                Deny
              </button>
              <button
                type="button"
                onClick={() =>
                  id && setStatuses((p) => ({ ...p, [id]: "accepted" }))
                }
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 transition-colors text-sm font-medium"
              >
                <FaCheck className="w-3.5 h-3.5" />
                Accept
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900 overflow-hidden">
        {current.type === "image" && imageUrl && (
          <img
            src={imageUrl}
            alt={current.file.entry.name}
            className="max-w-full max-h-full object-contain"
          />
        )}
        {current.type === "document" &&
          (isDocLoading ? (
            <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading document...</span>
            </div>
          ) : docUrl ? (
            <iframe
              src={docUrl}
              title={current.file.entry.name}
              className="w-full h-full border-0"
            />
          ) : (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Unable to load document
            </span>
          ))}
      </div>
    </div>
  );
}
