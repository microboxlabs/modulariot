import { useGetNodeThumbnail } from "@/features/common/providers/client-api.provider";
import { ImageComponent } from "@/features/geographic-view/components/image-viewer/image-selector";
import { useEffect, useState } from "react";

export default function ImageElement({
  file,
  index,
  setSelectedImage,
}: {
  file: any;
  index: number;
  setSelectedImage: (index: number) => void;
}) {
  const [thumbnail, setThumbnail] = useState<any>(null);
  const [_thumbnailError, setThumbnailError] = useState<boolean>(false);
  const [_thumbnailIsLoading, setThumbnailIsLoading] = useState<boolean>(true);

  const { data, error } = useGetNodeThumbnail(file.entry.id);

  useEffect(() => {
    if (data) {
      setThumbnail(data);
      setThumbnailIsLoading(false);
    } else {
      setThumbnailError(true);
      setThumbnailIsLoading(false);
    }
  }, [data, error]);

  const thumbnailUrl = thumbnail ? URL.createObjectURL(thumbnail) : null;

  return (
    <ImageComponent
      key={file.entry.id}
      image={thumbnailUrl} // Use the constructed image URL
      index={index}
      setSelected={setSelectedImage}
      setSize="h-40 w-full"
      stepped={false}
    />
  );
}
