"use client";

import { useState, useEffect } from "react";
import type { MediaViewerItem } from "./media-inline-viewer";

export function useDocBlob(current: MediaViewerItem | undefined, id: string | undefined) {
  const [docBlobUrls, setDocBlobUrls] = useState<Record<string, string>>({});
  const [loadingDocs, setLoadingDocs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (current?.type !== "document" || !id) return;
    if (docBlobUrls[id] || loadingDocs.has(id)) return;

    setLoadingDocs((prev) => new Set(prev).add(id));
    fetch(`/app/api/bento/content?nodeId=${id}`)
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        setDocBlobUrls((prev) => ({ ...prev, [id]: url }));
      })
      .catch(() => {})
      .finally(() => {
        setLoadingDocs((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      });
  }, [current, id, docBlobUrls, loadingDocs]);

  useEffect(() => {
    return () => {
      Object.values(docBlobUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const docUrl = current?.type === "document" && id ? docBlobUrls[id] : null;
  const isDocLoading = current?.type === "document" && id ? loadingDocs.has(id) : false;

  return { docUrl, isDocLoading };
}
