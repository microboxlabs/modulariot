import Link from "next/link";
import { FaRegFilePdf } from "react-icons/fa";
import { displayBase64Content } from "./multimedia-manager.tsx/file-images";
import {
  useGetNodeContent,
  useGetNodeThumbnail,
} from "@/features/common/providers/client-api.provider";
import { useEffect } from "react";
import { MdHideImage } from "react-icons/md";
import { AlfrescoFileEntry } from "./multimedia-manager.tsx/image.types";

export default function Document({
  file,
  setSelected,
}: {
  file: AlfrescoFileEntry;
  setSelected: (selected: any) => void;
}) {
  const {
    data: documentData,
    error: _documentError,
    isLoading: _documentIsLoading,
  } = useGetNodeContent(file.entry.id);

  const {
    data: thumbnail,
    error: thumbnailError,
    isLoading: thumbnailIsLoading,
  } = useGetNodeThumbnail(file.entry.id);

  // Convert blob to URL for display
  const thumbnailUrl = thumbnail ? URL.createObjectURL(thumbnail) : null;

  // Clean up object URL when component unmounts or thumbnail changes
  useEffect(() => {
    return () => {
      if (thumbnailUrl) {
        URL.revokeObjectURL(thumbnailUrl);
      }
    };
  }, [thumbnailUrl]);

  const handleViewDocument = () => {
    if (documentData?.data) {
      const pdfDataUrl = displayBase64Content(
        documentData.data,
        file.entry.content.mimeType,
      );
      setSelected(pdfDataUrl);
    }
  };

  return (
    <div className="w-full rounded-lg flex flex-row items-center overflow-hidden border border-gray-300 p-2 h-[4.5rem]">
      <div
        className={`h-full aspect-square bg-gray-200 dark:bg-gray-600 ${thumbnailIsLoading && !thumbnailError ? "animate-pulse" : "animate-none"} rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0`}
      >
        {thumbnailError && (
          <MdHideImage className="w-5 h-5 object-cover text-red-500" />
        )}
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt="Thumbnail"
            className="w-full h-full object-cover"
          />
        )}
      </div>
      <div className="flex flex-col h-full justify-center p-2 w-full">
        <p className="text-sm text-gray-800 dark:text-gray-200 truncate whitespace-nowrap">
          {file.entry.name}
        </p>
        <Link
          href="#"
          onClick={handleViewDocument}
          className="flex flex-row gap-1 items-center text-blue-500 hover:underline"
        >
          <FaRegFilePdf className="w-4 h-4" />
          <p className="text-xs whitespace-nowrap">Ver documento</p>
        </Link>
      </div>
    </div>
  );
}
