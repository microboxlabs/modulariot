/**
 * The `fs` document backend against a real temporary directory.
 */

import { mkdtempSync, readdirSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
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
