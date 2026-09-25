import type { ServerConfig } from "./config";
import { createFsDocumentStore } from "../store/fs-documents";
import { createS3DocumentStore } from "../store/s3-documents";
import { createGcsDocumentStore } from "../store/gcs-documents";

export function buildDocumentStore(config: ServerConfig) {
  const cloud = config.cloudDocuments;
  if (cloud) {
    const options = { bucket: cloud.bucket, prefix: cloud.prefix };
    return {
      documentBackend: `${config.documents}:${cloud.bucket}/${cloud.prefix}`,
      documents:
        config.documents === "s3"
          ? createS3DocumentStore({
              ...options,
              ...(cloud.region ? { region: cloud.region } : {}),
            })
          : createGcsDocumentStore(options),
    };
  }
  return {
    documentBackend: config.documents,
    ...(config.documents === "fs"
      ? { documents: createFsDocumentStore({ root: config.documentsPath }) }
      : {}),
  };
}
