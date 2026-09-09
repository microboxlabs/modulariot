import { createRequire } from "node:module";
import type { DashboardDocumentStore } from "../seams/documents";
import { bucketKeys, documentDate } from "./bucket-keys";

interface GcsFile {
  name: string;
  metadata: { timeCreated?: string };
  save(
    body: Buffer,
    options: {
      resumable: boolean;
      contentType: string;
      preconditionOpts: { ifGenerationMatch: number };
    },
  ): Promise<unknown>;
  download(): Promise<[Uint8Array]>;
  delete(options: { ignoreNotFound: boolean }): Promise<unknown>;
}

export interface GcsDocumentBucket {
  file(key: string): GcsFile;
  getFiles(options: {
    prefix: string;
    autoPaginate: false;
    pageToken?: string;
  }): Promise<[GcsFile[], { pageToken?: string } | null, unknown?]>;
}

export interface GcsDocumentStoreOptions {
  bucket: string;
  prefix?: string;
  /** Host-owned bucket; otherwise uses Application Default Credentials. */
  bucketImpl?: GcsDocumentBucket;
}

function loadBucket(name: string): GcsDocumentBucket {
  let sdk;
  try {
    sdk = createRequire(import.meta.url)("@google-cloud/storage") as {
      Storage: new () => { bucket(name: string): GcsDocumentBucket };
    };
  } catch {
    throw new Error(
      "GCS documents require the optional peer: npm install @google-cloud/storage",
    );
  }
  return new sdk.Storage().bucket(name);
}

export function createGcsDocumentStore(
  options: GcsDocumentStoreOptions,
): DashboardDocumentStore {
  if (!options.bucket.trim())
    throw new Error("GCS document bucket is required");
  const keys = bucketKeys(options.prefix);
  const bucket = options.bucketImpl ?? loadBucket(options.bucket);
  return {
    async put(key, body) {
      await bucket.file(keys.full(key)).save(Buffer.from(body), {
        resumable: false,
        contentType: "application/json",
        preconditionOpts: { ifGenerationMatch: 0 },
      });
    },
    async get(key) {
      try {
        const [body] = await bucket.file(keys.full(key)).download();
        return new Uint8Array(body);
      } catch (error) {
        if ((error as { code?: number })?.code === 404) return null;
        throw error;
      }
    },
    async delete(key) {
      await bucket.file(keys.full(key)).delete({ ignoreNotFound: true });
    },
    async *list() {
      let pageToken: string | undefined;
      do {
        const [files, next] = await bucket.getFiles({
          prefix: keys.prefix,
          autoPaginate: false,
          ...(pageToken ? { pageToken } : {}),
        });
        for (const file of files) {
          const key = keys.relative(file.name);
          if (key !== null)
            yield { key, createdAt: documentDate(file.metadata.timeCreated) };
        }
        const token = next?.pageToken;
        if (token && token === pageToken)
          throw new Error("GCS listing did not advance");
        pageToken = token;
      } while (pageToken);
    },
  };
}
