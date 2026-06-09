import { FaRegFilePdf } from "react-icons/fa";
import { useGetNodeThumbnail } from "@/features/common/providers/client-api.provider";
import React, { useEffect, useState } from "react";
import { getCategories } from "./multimedia-manager.tsx/clasification-form";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ShowNotification } from "@/features/notifications/notification";

export default function Document({
  document,
  setSelected,
  dictionary,
  modified = false,
  onDirectClick,
}: {
  document: any;
  setSelected: (selected: any) => void;
  dictionary: I18nRecord;
  modified?: boolean;
  onDirectClick?: () => void;
}) {
  const [thumbnail, setThumbnail] = useState<any>(null);
  const [thumbnailError, setThumbnailError] = useState<boolean>(false);
  const [thumbnailIsLoading, setThumbnailIsLoading] = useState<boolean>(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  const { data, error } = useGetNodeThumbnail(document.file.entry.id);

  useEffect(() => {
    if (data) {
      setThumbnail(data);
      setThumbnailIsLoading(false);
    } else {
      setThumbnailError(true);
      setThumbnailIsLoading(false);
    }
  }, [data, error]);

  // Convert blob to URL for display
  const thumbnailUrl = thumbnail ? URL.createObjectURL(thumbnail) : null;
  const categories = getCategories(dictionary);

  // Clean up object URL when component unmounts or thumbnail changes
  useEffect(() => {
    return () => {
      if (thumbnailUrl) {
        URL.revokeObjectURL(thumbnailUrl);
      }
    };
  }, [thumbnailUrl]);

  const handleViewDocument = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (isLoadingContent) return;
    if (onDirectClick) {
      onDirectClick();
      return;
    }
    setIsLoadingContent(true);
    const contentUrl = `/app/api/bento/content?nodeId=${document.file.entry.id}`;
    try {
      const res = await fetch(contentUrl);
      if (!res.ok) {
        ShowNotification({ type: "error", message: tr("bento.multimedia.document_load_error", dictionary) });
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      setSelected({
        url: blobUrl,
        tag:
          document?.file?.entry?.properties?.["mintral:contentType"] ??
          "Sin clasificar",
        name: document.file.entry.name,
      });
    } catch {
      ShowNotification({ type: "error", message: tr("bento.multimedia.document_load_error", dictionary) });
    } finally {
      setIsLoadingContent(false);
    }
  };

  return (
    <a
      href="#"
      onClick={handleViewDocument}
      className={`w-full rounded-lg flex flex-row items-center overflow-hidden border p-2 h-[4.5rem] transition-all duration-200 relative ${
        isLoadingContent
          ? "border-gray-400 dark:border-gray-500 opacity-60 pointer-events-none"
          : "border-gray-300 dark:border-gray-600 hover:border-gray-600 dark:hover:border-gray-300 cursor-pointer"
      }`}
    >
      {isLoadingContent && (
        <div className="absolute inset-0 flex items-center justify-end pr-3">
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <div
        className={`h-full aspect-square bg-gray-200 dark:bg-gray-600 ${thumbnailIsLoading && !thumbnailError ? "animate-pulse" : "animate-none"} rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0`}
      >
        {thumbnailError && (
          <FaRegFilePdf className="w-5 h-5 object-cover text-gray-500 dark:text-gray-400" />
        )}
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt="Thumbnail"
            className="w-full h-full object-cover"
          />
        )}
      </div>
      <div className="flex flex-col h-full justify-center px-2 w-full gap-1">
        <p className="text-sm text-gray-800 dark:text-gray-200 truncate whitespace-nowrap h-fit">
          {document.file.entry.name}
        </p>
        {document?.file?.entry?.properties?.["mintral:contentType"] &&
          document.file.entry.properties?.["mintral:contentType"] !== null && (
            <div
              className={`text-xs z-10 rounded-full flex items-center justify-center px-2 py-1 w-fit whitespace-nowrap ${
                modified
                  ? "dark:bg-gray-700 dark:text-gray-400 bg-gray-200 text-gray-00"
                  : "bg-gray-200 text-gray-00 dark:text-gray-400 dark:bg-gray-800 "
              }`}
            >
              {
                categories[
                  document.file.entry.properties?.[
                    "mintral:contentType"
                  ] as keyof typeof categories
                ]?.label
              }
            </div>
          )}
      </div>
    </a>
  );
}
