/**
 * The `fs` document backend: one file per document under a root directory.
 *
 * Safe without locking because of how `createCompositeStore` uses it: every
 * key is written once, and a reader is only handed a key after the metadata
 * row that names it has committed. A file that is partly written when the
 * process dies is never referenced, so the sweep removes it later.
 */

import { mkdir, open, readdir, readFile, rm, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type {
  DashboardDocumentStore,
  StoredDocument,
} from "../seams/documents";

export interface FsDocumentStoreOptions {
  /** Directory the documents live under. Created on first write. */
  root: string;
}

const isMissing = (error: unknown): boolean =>
  (error as { code?: unknown })?.code === "ENOENT";

const isExisting = (error: unknown): boolean =>
  (error as { code?: unknown })?.code === "EEXIST";

/**
 * Keys are built by `createCompositeStore` from a percent-encoded tenant id
 * and a UUID, so a key this rejects did not come from there. The check is
 * kept because the key also comes back out of the database, and one bad row
 * must not turn into a read outside the root.
 *
 * The segment rule and the prefix check overlap on purpose. The prefix check
 * alone misses `.` and empty segments; the segment rule alone misses a
 * drive-relative Windows path such as `C:x`, which `isAbsolute` does not
 * consider absolute.
 */
export function resolveDocumentPath(root: string, key: string): string {
  const segments = key.split("/");
  const acceptable =
    key.length > 0 &&
    !key.includes("\0") &&
    !key.includes("\\") &&
    !isAbsolute(key) &&
    segments.every((s) => s.length > 0 && s !== "." && s !== "..");
  const path = acceptable ? resolve(root, ...segments) : null;
  if (path === null || !path.startsWith(root + sep)) {
    throw new Error(`Document key "${key}" is not a path under the root`);
  }
  return path;
}

export function createFsDocumentStore(
  options: FsDocumentStoreOptions,
): DashboardDocumentStore {
  const root = resolve(options.root);

  return {
    async put(key, body) {
      const path = resolveDocumentPath(root, key);
      await mkdir(dirname(path), { recursive: true });
      let handle;
      try {
        // `wx`: create, and fail if the file exists. Keys are never reused, so
        // an existing file means two writers were handed the same key.
        handle = await open(path, "wx");
      } catch (error) {
        if (isExisting(error)) {
          throw new Error(`Document "${key}" already exists`);
        }
        throw error;
      }
      try {
        await handle.writeFile(body);
        // Flushed before the metadata row can name it, so a power loss after
        // the commit does not leave a row pointing at an empty file.
        await handle.sync();
      } finally {
        await handle.close();
      }
    },

    async get(key) {
      try {
        return new Uint8Array(await readFile(resolveDocumentPath(root, key)));
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },

    async delete(key) {
      await rm(resolveDocumentPath(root, key), { force: true });
    },

    async *list(): AsyncIterable<StoredDocument> {
      let entries;
      try {
        entries = await readdir(root, { withFileTypes: true, recursive: true });
      } catch (error) {
        // Nothing has been written yet.
        if (isMissing(error)) return;
        throw error;
      }
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const path = join(entry.parentPath, entry.name);
        yield {
          key: relative(root, path).split(sep).join("/"),
          // A document is written once, so its last change is its creation.
          createdAt: (await stat(path)).mtime,
        };
      }
    },
  };
}
