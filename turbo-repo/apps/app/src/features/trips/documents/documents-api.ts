"use client";

/** A trip's documents (multimedia) through `/api/trips/*`, and the trips source of the multimedia component. */

import { useMemo } from "react";
import useSWR, { mutate, useSWRConfig } from "swr";
import type { ReviewRoundResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import type { ObservationTypeItem } from "@/features/common/providers/alfresco-api/observation-types.types";
import type { AlfrescoFileEntry } from "@/features/task-forms/components/task-bento-form/components/side-data/multimedia-manager.tsx/image.types";
import { REVIEWABLE_ASPECT } from "@/features/task-forms/components/task-bento-form/components/side-data/multimedia-manager.tsx/reviewable";
import type {
  MediaCategory,
  MediaSource,
} from "@/features/task-forms/components/task-bento-form/components/side-data/multimedia-manager.tsx/media-source";
import { TripsApiError, tripsRequest } from "../monitors/monitors-api";
import { sheetKey } from "../sheet/sheet-api";

export const DOCUMENT_MANAGE = "trips:document.manage";
export const DOCUMENT_REVIEW = "trips:document.review";

export interface TripDocument {
  id: string;
  tripId: string;
  contentId: string;
  name: string;
  docType: string;
  version: number;
  reviewable: boolean;
  reviewStatus: "pending" | "approved" | "rejected" | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  deliveryId: string | null;
  mimetype: string | null;
  size: number;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

type Label = Record<string, string>;

export interface DocumentCatalog {
  types: {
    value: string;
    label: Label;
    reviewable: boolean;
    disabled: boolean;
  }[];
  reasons: {
    value: string;
    label: Label;
    appliesTo: string | null;
    disabled: boolean;
  }[];
}

interface DocumentReview {
  seq: number;
  version: number;
  verdict: "APPROVED" | "REJECTED" | "PENDING";
  reasons: string[];
  comment: string | null;
  reviewedBy: string | null;
  decidedAt: string | null;
}

const ROOT = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/trips`;

export function documentsKey(tripId: string) {
  return `${ROOT}/${encodeURIComponent(tripId)}/documents`;
}

function documentKey(tripId: string, id: string) {
  return `${documentsKey(tripId)}/${encodeURIComponent(id)}`;
}

export function documentContentUrl(
  tripId: string,
  id: string,
  download = false
) {
  const query = new URLSearchParams({ trip: tripId, doc: id });
  if (download) query.set("download", "1");
  return `${ROOT}/documents/content?${query}`;
}

function label(l: Label, lang: string) {
  return l[lang] ?? l.es ?? Object.values(l)[0] ?? "";
}

/** A trip document in the shape of the Alfresco node the multimedia component reads. */
export function toEntry(d: TripDocument): AlfrescoFileEntry {
  const properties: Record<string, string | undefined> = {
    "mintral:contentType": d.docType,
    "cm:versionLabel": String(d.version),
  };
  if (d.reviewStatus)
    properties["mintral:reviewStatus"] = d.reviewStatus.toUpperCase();
  if (d.reviewedAt) properties["mintral:reviewedAt"] = d.reviewedAt;
  if (d.reviewedBy) properties["mintral:reviewedBy"] = d.reviewedBy;
  return {
    entry: {
      id: d.id,
      name: d.name,
      content: d.mimetype
        ? {
            mimeType: d.mimetype,
            mimeTypeName: d.mimetype,
            sizeInBytes: d.size,
            encoding: "",
          }
        : undefined,
      createdAt: d.createdAt,
      createdByUser: { id: d.createdBy ?? "", displayName: d.createdBy ?? "" },
      isFile: true,
      isFolder: false,
      modifiedAt: d.updatedAt,
      modifiedByUser: { id: d.updatedBy ?? "", displayName: d.updatedBy ?? "" },
      nodeType: "trips:document",
      parentId: d.tripId,
      properties,
      aspectNames: d.reviewable ? [REVIEWABLE_ASPECT] : [],
    },
  };
}

/** A review round in the shape of Alfresco's; the version is the document's as text. */
export function toRound(r: DocumentReview): ReviewRoundResponse {
  return {
    seq: r.seq,
    verdict: r.verdict,
    version: String(r.version),
    reasons: r.reasons,
    comment: r.comment,
    reviewedBy: r.reviewedBy,
    decidedAt: r.decidedAt,
  };
}

/** Uploads a file as a document of the trip; with `deliveryId` it is that delivery's POD. */
export async function uploadDocument(
  tripId: string,
  file: File,
  docType: string,
  options: { deliveryId?: string; name?: string; replace?: string } = {}
) {
  const form = new FormData();
  form.set("file", file, options.name ?? file.name);
  form.set("docType", docType);
  if (options.deliveryId) form.set("deliveryId", options.deliveryId);
  const query = new URLSearchParams({ trip: tripId });
  if (options.replace) query.set("doc", options.replace);
  const response = await fetch(`${ROOT}/documents/upload?${query}`, {
    method: "POST",
    body: form,
  });
  const json = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new TripsApiError(
      json?.error ?? json?.message ?? `HTTP ${response.status}`,
      response.status
    );
  }
  await Promise.all([mutate(documentsKey(tripId)), mutate(sheetKey(tripId))]);
  return json as TripDocument;
}

export function useDocumentCatalog(tripId: string) {
  return useSWR<DocumentCatalog>(
    `${documentsKey(tripId)}/catalog`,
    (url: string) => tripsRequest<DocumentCatalog>(url)
  );
}

async function blob(url: string) {
  const response = await fetch(url);
  return response.ok ? response.blob() : null;
}

const PDF_WORKER_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/pdf.worker.min.mjs`;
const THUMBNAIL_WIDTH = 160;

/** The first page of a PDF as a PNG, for its row in the list. */
async function pdfThumbnail(pdf: Blob) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
  const doc = await pdfjs.getDocument({ data: await pdf.arrayBuffer() })
    .promise;
  try {
    const page = await doc.getPage(1);
    const unscaled = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({
      scale: THUMBNAIL_WIDTH / unscaled.width,
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const canvasContext = canvas.getContext("2d");
    if (!canvasContext) return null;
    await page.render({ canvasContext, viewport }).promise;
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
  } finally {
    await doc.destroy();
  }
}

async function thumbnail(url: string) {
  const file = await blob(url);
  if (!file?.type.startsWith("application/pdf")) return file;
  return pdfThumbnail(file).catch(() => null);
}

/** The multimedia component's source for one trip. */
export function createTripsSource(tripId: string, lang: string): MediaSource {
  const list = documentsKey(tripId);
  const thumbnailKey = (id: string) =>
    `${documentContentUrl(tripId, id)}#thumbnail`;
  const change = async (
    id: string,
    body: { docType?: string; name?: string }
  ) => {
    await tripsRequest(documentKey(tripId, id), { method: "PATCH", body });
    await mutate(list);
  };
  return {
    ready: true,
    recoverableDelete: false,
    useFiles() {
      const {
        data,
        isLoading,
        mutate: refresh,
      } = useSWR<TripDocument[]>(list, (url: string) =>
        tripsRequest<TripDocument[]>(url)
      );
      const files = useMemo(() => (data ? data.map(toEntry) : null), [data]);
      return { files, isLoading, refresh: () => refresh() };
    },
    useUpload() {
      return async (file, category, name, skipRevalidation) => {
        await uploadDocument(tripId, file, category, { name });
        if (!skipRevalidation) await mutate(list);
      };
    },
    useThumbnail(id) {
      const { data, error } = useSWR(thumbnailKey(id), () =>
        thumbnail(documentContentUrl(tripId, id))
      );
      return { data, error };
    },
    useCategories() {
      const { data } = useDocumentCatalog(tripId);
      return useMemo(() => {
        const out: Record<string, MediaCategory> = {};
        for (const t of data?.types ?? []) {
          if (!t.disabled)
            out[t.value] = { value: t.value, label: label(t.label, lang) };
        }
        return out;
      }, [data]);
    },
    useObservationTypes(category) {
      const { data } = useDocumentCatalog(tripId);
      const observationTypes = useMemo<ObservationTypeItem[]>(
        () =>
          (data?.reasons ?? [])
            .filter(
              (r) => !r.disabled && (!r.appliesTo || r.appliesTo === category)
            )
            .map((r, i) => ({
              nodeRef: r.value,
              code: r.value,
              name: label(r.label, lang),
              isActive: true,
              position: i,
              appliesTo: r.appliesTo ? [r.appliesTo] : [],
            })),
        [data, category]
      );
      return { observationTypes };
    },
    useInvalidateThumbnail() {
      const { mutate: refresh } = useSWRConfig();
      return (id) => refresh(thumbnailKey(id));
    },
    replace: (id, file) => uploadDocument(tripId, file, "", { replace: id }),
    remove: async (id) => {
      await tripsRequest(documentKey(tripId, id), { method: "DELETE" });
      await Promise.all([mutate(list), mutate(sheetKey(tripId))]);
    },
    setCategory: (id, category) => change(id, { docType: category }),
    rename: (id, name) => change(id, { name }),
    contentUrl: (id) => documentContentUrl(tripId, id),
    downloadUrl: (id) => documentContentUrl(tripId, id, true),
    history: async (id) => {
      const rounds = await tripsRequest<DocumentReview[]>(
        `${documentKey(tripId, id)}/reviews`
      );
      return {
        rounds: rounds.length > 0 ? rounds.map(toRound) : null,
        forum: null,
      };
    },
    recordRound: async (id, verdict, reasons, comment) => {
      await tripsRequest(`${documentKey(tripId, id)}/reviews`, {
        method: "POST",
        body: { verdict, reasons, comment },
      });
      await mutate(list);
    },
  };
}
