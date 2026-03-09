import ImageViewer from "@/features/geographic-view/components/image-viewer/image-viewer";
import { displayBase64Content } from "./file-images";
import { useMemo } from "react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { ImageItem } from "./image.types";

export default function ImageViewerConnector({
  images,
  selected,
  setSelected,
  dictionary,
  onReplaceImage,
}: Readonly<{
  images: ImageItem[];
  selected: number | null;
  setSelected: (index: number | null) => void;
  dictionary: I18nRecord;
  onReplaceImage?: (file: File, index: number) => void;
}>) {
  const data = useMemo(() => {
    return images.map((image) => {
      return {
        tag: image.file.entry.properties["mintral:contentType"],
        name: image.file.entry.name,
        modifiedAt: image.file.entry.modifiedAt,
        modifiedByUser: image.file.entry.modifiedByUser,
      };
    });
  }, [images]);

  const imagesUrls = useMemo(() => {
    return images
      .map((image) => {
        if (image.data) {
          return displayBase64Content(
            image.data,
            image.file.entry.content.mimeType
          );
        }
        return null;
      })
      .filter(Boolean) as string[];
  }, [images]);

  return (
    <ImageViewer
      images={imagesUrls}
      selected={selected}
      setSelected={setSelected}
      data={data}
      dictionary={dictionary}
      onReplaceImage={onReplaceImage}
    />
  );
}
