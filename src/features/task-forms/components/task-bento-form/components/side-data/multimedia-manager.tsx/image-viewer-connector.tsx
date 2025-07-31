import { AlfrescoFileEntry } from "./image.types";
import ImageViewer from "@/features/geographic-view/components/image-viewer/image-viewer";
import { useGetNodeContent } from "@/features/common/providers/client-api.provider";
import { displayBase64Content } from "./file-images";
import { useMemo } from "react";

export default function ImageViewerConnector({
  images,
  selected,
  setSelected,
}: {
  images: AlfrescoFileEntry[];
  selected: number | null;
  setSelected: (index: number | null) => void;
}) {
  // Call useGetNodeContent for each image individually
  const imageDataResults = images.map((image, _index) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useGetNodeContent(image.entry.id);
  });

  // Create URLs for each image using the fetched data
  const imagesUrls = useMemo(() => {
    return imageDataResults
      .map((result, index) => {
        if (result.data?.data) {
          return displayBase64Content(
            result.data.data,
            images[index].entry.content.mimeType,
          );
        }
        return null;
      })
      .filter(Boolean) as string[];
  }, [imageDataResults, images]);

  return (
    <ImageViewer
      images={imagesUrls}
      selected={selected}
      setSelected={setSelected}
    />
  );
}
