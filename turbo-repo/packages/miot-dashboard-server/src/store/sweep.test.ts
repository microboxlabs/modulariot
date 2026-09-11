/**
 * `sweepOrphanDocuments` against stub stores, so each case controls exactly
 * which documents exist, which rows reference them and when they were written.
 */

import { describe, expect, it } from "vitest";
import type {
  DashboardDocumentStore,
  StoredDocument,
} from "../seams/documents";
import type { DashboardMetadataStore } from "../seams/metadata";
import { sweepOrphanDocuments } from "./sweep";

const NOW = new Date("2026-09-05T12:00:00Z");
const CUTOFF = new Date("2026-09-04T12:00:00Z");
const OLD = new Date("2026-09-01T00:00:00Z");

function metadataWith(keys: string[]): DashboardMetadataStore {
  const unused = () => Promise.reject(new Error("not used by the sweep"));
  return {
    read: unused,
    list: unused,
    commit: unused,
    remove: unused,
    getPermissions: unused,
    setPermissions: unused,
    documentKeys: () => Promise.resolve(new Set(keys)),
  };
}

function documentsWith(
  stored: StoredDocument[],
  options: { failDelete?: string[]; onList?: () => void } = {},
): DashboardDocumentStore & { deleted: string[] } {
  const deleted: string[] = [];
  return {
    deleted,
    put: () => Promise.reject(new Error("not used by the sweep")),
    get: () => Promise.reject(new Error("not used by the sweep")),
    delete: (key) => {
      if (options.failDelete?.includes(key)) {
        return Promise.reject(new Error("bucket said no"));
      }
      deleted.push(key);
      return Promise.resolve();
    },
    async *list() {
      options.onList?.();
      yield* stored;
    },
  };
}

describe("sweepOrphanDocuments", () => {
  it("deletes only what no row references and was written before the cutoff", async () => {
    const documents = documentsWith([
      { key: "acme/live.json", createdAt: OLD },
      { key: "acme/orphan.json", createdAt: OLD },
      { key: "acme/in-flight.json", createdAt: NOW },
      { key: "acme/ancient.json", createdAt: null },
    ]);

    const result = await sweepOrphanDocuments({
      metadata: metadataWith(["acme/live.json"]),
      documents,
      olderThan: CUTOFF,
    });

    expect(documents.deleted).toEqual(["acme/orphan.json"]);
    expect(result).toEqual({
      deleted: ["acme/orphan.json"],
      recent: 1,
      unknownAge: 1,
      referenced: 1,
      failed: [],
    });
  });

  it("treats a document written exactly at the cutoff as recent", async () => {
    const documents = documentsWith([{ key: "a/x.json", createdAt: CUTOFF }]);
    const result = await sweepOrphanDocuments({
      metadata: metadataWith([]),
      documents,
      olderThan: CUTOFF,
    });
    expect(documents.deleted).toEqual([]);
    expect(result.recent).toBe(1);
  });

  it("reports without deleting on a dry run", async () => {
    const documents = documentsWith([{ key: "a/x.json", createdAt: OLD }]);
    const result = await sweepOrphanDocuments({
      metadata: metadataWith([]),
      documents,
      olderThan: CUTOFF,
      dryRun: true,
    });
    expect(result.deleted).toEqual(["a/x.json"]);
    expect(documents.deleted).toEqual([]);
  });

  it("continues past a delete that fails and reports it", async () => {
    const documents = documentsWith(
      [
        { key: "a/first.json", createdAt: OLD },
        { key: "a/second.json", createdAt: OLD },
      ],
      { failDelete: ["a/first.json"] },
    );
    const result = await sweepOrphanDocuments({
      metadata: metadataWith([]),
      documents,
      olderThan: CUTOFF,
    });
    expect(result.deleted).toEqual(["a/second.json"]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.key).toBe("a/first.json");
  });

  it("reads the referenced keys after listing, so a row committed meanwhile counts", async () => {
    // The row lands while the listing runs. Reading the keys first would
    // miss it and delete a document a dashboard now depends on.
    const referenced = new Set<string>();
    const metadata = {
      ...metadataWith([]),
      documentKeys: () => Promise.resolve(referenced),
    };
    const documents = documentsWith([{ key: "a/x.json", createdAt: OLD }], {
      onList: () => referenced.add("a/x.json"),
    });

    const result = await sweepOrphanDocuments({
      metadata,
      documents,
      olderThan: CUTOFF,
    });

    expect(documents.deleted).toEqual([]);
    expect(result.referenced).toBe(1);
  });

  it("refuses a document store that cannot list", async () => {
    const documents = documentsWith([]);
    delete (documents as { list?: unknown }).list;
    await expect(
      sweepOrphanDocuments({
        metadata: metadataWith([]),
        documents,
        olderThan: CUTOFF,
      }),
    ).rejects.toThrow(/cannot list/);
  });
});
