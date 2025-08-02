import ImageViewer from "@/features/geographic-view/components/image-viewer/image-viewer";
import { displayBase64Content } from "./file-images";
import { useMemo } from "react";

export default function ImageViewerConnector({
  images,
  selected,
  setSelected,
}: {
  images: any[];
  selected: number | null;
  setSelected: (index: number | null) => void;
}) {
  const imagesUrls = useMemo(() => {
    return images
      .map((image: any) => {
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
    />
  );
}
