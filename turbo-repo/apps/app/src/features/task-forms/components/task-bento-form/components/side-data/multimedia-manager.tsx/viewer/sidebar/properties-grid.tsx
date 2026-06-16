import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import { formatBytes } from "../viewer-utils";
import { MetaRow } from "./meta-row";
import { AlfrescoFileEntry } from "../../image.types";
import EditableField from "@/features/common/components/editable-field/editable-field";

type PropertiesGridProps = Readonly<{
  entry: AlfrescoFileEntry["entry"];
  categoryLabel: string | undefined;
  onRename?: (newName: string) => Promise<void>;
  dictionary: I18nRecord;
}>;

export function PropertiesGrid({ entry, categoryLabel, onRename, dictionary }: PropertiesGridProps) {
  const reviewStatus = entry.properties?.["mintral:reviewStatus"];
  let reviewStatusLabel: string | null = null;
  if (reviewStatus && reviewStatus !== "PENDING") {
    reviewStatusLabel =
      reviewStatus === "APPROVED"
        ? tr("bento.multimedia.sidebar_prop_review_approved", dictionary)
        : tr("bento.multimedia.sidebar_prop_review_rejected", dictionary);
  }

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      <MetaRow
        label={tr("bento.multimedia.sidebar_prop_name", dictionary)}
        value={
          onRename ? (
            <EditableField
              taskId=""
              fieldName="name"
              value={entry.name}
              type="text"
              variant="inline"
              onSave={onRename}
              inputClassName="text-xs bg-transparent border-b border-blue-500 dark:border-blue-400 outline-none w-full"
              displayClassName="text-xs text-gray-900 dark:text-white cursor-text hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left"
            />
          ) : entry.name
        }
      />
      {categoryLabel && <MetaRow label={tr("bento.multimedia.sidebar_prop_type", dictionary)} value={categoryLabel} />}
      {entry.properties?.["cm:versionLabel"] && (
        <MetaRow label={tr("bento.multimedia.sidebar_prop_version", dictionary)} value={`v${entry.properties?.["cm:versionLabel"]}`} />
      )}
      {entry.content && (
        <MetaRow label={tr("bento.multimedia.sidebar_prop_format", dictionary)} value={entry.content.mimeTypeName ?? entry.content.mimeType} />
      )}
      {entry.content && (
        <MetaRow label={tr("bento.multimedia.sidebar_prop_size", dictionary)} value={formatBytes(entry.content.sizeInBytes)} />
      )}
      {entry.properties?.["exif:pixelXDimension"] != null && entry.properties?.["exif:pixelYDimension"] != null && (
        <MetaRow label="Resolution" value={`${entry.properties?.["exif:pixelXDimension"]} × ${entry.properties?.["exif:pixelYDimension"]}`} />
      )}
      {entry.modifiedAt && (
        <MetaRow label={tr("bento.multimedia.sidebar_prop_modified", dictionary)} value={formatDateString(entry.modifiedAt)} />
      )}
      {entry.modifiedByUser?.displayName && (
        <MetaRow label={tr("bento.multimedia.sidebar_prop_modified_by", dictionary)} value={entry.modifiedByUser.displayName} />
      )}
      {entry.createdAt && (
        <MetaRow label={tr("bento.multimedia.sidebar_prop_created", dictionary)} value={formatDateString(entry.createdAt)} />
      )}
      {entry.createdByUser?.displayName && (
        <MetaRow label={tr("bento.multimedia.sidebar_prop_author", dictionary)} value={entry.createdByUser.displayName} />
      )}
      {reviewStatusLabel && (
        <MetaRow label={tr("bento.multimedia.sidebar_prop_review_status", dictionary)} value={reviewStatusLabel} />
      )}
      {entry.properties?.["mintral:reviewedBy"] && (
        <MetaRow label={tr("bento.multimedia.sidebar_prop_reviewed_by", dictionary)} value={entry.properties?.["mintral:reviewedBy"]} />
      )}
      {entry.properties?.["mintral:reviewedAt"] && (
        <MetaRow label={tr("bento.multimedia.sidebar_prop_reviewed_at", dictionary)} value={formatDateString(entry.properties?.["mintral:reviewedAt"])} />
      )}
    </dl>
  );
}
