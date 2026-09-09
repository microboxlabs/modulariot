/**
 * Removes documents no dashboard row references.
 *
 * A save writes its document before it commits the row, so at any moment
 * some unreferenced documents are saves in progress. The age limit is what
 * separates those from the leftovers of a crash, a lost race or a failed
 * delete. Documents are listed before the referenced keys are read: a row
 * committed during the listing is then seen, and a document written during
 * it is too young to be deleted.
 */

import type { DashboardDocumentStore } from "../seams/documents";
import type { DashboardMetadataStore } from "../seams/metadata";

export interface SweepOptions {
  metadata: DashboardMetadataStore;
  documents: DashboardDocumentStore;
  /** Only unreferenced documents written before this instant are deleted. */
  olderThan: Date;
  /** Report what would be deleted without deleting it. */
  dryRun?: boolean;
}

export interface SweepResult {
  deleted: string[];
  /** Unreferenced but written after `olderThan`. */
  recent: number;
  /** Unreferenced, and the backend does not record when they were written. */
  unknownAge: number;
  referenced: number;
  /** Deletes that failed. The sweep continues past them. */
  failed: { key: string; error: unknown }[];
}

export async function sweepOrphanDocuments(
  options: SweepOptions,
): Promise<SweepResult> {
  const { metadata, documents, olderThan, dryRun = false } = options;
  if (documents.list === undefined) {
    throw new Error("This document store cannot list its documents");
  }

  const stored = [];
  for await (const document of documents.list()) stored.push(document);
  const referenced = await metadata.documentKeys();

  const result: SweepResult = {
    deleted: [],
    recent: 0,
    unknownAge: 0,
    referenced: 0,
    failed: [],
  };

  for (const { key, createdAt } of stored) {
    if (referenced.has(key)) {
      result.referenced++;
    } else if (createdAt === null) {
      result.unknownAge++;
    } else if (createdAt.getTime() >= olderThan.getTime()) {
      result.recent++;
    } else {
      try {
        if (!dryRun) await documents.delete(key);
        result.deleted.push(key);
      } catch (error) {
        result.failed.push({ key, error });
      }
    }
  }

  return result;
}
