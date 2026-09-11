/**
 * Where dashboard config bytes are stored.
 *
 * Implementations need no conditional write and no atomicity: the metadata
 * store decides which of two concurrent saves succeeds. A filesystem, a bucket
 * and a database column are all valid backends. `createCompositeStore` builds
 * the keys; implementations treat them as opaque strings.
 */
export interface DashboardDocumentStore {
  /** Keys are never reused, so this always inserts. */
  put(key: string, body: Uint8Array): Promise<void>;

  /** `null` when the key is absent. */
  get(key: string): Promise<Uint8Array | null>;

  /** Deleting a key that does not exist succeeds. */
  delete(key: string): Promise<void>;

  /**
   * Optional: every stored document, for `sweepOrphanDocuments`. A backend
   * that cannot enumerate its keys cannot be swept.
   */
  list?(): AsyncIterable<StoredDocument>;

  /** Optional: implementations that hold a connection close it here. */
  close?(): Promise<void>;
}

export interface StoredDocument {
  key: string;
  /**
   * When the document was written, or `null` when the backend does not know.
   * The sweep leaves a document of unknown age alone.
   */
  createdAt: Date | null;
}
