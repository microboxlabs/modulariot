import { tr } from "@/features/i18n/tr.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

type MediaContentDisplayProps = Readonly<{
  type: "image" | "document";
  fileName: string;
  imageUrl: string | null;
  docUrl: string | null;
  isDocLoading: boolean;
  dictionary: I18nRecord;
}>;

export default function MediaContentDisplay({
  type,
  fileName,
  imageUrl,
  docUrl,
  isDocLoading,
  dictionary,
}: MediaContentDisplayProps) {
  if (type === "image" && imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={fileName}
        className="max-w-full max-h-full object-contain"
      />
    );
  }

  if (type === "document" && isDocLoading) {
    return (
      <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">{tr("bento.multimedia.viewer_loading_doc", dictionary)}</span>
      </div>
    );
  }

  if (type === "document" && !isDocLoading && docUrl) {
    return (
      <iframe
        src={docUrl}
        title={fileName}
        className="w-full h-full border-0"
      />
    );
  }

  if (type === "document" && !isDocLoading && !docUrl) {
    return (
      <span className="text-sm text-gray-500 dark:text-gray-400">
        {tr("bento.multimedia.viewer_load_error", dictionary)}
      </span>
    );
  }

  return null;
}
