import { describe, expect, it, vi } from "vitest";
import { createS3DocumentStore, type S3DocumentClient } from "./s3-documents";
import {
  createGcsDocumentStore,
  type GcsDocumentBucket,
} from "./gcs-documents";
import { bucketKeys } from "./bucket-keys";

const bytes = new TextEncoder().encode('{"name":"Fleet"}');
const time = new Date("2026-01-01T00:00:00Z");

function s3() {
  const client = {
    putObject: vi.fn<S3DocumentClient["putObject"]>().mockResolvedValue({}),
    getObject: vi
      .fn<S3DocumentClient["getObject"]>()
      .mockResolvedValue({ Body: { transformToByteArray: async () => bytes } }),
    deleteObject: vi
      .fn<S3DocumentClient["deleteObject"]>()
      .mockResolvedValue({}),
    listObjectsV2: vi
      .fn<S3DocumentClient["listObjectsV2"]>()
      .mockResolvedValue({}),
    destroy: vi.fn(),
  };
  return {
    client,
    store: createS3DocumentStore({ bucket: "configs", prefix: "app", client }),
  };
}

function gcs() {
  const file = {
    name: "app/acme/one",
    metadata: { timeCreated: time.toISOString() },
    save: vi.fn().mockResolvedValue(undefined),
    download: vi.fn().mockResolvedValue([bytes]),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const bucket = {
    file: vi.fn().mockReturnValue(file),
    getFiles: vi
      .fn<GcsDocumentBucket["getFiles"]>()
      .mockResolvedValue([[], null]),
    exists: vi.fn<GcsDocumentBucket["exists"]>().mockResolvedValue([true]),
  };
  const storage = { bucket: vi.fn().mockReturnValue(bucket) };
  return {
    file,
    bucket,
    storage,
    store: createGcsDocumentStore({
      bucket: "configs",
      prefix: "app",
      storageImpl: storage,
    }),
  };
}

describe("S3 documents", () => {
  it("writes only a new object and reads its bytes under the prefix", async () => {
    const { client, store } = s3();
    await store.put("acme/one", bytes);
    expect(client.putObject).toHaveBeenCalledWith({
      Bucket: "configs",
      Key: "app/acme/one",
      Body: bytes,
      IfNoneMatch: "*",
      ContentType: "application/json",
    });
    expect(await store.get("acme/one")).toEqual(bytes);
    expect(client.getObject).toHaveBeenCalledWith({
      Bucket: "configs",
      Key: "app/acme/one",
    });
    await store.delete("acme/one");
    expect(client.deleteObject).toHaveBeenCalledWith({
      Bucket: "configs",
      Key: "app/acme/one",
    });
    await store.close?.();
    expect(client.destroy).not.toHaveBeenCalled();
  });
  it("only treats NoSuchKey as absent", async () => {
    const { client, store } = s3();
    client.getObject.mockRejectedValueOnce({ name: "NoSuchKey" });
    expect(await store.get("acme/one")).toBeNull();
    for (const name of ["NoSuchBucket", "AccessDenied", "ServiceUnavailable"]) {
      client.getObject.mockRejectedValueOnce({ name });
      await expect(store.get("acme/one")).rejects.toMatchObject({ name });
    }
  });
  it("propagates a conditional write collision", async () => {
    const { client, store } = s3();
    client.putObject.mockRejectedValue({ name: "PreconditionFailed" });
    await expect(store.put("acme/one", bytes)).rejects.toMatchObject({
      name: "PreconditionFailed",
    });
  });
  it("walks every page and excludes other prefixes", async () => {
    const { client, store } = s3();
    client.listObjectsV2
      .mockResolvedValueOnce({
        Contents: [
          { Key: "app/acme/one", LastModified: time },
          { Key: "application/foreign" },
        ],
        IsTruncated: true,
        NextContinuationToken: "next",
      })
      .mockResolvedValueOnce({ Contents: [{ Key: "app/acme/two" }] });
    expect(await collect(store.list!())).toEqual([
      { key: "acme/one", createdAt: time },
      { key: "acme/two", createdAt: null },
    ]);
    expect(client.listObjectsV2).toHaveBeenLastCalledWith({
      Bucket: "configs",
      Prefix: "app/",
      ContinuationToken: "next",
    });
  });
  it("fails an incomplete listing rather than looping forever", async () => {
    const { client, store } = s3();
    client.listObjectsV2.mockResolvedValue({ IsTruncated: true });
    await expect(collect(store.list!())).rejects.toThrow("did not advance");
  });
});

describe("GCS documents", () => {
  it("writes with generation zero and round-trips the document", async () => {
    const { file, bucket, store } = gcs();
    await store.put("acme/one", bytes);
    expect(bucket.file).toHaveBeenCalledWith("app/acme/one");
    expect(file.save).toHaveBeenCalledWith(Buffer.from(bytes), {
      resumable: false,
      contentType: "application/json",
      preconditionOpts: { ifGenerationMatch: 0 },
    });
    expect(await store.get("acme/one")).toEqual(bytes);
    await store.delete("acme/one");
    expect(file.delete).toHaveBeenCalledWith();
  });
  it("addresses the configured bucket even with storage injected", async () => {
    const { storage } = gcs();
    expect(storage.bucket).toHaveBeenCalledWith("configs");
  });
  it("keeps missing files distinct from provider failures", async () => {
    const { file, store } = gcs();
    file.download.mockRejectedValueOnce({ code: 404 });
    expect(await store.get("acme/one")).toBeNull();
    file.download.mockRejectedValueOnce({ code: 403 });
    await expect(store.get("acme/one")).rejects.toMatchObject({ code: 403 });
    file.save.mockRejectedValueOnce({ code: 412 });
    await expect(store.put("acme/one", bytes)).rejects.toMatchObject({
      code: 412,
    });
  });
  it("reports a missing bucket rather than an absent document", async () => {
    // GCS answers 404 for both; only the object case is absence.
    const { file, bucket, store } = gcs();
    bucket.exists.mockResolvedValue([false]);
    file.download.mockRejectedValueOnce({ code: 404 });
    await expect(store.get("acme/one")).rejects.toMatchObject({ code: 404 });
    file.delete.mockRejectedValueOnce({ code: 404 });
    await expect(store.delete("acme/one")).rejects.toMatchObject({ code: 404 });
  });
  it("still treats a missing object as absent, and deleting it as done", async () => {
    const { file, bucket, store } = gcs();
    file.delete.mockRejectedValueOnce({ code: 404 });
    await expect(store.delete("acme/one")).resolves.toBeUndefined();
    expect(bucket.exists).toHaveBeenCalledTimes(1);
    // The bucket is known to be there now, so no further existence checks.
    file.download.mockRejectedValueOnce({ code: 404 });
    expect(await store.get("acme/one")).toBeNull();
    expect(bucket.exists).toHaveBeenCalledTimes(1);
  });
  it("paginates and leaves unknown creation times unsweepable", async () => {
    const { file, bucket, store } = gcs();
    bucket.getFiles
      .mockResolvedValueOnce([
        [file, { ...file, name: "foreign/one" }],
        { pageToken: "next" },
      ])
      .mockResolvedValueOnce([
        [{ ...file, name: "app/acme/two", metadata: { timeCreated: "bad" } }],
        null,
      ]);
    expect(await collect(store.list!())).toEqual([
      { key: "acme/one", createdAt: time },
      { key: "acme/two", createdAt: null },
    ]);
    expect(bucket.getFiles).toHaveBeenLastCalledWith({
      prefix: "app/",
      autoPaginate: false,
      pageToken: "next",
    });
  });
});

describe("bucket key containment", () => {
  it.each(["../escape", "/absolute", "a/../b", "a\\b", "", "a//b"])(
    "rejects %s before any provider call",
    async (key) => {
      const { store, client } = s3();
      await expect(store.put(key, bytes)).rejects.toThrow(
        "Invalid document key",
      );
      expect(client.putObject).not.toHaveBeenCalled();
    },
  );
  it("normalizes the prefix without matching sibling prefixes", () => {
    const keys = bucketKeys("app");
    expect(keys.full("acme/one")).toBe("app/acme/one");
    expect(keys.relative("application/one")).toBeNull();
  });
});

async function collect<T>(items: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of items) result.push(item);
  return result;
}
