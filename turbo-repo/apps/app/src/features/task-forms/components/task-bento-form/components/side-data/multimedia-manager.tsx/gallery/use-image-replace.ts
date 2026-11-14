"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { MediaViewerItem } from "../viewer/media-inline-viewer";
import type { MediaSource } from "../media-source";

/**
 * Replaces the content of a gallery item and reloads the gallery afterwards.
 *
 * Owns the replace modal's state: which item is being edited and whether a replace is in
 * flight. Both are released when the replace ends, whatever its outcome.
 */
export function useImageReplace({
  items,
  dictionary,
  src,
  refresh,
  invalidateThumbnail,
  onImageReplaced,
}: Readonly<{
  items: MediaViewerItem[];
  dictionary: I18nRecord;
  src: Pick<MediaSource, "replace">;
  refresh: () => Promise<unknown>;
  invalidateThumbnail: (id: string) => Promise<unknown>;
  /** Called once an image's content was replaced and reloaded, to refetch its thumbnail. */
  onImageReplaced: () => void;
}>) {
  const [editImageIndex, setEditImageIndex] = useState<number | null>(null);
  const [isUpdatingImage, setIsUpdatingImage] = useState(false);

  const handleReplaceImage = useCallback(
    async (file: File, index: number) => {
      const item = items[index];
      if (!item?.file?.entry?.id) {
        toast.error(tr("bento.multimedia.update_error", dictionary));
        return;
      }
      const nodeId = item.file.entry.id;
      setIsUpdatingImage(true);
      let reported = false;
      let saved = false;
      try {
        const updatePromise = src.replace(nodeId, file);
        toast.promise(updatePromise, {
          loading: tr("bento.multimedia.update_loading", dictionary),
          success: tr("bento.multimedia.update_success", dictionary),
          error: tr("bento.multimedia.update_error", dictionary),
        });
        reported = true;
        await updatePromise;
        saved = true;
        await refresh();
        await invalidateThumbnail(nodeId);
        if (item.type === "image") onImageReplaced();
      } catch (error) {
        // A rejected replace is already on screen through toast.promise. The content is
        // saved when only the reload fails, so the success toast stays true and the list is
        // just stale until the next refresh.
        if (saved)
          console.error("Reloading the gallery after a replace failed", error);
        else if (!reported)
          toast.error(tr("bento.multimedia.update_error", dictionary));
      } finally {
        setIsUpdatingImage(false);
        setEditImageIndex(null);
      }
    },
    [items, dictionary, refresh, invalidateThumbnail, src, onImageReplaced]
  );

  return {
    editImageIndex,
    setEditImageIndex,
    isUpdatingImage,
    handleReplaceImage,
  };
}
