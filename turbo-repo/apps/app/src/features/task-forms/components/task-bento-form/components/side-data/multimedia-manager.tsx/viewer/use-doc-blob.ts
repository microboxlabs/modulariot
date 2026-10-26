"use client";

import { useState, useEffect } from "react";
import type { MediaViewerItem } from "./media-inline-viewer";
import { useMediaSource } from "../media-source";

export function useDocBlob(
  current: MediaViewerItem | undefined,
  id: string | undefined
) {
  const source = useMediaSource();
  const content =
    current?.type === "document" && id ? source.contentUrl(id) : null;
  const revision = current?.file.entry.modifiedAt ?? "";
  const refresh = current?.refreshKey ?? 0;
  const separator = content?.includes("?") ? "&" : "?";
  const key = content
    ? `${content}${separator}revision=${encodeURIComponent(revision)}&refresh=${refresh}`
    : null;
  const [preview, setPreview] = useState<{ key: string; url: string } | null>(
    null
  );
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  useEffect(() => {
    setPreview(null);
    if (!key) return;
    const controller = new AbortController();
    let active = true;
    let objectUrl: string | undefined;
    setLoadingKey(key);
    fetch(key, { signal: controller.signal })
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (!active || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setPreview({ key, url: objectUrl });
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingKey(null);
      });
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [key]);

  return {
    docUrl: preview?.key === key ? preview.url : null,
    isDocLoading: key !== null && loadingKey === key,
  };
}
