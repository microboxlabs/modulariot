import { createRequire } from "node:module";
import type { DashboardDocumentStore } from "../seams/documents";
import { bucketKeys, documentDate } from "./bucket-keys";

/** Narrow SDK surface; consumers using another store need no SDK types. */
export interface S3DocumentClient {
  putObject(input: {
    Bucket: string;
    Key: string;
    Body: Uint8Array;
    IfNoneMatch: string;
    ContentType: string;
  }): Promise<unknown>;
  getObject(input: {
    Bucket: string;
    Key: string;
  }): Promise<{ Body?: { transformToByteArray(): Promise<Uint8Array> } }>;
  deleteObject(input: { Bucket: string; Key: string }): Promise<unknown>;
  listObjectsV2(input: {
    Bucket: string;
    Prefix: string;
    ContinuationToken?: string;
  }): Promise<{
    Contents?: { Key?: string; LastModified?: Date }[];
    IsTruncated?: boolean;
    NextContinuationToken?: string;
  }>;
  destroy(): void;
}

export interface S3DocumentStoreOptions {
  bucket: string;
  /** Defaults to dashboards/. Dedicated to this store's objects. */
  prefix?: string;
  /** Otherwise resolved by the AWS SDK's standard configuration. */
  region?: string;
  /** Host-owned client; its lifecycle remains with the host. */
  client?: S3DocumentClient;
}

function loadClient(region?: string): S3DocumentClient {
  let sdk;
  try {
    sdk = createRequire(import.meta.url)("@aws-sdk/client-s3") as {
      S3: new (options: { region?: string }) => S3DocumentClient;
    };
  } catch {
    throw new Error(
      "S3 documents require the optional peer: npm install @aws-sdk/client-s3",
    );
  }
  return new sdk.S3(region ? { region } : {});
}

export function createS3DocumentStore(
  options: S3DocumentStoreOptions,
): DashboardDocumentStore {
  if (!options.bucket.trim()) throw new Error("S3 document bucket is required");
  const keys = bucketKeys(options.prefix);
  const client = options.client ?? loadClient(options.region);
  const object = (key: string) => ({
    Bucket: options.bucket,
    Key: keys.full(key),
  });
  return {
    async put(key, body) {
      await client.putObject({
        ...object(key),
        Body: body,
        ContentType: "application/json",
        IfNoneMatch: "*",
      });
    },
    async get(key) {
      try {
        const result = await client.getObject(object(key));
        if (!result.Body)
          throw new Error("S3 returned a document without a body");
        return await result.Body.transformToByteArray();
      } catch (error) {
        // NoSuchBucket, permissions failures and outages must remain errors.
        if ((error as { name?: string })?.name === "NoSuchKey") return null;
        throw error;
      }
    },
    async delete(key) {
      await client.deleteObject(object(key));
    },
    async *list() {
      let token: string | undefined;
      do {
        const page = await client.listObjectsV2({
          Bucket: options.bucket,
          Prefix: keys.prefix,
          ...(token ? { ContinuationToken: token } : {}),
        });
        for (const entry of page.Contents ?? []) {
          const key = entry.Key === undefined ? null : keys.relative(entry.Key);
          if (key !== null)
            yield { key, createdAt: documentDate(entry.LastModified) };
        }
        const next = page.IsTruncated ? page.NextContinuationToken : undefined;
        if (page.IsTruncated && (!next || next === token))
          throw new Error("S3 listing did not advance");
        token = next;
      } while (token);
    },
    async close() {
      if (!options.client) client.destroy();
    },
  };
}
