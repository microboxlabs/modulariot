"use client";

import { Button, Checkbox } from "flowbite-react";
import { useGetNodeThumbnail } from "@/features/common/providers/client-api.provider";
import { useEffect, useState } from "react";
import { IoImagesOutline } from "react-icons/io5";
import { FaRegFilePdf } from "react-icons/fa";
import { HiPencilSquare } from "react-icons/hi2";
import { getCategories } from "../clasification-form";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import { AlfrescoFileEntry } from "../image.types";
import CustomBadge from "@/features/common/components/custom-badge/custom-badge";

export type ReviewStatus = "pending" | "approved" | "rejected";

const STATUS_CONFIG: Record<ReviewStatus, { dotCls: string; textCls: string }> = {
  pending:  { dotCls: "bg-amber-500", textCls: "text-amber-600 dark:text-amber-400" },
  approved: { dotCls: "bg-green-500", textCls: "text-green-600 dark:text-green-400" },
  rejected: { dotCls: "bg-red-500",   textCls: "text-red-600 dark:text-red-400" },
};

export default function MediaRow({
  file,
  index,
  type,
  onSelect,
  isSelected = false,
  onToggleSelect,
  status = "pending",
  statusSetAt,
  statusSetBy,
  hideStatusDot = false,
  isReviewable = true,
  onEdit,
  dictionary,
}: Readonly<{
  file: AlfrescoFileEntry;
  index: number;
  type: "image" | "document";
  onSelect: (index: number) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  status?: ReviewStatus;
  statusSetAt?: Date;
  statusSetBy?: string;
  hideStatusDot?: boolean;
  isReviewable?: boolean;
  onEdit?: () => void;
  dictionary: I18nRecord;
}>) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const { data } = useGetNodeThumbnail(file.entry.id);

  useEffect(() => {
    if (!data) return;
    const url = URL.createObjectURL(data);
    setThumbnailUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [data]);

  const categories = getCategories(dictionary);
  const tag = file.entry.properties?.["mintral:contentType"];
  const categoryLabel = categories[tag as keyof typeof categories]?.label;
  const FallbackIcon = type === "image" ? IoImagesOutline : FaRegFilePdf;

  const version = file.entry.properties?.["cm:versionLabel"];
  const lastEditor = file.entry.modifiedByUser?.displayName;
  const modifiedAt = file.entry.modifiedAt ? formatDateString(file.entry.modifiedAt) : null;
  const secondaryParts = [
    version ? `v${version}` : null,
    lastEditor ? `${tr("bento.multimedia.row_by", dictionary)} ${lastEditor}` : null,
    modifiedAt ? `${tr("bento.multimedia.row_updated", dictionary)}: ${modifiedAt}` : null,
  ].filter(Boolean);

  const statusCfg = STATUS_CONFIG[status];
  const statusLabel = tr(`bento.multimedia.status_${status}`, dictionary);
  const statusChangeLine =
    statusSetAt && status !== "pending"
      ? [statusLabel, `${tr("bento.multimedia.row_on", dictionary)} ${formatDateString(statusSetAt.toISOString())}`, statusSetBy ? `${tr("bento.multimedia.row_by_lower", dictionary)} ${statusSetBy}` : null].filter(Boolean).join(" ")
      : null;

  return (
    <div
      className={`group w-full flex items-start rounded-lg transition-colors`}
    >
      {/* Checkbox */}
      <div
        className="h-full flex items-center justify-center px-2"
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={isSelected}
          onChange={() => onToggleSelect?.(file.entry.id)}
          className="cursor-pointer"
        />
      </div>

      {/* Main content — opens viewer */}
      <Button
        color="alternative"
        onClick={() => onSelect(index)}
        className="flex-1 flex items-start gap-2 min-w-0 text-left cursor-pointer p-2 h-fit border-0! focus:ring-0! dark:hover:bg-gray-700/50! rounded-lg transition-colors"
      >
        {/* Thumbnail */}
        <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-200 dark:bg-gray-600 shrink-0 flex items-center justify-center self-center">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={file.entry.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <FallbackIcon className="w-5 h-5 text-gray-400" />
          )}
        </div>

        {/* Text content */}
        <div className="flex flex-col flex-1 min-w-0 gap-1">
          {/* Primary row: category · name · dot */}
          <div className="flex items-center gap-1.5 min-w-0">
            {categoryLabel && (
              <CustomBadge
                text={categoryLabel}
                className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 shrink-0 whitespace-nowrap"
              />
            )}
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate flex-1">
              {file.entry.name}
            </span>
            {!hideStatusDot && isReviewable && (
              <span
                title={statusLabel}
                className={`w-2 h-2 rounded-full shrink-0 ${statusCfg.dotCls}`}
              />
            )}
          </div>

          {/* Secondary row: version · editor · update date · category */}
          {secondaryParts.length > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
              {secondaryParts.join(" · ")}
            </span>
          )}

          {/* Status change row: only shown after a decision, for reviewable content */}
          {isReviewable && statusChangeLine && (
            <span className={`text-xs ${status === "approved" ? "text-gray-400 dark:text-gray-500" : "font-medium"} ${status === "approved" ? "" : statusCfg.textCls}`}>
              {statusChangeLine}
            </span>
          )}
        </div>
      </Button>

      {type === "image" && onEdit && (
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            title={tr("bento.multimedia.viewer_replace", dictionary)}
            onClick={onEdit}
            className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
          >
            <HiPencilSquare className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
