import { useGetNodeThumbnail } from "@/features/common/providers/client-api.provider";
import { ImageComponent } from "@/features/geographic-view/components/image-viewer/image-selector";
import { useState } from "react";

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

  useGetNodeThumbnail(file.entry.id)
    .then((res: any) => {
      setThumbnail(res);
      setThumbnailIsLoading(false);
    })
    .catch((_err: any) => {
      setThumbnailError(true);
      setThumbnailIsLoading(false);
    });

  return (
    <ImageComponent
      key={file.entry.id}
      image={thumbnail} // Use the constructed image URL
      index={index}
      setSelected={setSelectedImage}
      setSize="h-40 w-full"
      stepped={false}
    />
  );
}
