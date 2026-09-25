/**
 * The `fs` document backend against a real temporary directory.
 */

import { mkdtempSync, readdirSync, rmSync, utimesSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFsDocumentStore, resolveDocumentPath } from "./fs-documents";

const body = (text: string) => new TextEncoder().encode(text);
const text = (bytes: Uint8Array | null) =>
  bytes === null ? null : new TextDecoder().decode(bytes);

const directories: string[] = [];
function temporaryDirectory(): string {
  const path = mkdtempSync(join(tmpdir(), "miot-fs-docs-"));
  directories.push(path);
  return path;
}

afterEach(() => {
  for (const path of directories.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

async function collect<T>(items: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of items) out.push(item);
  return out;
}

describe("the fs document store", () => {
  it("round-trips bytes and creates the tenant directory on the way", async () => {
    const root = join(temporaryDirectory(), "documents");
    const store = createFsDocumentStore({ root });

    await store.put("acme/one.json", body('{"a":1}'));

    expect(text(await store.get("acme/one.json"))).toBe('{"a":1}');
    expect(readdirSync(join(root, "acme"))).toEqual(["one.json"]);
  });

  it("answers null for a key that was never written", async () => {
    const store = createFsDocumentStore({ root: temporaryDirectory() });
    expect(await store.get("acme/missing.json")).toBeNull();
  });

  it("refuses to write the same key twice", async () => {
    const store = createFsDocumentStore({ root: temporaryDirectory() });
    await store.put("acme/one.json", body("first"));

    await expect(store.put("acme/one.json", body("second"))).rejects.toThrow(
      /already exists/,
    );
    expect(text(await store.get("acme/one.json"))).toBe("first");
  });

  it("deletes, and deleting again is not an error", async () => {
    const store = createFsDocumentStore({ root: temporaryDirectory() });
    await store.put("acme/one.json", body("x"));

    await store.delete("acme/one.json");
    await store.delete("acme/one.json");

    expect(await store.get("acme/one.json")).toBeNull();
  });

  it("lists every document with the time it was written", async () => {
    const root = temporaryDirectory();
    const store = createFsDocumentStore({ root });
    await store.put("acme/one.json", body("x"));
    await store.put("beta/two.json", body("y"));
    const old = new Date("2020-01-01T00:00:00Z");
    utimesSync(join(root, "beta", "two.json"), old, old);

    const listed = await collect(store.list!());

    expect(listed.map((d) => d.key).sort()).toEqual([
      "acme/one.json",
      "beta/two.json",
    ]);
    const two = listed.find((d) => d.key === "beta/two.json");
    expect(two?.createdAt?.getTime()).toBe(old.getTime());
  });

  it("lists nothing, rather than failing, before the first write", async () => {
    const store = createFsDocumentStore({
      root: join(temporaryDirectory(), "never-created"),
    });
    expect(await collect(store.list!())).toEqual([]);
  });
});

describe("keys that must not become paths", () => {
  const root = "/srv/documents";

  it.each([
    "../etc/passwd",
    "acme/../../etc/passwd",
    "/etc/passwd",
    "acme//one.json",
    "acme/./one.json",
    "acme\\one.json",
    "acme/one\0.json",
    "",
    "acme/",
  ])("rejects %j", (key) => {
    expect(() => resolveDocumentPath(root, key)).toThrow(/not a path under/);
  });

  it("keeps a percent-encoded tenant id as one segment", () => {
    expect(resolveDocumentPath(root, "%2E%2E/one.json")).toBe(
      "/srv/documents/%2E%2E/one.json",
    );
  });

  it("is applied on every operation, not only on write", async () => {
    const store = createFsDocumentStore({ root: temporaryDirectory() });
    await expect(store.get("../x")).rejects.toThrow(/not a path under/);
    await expect(store.delete("../x")).rejects.toThrow(/not a path under/);
    await expect(store.put("../x", body("x"))).rejects.toThrow(
      /not a path under/,
    );
  });
});

describe("containment against symbolic links", () => {
  let root: string;
  let outside: string;

  beforeEach(async () => {
    const base = await mkdtemp(join(tmpdir(), "miot-fs-link-"));
    root = join(base, "root");
    outside = join(base, "outside");
    await mkdir(root, { recursive: true });
    await mkdir(outside, { recursive: true });
    await writeFile(join(outside, "secret.json"), '{"secret":true}');
    // What a misconfigured deployment, or anyone who can write in the root,
    // leaves behind. `resolve` does not follow it, so the lexical check alone
    // lets every operation through it.
    await symlink(outside, join(root, "acme"));
  });

  it("refuses to read through a linked directory", async () => {
    const store = createFsDocumentStore({ root });
    await expect(store.get("acme/secret.json")).rejects.toThrow(
      /outside the root/,
    );
  });

  it("refuses to write through a linked directory", async () => {
    const store = createFsDocumentStore({ root });
    await expect(store.put("acme/planted.json", body("{}"))).rejects.toThrow(
      /outside the root/,
    );
    await expect(readdir(outside)).resolves.toEqual(["secret.json"]);
  });

  it("refuses to delete through a linked directory", async () => {
    const store = createFsDocumentStore({ root });
    await expect(store.delete("acme/secret.json")).rejects.toThrow(
      /outside the root/,
    );
    await expect(readdir(outside)).resolves.toEqual(["secret.json"]);
  });

  it("refuses to read a document that is itself a link", async () => {
    const store = createFsDocumentStore({ root });
    await mkdir(join(root, "globex"), { recursive: true });
    await symlink(join(outside, "secret.json"), join(root, "globex/x.json"));
    await expect(store.get("globex/x.json")).rejects.toThrow(
      /symbolic link|outside the root/,
    );
  });

  it("still works when the root itself is reached through a link", async () => {
    // `/tmp` is a link to `/private/tmp` on macOS, so this is the normal case
    // rather than an exotic one.
    const base = await mkdtemp(join(tmpdir(), "miot-fs-realroot-"));
    const real = join(base, "real");
    const via = join(base, "via");
    await mkdir(real, { recursive: true });
    await symlink(real, via);
    const store = createFsDocumentStore({ root: via });
    await store.put("acme/one.json", body("{}"));
    await expect(store.get("acme/one.json")).resolves.not.toBeNull();
  });
});

describe("listing while documents are being removed", () => {
  it("skips an entry that disappears between the listing and its stat", async () => {
    const root = await mkdtemp(join(tmpdir(), "miot-fs-race-"));
    const store = createFsDocumentStore({ root });
    for (const name of ["a", "b", "c", "d"]) {
      await store.put(`t/${name}.json`, body("{}"));
    }

    const seen: string[] = [];
    for await (const document of store.list!()) {
      seen.push(document.key);
      // A save that completed during the sweep removed its old document.
      if (seen.length === 1) await rm(join(root, "t/d.json"), { force: true });
    }
    // Whatever it managed to see, it did not abandon the rest of the listing.
    expect(seen.length).toBeGreaterThanOrEqual(3);
  });
});
