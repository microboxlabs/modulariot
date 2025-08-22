import { FaRegFilePdf } from "react-icons/fa";
import { displayBase64Content } from "./multimedia-manager.tsx/file-images";
import { useGetNodeThumbnail } from "@/features/common/providers/client-api.provider";
import React, { useEffect, useState } from "react";
import { getCategories } from "./multimedia-manager.tsx/clasification-form";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export default function Document({
  document,
  setSelected,
  dictionary,
  modified = false,
}: {
  document: any;
  setSelected: (selected: any) => void;
  dictionary: I18nRecord;
  modified?: boolean;
}) {
  const [thumbnail, setThumbnail] = useState<any>(null);
  const [thumbnailError, setThumbnailError] = useState<boolean>(false);
  const [thumbnailIsLoading, setThumbnailIsLoading] = useState<boolean>(true);

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

  document.file.entry.properties["mintral:contentType"] = null;

  const handleViewDocument = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (document.data) {
      const pdfDataUrl = displayBase64Content(
        document.data,
        document.file.entry.content.mimeType
      );
      setSelected({
        url: pdfDataUrl,
        tag: document.file.entry.properties["mintral:contentType"],
        name: document.file.entry.name,
      });
    }
  };

  return (
    <a
      href="#"
      onClick={handleViewDocument}
      className="w-full rounded-lg flex flex-row items-center overflow-hidden border border-gray-300 dark:border-gray-600 p-2 h-[4.5rem] hover:border-gray-600 dark:hover:border-gray-300 cursor-pointer transition-all duration-200"
    >
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
        {document?.file?.entry?.properties?.["mintral:contentType"] && (
          <div
            className={`text-xs z-10 rounded-full flex items-center justify-center px-2 py-1 w-fit whitespace-nowrap ${
              modified
                ? "dark:bg-gray-700 dark:text-gray-400 bg-gray-200 text-gray-00"
                : "bg-gray-200 text-gray-00 dark:text-gray-400 dark:bg-gray-800 "
            }`}
          >
            {
              categories[
                document.file.entry.properties[
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
