import ImageViewer from "@/features/geographic-view/components/image-viewer/image-viewer";
import { displayBase64Content } from "./file-images";
import { useMemo } from "react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export default function ImageViewerConnector({
  images,
  selected,
  setSelected,
  dictionary,
}: {
  images: any[];
  selected: number | null;
  setSelected: (index: number | null) => void;
  dictionary: I18nRecord;
}) {
  const data = useMemo(() => {
    return images.map((image: any) => {
      return {
        tag: image.file.entry.properties["mintral:contentType"],
        name: image.file.entry.name,
      };
    });
  }, [images]);

  const imagesUrls = useMemo(() => {
    return images
      .map((image: any, index: number) => {
        if (image.data) {
          return displayBase64Content(
            image.data,
            image.file.entry.content.mimeType,
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
    />
  );
}
