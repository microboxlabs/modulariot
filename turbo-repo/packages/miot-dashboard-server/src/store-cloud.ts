/** Optional object storage; SDKs are loaded only when their store is built. */
export { createS3DocumentStore } from "./store/s3-documents";
export type {
  S3DocumentStoreOptions,
  S3DocumentClient,
} from "./store/s3-documents";
export { createGcsDocumentStore } from "./store/gcs-documents";
export type {
  GcsDocumentStoreOptions,
  GcsDocumentBucket,
} from "./store/gcs-documents";
