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
  delete(): Promise<unknown>;
}

export interface GcsDocumentBucket {
  file(key: string): GcsFile;
  getFiles(options: {
    prefix: string;
    autoPaginate: false;
    pageToken?: string;
  }): Promise<[GcsFile[], { pageToken?: string } | null, unknown?]>;
  /** Tells a missing object apart from a missing bucket: both answer 404. */
  exists(): Promise<[boolean]>;
}

/** The narrow slice of the SDK's `Storage` this store needs. Injected rather
 * than a ready-made bucket so `bucket` below stays the one name in play, the
 * way the S3 store always sends `options.bucket`. */
export interface GcsDocumentStorage {
  bucket(name: string): GcsDocumentBucket;
}

export interface GcsDocumentStoreOptions {
  bucket: string;
  prefix?: string;
  /** Host-owned storage; otherwise uses Application Default Credentials. */
  storageImpl?: GcsDocumentStorage;
}

function loadStorage(): GcsDocumentStorage {
  let sdk;
  try {
    sdk = createRequire(import.meta.url)("@google-cloud/storage") as {
      Storage: new () => GcsDocumentStorage;
    };
  } catch {
    throw new Error(
      "GCS documents require the optional peer: npm install @google-cloud/storage",
    );
  }
  return new sdk.Storage();
}

function isNotFound(error: unknown): boolean {
  return (error as { code?: number })?.code === 404;
}

export function createGcsDocumentStore(
  options: GcsDocumentStoreOptions,
): DashboardDocumentStore {
  if (!options.bucket.trim())
    throw new Error("GCS document bucket is required");
  const keys = bucketKeys(options.prefix);
  const bucket = (options.storageImpl ?? loadStorage()).bucket(options.bucket);

  // GCS answers 404 for a missing object AND for a missing or unreachable
  // bucket. Reporting the second as "no such document" would turn a
  // configuration failure into a silent empty read, so a 404 only counts as
  // absence once the bucket is known to be there — the same line the S3 store
  // draws between NoSuchKey and NoSuchBucket. Checked at most once: a bucket
  // that exists does not stop existing under us, and the check costs a round
  // trip we do not want on every miss.
  let bucketSeen = false;
  const objectIsAbsent = async (): Promise<boolean> => {
    if (bucketSeen) return true;
    const [exists] = await bucket.exists();
    bucketSeen = exists;
    return exists;
  };

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
        bucketSeen = true;
        return new Uint8Array(body);
      } catch (error) {
        if (isNotFound(error) && (await objectIsAbsent())) return null;
        throw error;
      }
    },
    async delete(key) {
      try {
        await bucket.file(keys.full(key)).delete();
        bucketSeen = true;
      } catch (error) {
        // Deleting an absent document is a no-op, as it is on S3; a missing
        // bucket is not, and must reach the caller's orphan reporting.
        if (isNotFound(error) && (await objectIsAbsent())) return;
        throw error;
      }
    },
    async *list() {
      let pageToken: string | undefined;
      do {
        const [files, next] = await bucket.getFiles({
          prefix: keys.prefix,
          autoPaginate: false,
          ...(pageToken ? { pageToken } : {}),
        });
        bucketSeen = true;
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
