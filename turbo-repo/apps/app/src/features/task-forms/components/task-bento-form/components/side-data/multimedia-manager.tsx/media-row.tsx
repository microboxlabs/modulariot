"use client";

import { useGetNodeThumbnail } from "@/features/common/providers/client-api.provider";
import { useEffect, useState } from "react";
import { IoImagesOutline } from "react-icons/io5";
import { FaRegFilePdf } from "react-icons/fa";
import { getCategories } from "./clasification-form";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export default function MediaRow({
  file,
  index,
  type,
  onSelect,
  dictionary,
}: {
  file: any;
  index: number;
  type: "image" | "document";
  onSelect: (index: number) => void;
  dictionary: I18nRecord;
}) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const { data } = useGetNodeThumbnail(file.entry.id);

  useEffect(() => {
    if (!data) return;
    const url = URL.createObjectURL(data);
    setThumbnailUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [data]);

  const categories = getCategories(dictionary);
  const tag = file.entry.properties["mintral:contentType"];
  const categoryLabel = categories[tag as keyof typeof categories]?.label;
  const FallbackIcon = type === "image" ? IoImagesOutline : FaRegFilePdf;

  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-left cursor-pointer"
    >
      {/* Thumbnail */}
      <div className="w-9 h-9 rounded-md overflow-hidden bg-gray-200 dark:bg-gray-600 shrink-0 flex items-center justify-center">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={file.entry.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <FallbackIcon className="w-4 h-4 text-gray-400" />
        )}
      </div>

      {/* Name */}
      <span className="text-sm text-gray-800 dark:text-gray-200 truncate flex-1 min-w-0">
        {file.entry.name}
      </span>

      {/* Tag as button-style badge */}
      {categoryLabel && (
        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
          {categoryLabel}
        </span>
      )}
    </button>
  );
}
