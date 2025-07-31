import { useGetNodeThumbnail } from "@/features/common/providers/client-api.provider";
import { ImageComponent } from "@/features/geographic-view/components/image-viewer/image-selector";
import { AlfrescoFileEntry } from "./image.types";

export default function ImageElement({
  file,
  index,
  setSelectedImage,
  isLoading,
}: {
  file: AlfrescoFileEntry;
  index: number;
  setSelectedImage: (index: number) => void;
  isLoading: boolean;
}) {
  const {
    data: thumbnail,
    error: _thumbnailError,
    isLoading: _thumbnailIsLoading,
  } = useGetNodeThumbnail(file.entry.id);

  const thumbnailUrl = thumbnail ? URL.createObjectURL(thumbnail) : null;

  return (
    <ImageComponent
      key={file.entry.id}
      image={thumbnailUrl} // Use the constructed image URL
      index={index}
      setSelected={setSelectedImage}
      setSize="h-40 w-full"
      stepped={false}
      loading={isLoading}
    />
  );
}
