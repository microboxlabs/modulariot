/**
 * The `fs` document backend: one file per document under a root directory.
 *
 * Safe without locking because of how `createCompositeStore` uses it: every
 * key is written once, and a reader is only handed a key after the metadata
 * row that names it has committed. A file that is partly written when the
 * process dies is never referenced, so the sweep removes it later.
 */

import { constants } from "node:fs";
import { mkdir, open, readdir, realpath, rm, stat } from "node:fs/promises";
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

/**
 * The lexical check above cannot see symbolic links: `resolve` does not follow
 * them, so a link planted under the root — `<root>/acme` pointing at `/etc` —
 * satisfies it and the operation lands outside. This resolves the real parent
 * directory and checks that instead.
 *
 * A parent that does not exist yet is contained by definition: there is
 * nothing to traverse. `put` calls this again after creating it.
 *
 * `realRoot` is the root with its own links resolved. Comparing against the
 * configured spelling instead would reject every key whenever the root sits
 * under one — `/tmp` on macOS is a link to `/private/tmp`.
 */
async function assertParentContained(
  realRoot: string,
  key: string,
  path: string,
): Promise<void> {
  let real;
  try {
    real = await realpath(dirname(path));
  } catch (error) {
    if (isMissing(error)) return;
    throw error;
  }
  if (real !== realRoot && !real.startsWith(realRoot + sep)) {
    throw new Error(
      `Document key "${key}" resolves outside the root through a symbolic link`,
    );
  }
}

export function createFsDocumentStore(
  options: FsDocumentStoreOptions,
): DashboardDocumentStore {
  const root = resolve(options.root);

  // Resolved once and reused. Absent until the first write, and a root that
  // is not there yet has nothing under it to escape through.
  let realRoot: string | null = null;
  const resolvedRoot = async (): Promise<string> => {
    if (realRoot !== null) return realRoot;
    try {
      realRoot = await realpath(root);
    } catch (error) {
      if (!isMissing(error)) throw error;
      return root;
    }
    return realRoot;
  };

  return {
    async put(key, body) {
      const path = resolveDocumentPath(root, key);
      await assertParentContained(await resolvedRoot(), key, path);
      await mkdir(dirname(path), { recursive: true });
      // Again, because the directory now exists: the first call passes when
      // the parent is absent, which is exactly when a link could be waiting
      // one level up.
      await assertParentContained(await resolvedRoot(), key, path);
      let handle;
      try {
        // `wx`: create, and fail if the file exists. Keys are never reused, so
        // an existing file means two writers were handed the same key. O_EXCL
        // also refuses to follow a symbolic link at the final name.
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
      const path = resolveDocumentPath(root, key);
      await assertParentContained(await resolvedRoot(), key, path);
      let handle;
      try {
        // O_NOFOLLOW so the document itself cannot be a link to somewhere
        // else. The parent check above covers the directories above it.
        handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      } catch (error) {
        if (isMissing(error)) return null;
        if ((error as { code?: unknown })?.code === "ELOOP") {
          throw new Error(
            `Document "${key}" is a symbolic link, and is not read`,
          );
        }
        throw error;
      }
      try {
        return new Uint8Array(await handle.readFile());
      } finally {
        await handle.close();
      }
    },

    async delete(key) {
      const path = resolveDocumentPath(root, key);
      await assertParentContained(await resolvedRoot(), key, path);
      await rm(path, { force: true });
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
        let stats;
        try {
          stats = await stat(path);
        } catch (error) {
          // A save that finished between the listing and here removed its
          // previous document. Throwing would abandon every later entry, so
          // the one orphan this sweep cannot measure waits for the next.
          if (isMissing(error)) continue;
          throw error;
        }
        yield {
          key: relative(root, path).split(sep).join("/"),
          // A document is written once, so its last change is its creation.
          createdAt: stats.mtime,
        };
      }
    },
  };
}
