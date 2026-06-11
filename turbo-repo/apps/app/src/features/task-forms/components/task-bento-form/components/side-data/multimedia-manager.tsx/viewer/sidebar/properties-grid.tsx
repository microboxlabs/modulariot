import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
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
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {categoryLabel && <MetaRow label={tr("bento.multimedia.sidebar_prop_type", dictionary)} value={categoryLabel} />}
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
      {entry.properties?.["cm:versionLabel"] && (
        <MetaRow label={tr("bento.multimedia.sidebar_prop_version", dictionary)} value={`v${entry.properties?.["cm:versionLabel"]}`} />
      )}
      <MetaRow label={tr("bento.multimedia.sidebar_prop_format", dictionary)} value={entry.content.mimeTypeName ?? entry.content.mimeType} />
      <MetaRow label={tr("bento.multimedia.sidebar_prop_size", dictionary)} value={formatBytes(entry.content.sizeInBytes)} />
      {entry.properties?.["exif:pixelXDimension"] != null && entry.properties?.["exif:pixelYDimension"] != null && (
        <MetaRow label="Resolution" value={`${entry.properties?.["exif:pixelXDimension"]} × ${entry.properties?.["exif:pixelYDimension"]}`} />
      )}
    </dl>
  );
}
