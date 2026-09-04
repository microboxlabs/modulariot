/**
 * `createCompositeStore` against stub stores, including ones that fail. The
 * order of its two writes cannot be observed from outside, so it is asserted
 * on the recorded calls.
 */

import { describe, expect, it } from "vitest";
import type { DashboardDocumentStore } from "../seams/documents";
import type {
  DashboardMetadataRow,
  DashboardMetadataStore,
} from "../seams/metadata";
import { createCompositeStore, dashboardDisplayName } from "./composite";

const ref = { tenantId: "acme", scopeId: "ops", slug: "fleet" };

interface Recorder {
  calls: string[];
  metadata: DashboardMetadataStore;
  documents: DashboardDocumentStore;
  bodies: Map<string, Uint8Array>;
}

function recorder(
  overrides: {
    row?: DashboardMetadataRow | null;
    commit?: DashboardMetadataRow | null;
    deleteFails?: boolean;
  } = {},
): Recorder {
  const calls: string[] = [];
  const bodies = new Map<string, Uint8Array>();
  const row = overrides.row ?? null;

  const committed: DashboardMetadataRow = {
    slug: ref.slug,
    name: "Fleet",
    revision: 1,
    documentKey: "acme/committed.json",
    updatedAt: "2026-09-02T00:00:00.000Z",
    updatedBy: "ana",
  };

  return {
    calls,
    bodies,
    metadata: {
      read: () => {
        calls.push("read");
        return Promise.resolve(row);
      },
      list: () => Promise.resolve([]),
      commit: (_ref, write) => {
        calls.push("commit");
        if (overrides.commit === null) return Promise.resolve(null);
        return Promise.resolve(
          overrides.commit ?? { ...committed, documentKey: write.documentKey },
        );
      },
      remove: () => {
        calls.push("remove");
        return Promise.resolve(row);
      },
      getPermissions: () => Promise.resolve([]),
      setPermissions: () => Promise.resolve(),
    },
    documents: {
      put: (key, body) => {
        calls.push(`put:${key}`);
        bodies.set(key, body);
        return Promise.resolve();
      },
      get: (key) => Promise.resolve(bodies.get(key) ?? null),
      delete: (key) => {
        calls.push(`delete:${key}`);
        if (overrides.deleteFails) {
          return Promise.reject(new Error("bucket said no"));
        }
        bodies.delete(key);
        return Promise.resolve();
      },
    },
  };
}

describe("the write protocol", () => {
  it("writes the document before it commits the row", async () => {
    const fake = recorder();
    const store = createCompositeStore({
      metadata: fake.metadata,
      documents: fake.documents,
      newDocumentKey: () => "acme/new.json",
    });

    await store.save(ref, { name: "Fleet" }, { updatedBy: "ana" });

    // In the other order the row would point at a document that has not been
    // written yet, and reads in that window would fail.
    expect(fake.calls.indexOf("put:acme/new.json")).toBeLessThan(
      fake.calls.indexOf("commit"),
    );
  });

  it("collects the document it wrote when the commit is refused", async () => {
    const fake = recorder({ commit: null });
    const store = createCompositeStore({
      metadata: fake.metadata,
      documents: fake.documents,
      newDocumentKey: () => "acme/loser.json",
    });

    await expect(
      store.save(
        ref,
        { name: "Fleet" },
        { updatedBy: "ana", expectedRevision: 3 },
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(fake.calls).toContain("delete:acme/loser.json");
    expect(fake.bodies.size).toBe(0);
  });

  it("reports the orphan rather than the failure when collection fails", async () => {
    const orphans: string[] = [];
    const fake = recorder({ commit: null, deleteFails: true });
    const store = createCompositeStore({
      metadata: fake.metadata,
      documents: fake.documents,
      newDocumentKey: () => "acme/stuck.json",
      onOrphan: (key) => orphans.push(key),
    });

    // A failed delete must not change the 409, and must not be silent.
    await expect(
      store.save(
        ref,
        { name: "Fleet" },
        { updatedBy: "ana", expectedRevision: 3 },
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(orphans).toEqual(["acme/stuck.json"]);
  });

  it("refuses a config it cannot serialize, before writing anything", async () => {
    const fake = recorder();
    const store = createCompositeStore({
      metadata: fake.metadata,
      documents: fake.documents,
    });

    const circular: Record<string, unknown> = {};
    circular.self = circular;

    await expect(
      store.save(ref, circular, { updatedBy: "ana" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fake.calls).toEqual([]);
  });

  it("stores an undefined config as null rather than as nothing", async () => {
    const fake = recorder();
    const store = createCompositeStore({
      metadata: fake.metadata,
      documents: fake.documents,
      newDocumentKey: () => "acme/undef.json",
    });

    await store.save(ref, undefined, { updatedBy: "ana" });
    const body = fake.bodies.get("acme/undef.json");
    expect(new TextDecoder().decode(body)).toBe("null");
  });
});

describe("configs it will not store", () => {
  it.each([
    ["a function", () => "no"],
    ["a symbol", Symbol("no")],
  ])("refuses %s, which JSON.stringify turns into nothing", async (_c, bad) => {
    const fake = recorder();
    const store = createCompositeStore({
      metadata: fake.metadata,
      documents: fake.documents,
    });

    // `JSON.stringify` returns undefined rather than throwing for these, so an
    // unchecked encode writes the seven characters "undefined" and the next
    // load fails to parse a document the store said it had written.
    await expect(
      store.save(ref, bad, { updatedBy: "ana" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fake.calls).toEqual([]);
  });
});

describe("a reporting hook that throws", () => {
  it("does not turn a completed save into a failure", async () => {
    const fake = recorder({ deleteFails: true });
    const store = createCompositeStore({
      metadata: fake.metadata,
      documents: fake.documents,
      onOrphan: () => {
        throw new Error("the log sink is down");
      },
    });

    // The metadata commit already succeeded; reporting a document left behind
    // must not take the caller's write with it.
    await expect(
      store.save(ref, { name: "Fleet" }, { updatedBy: "ana" }),
    ).resolves.toMatchObject({ revision: 1 });
  });

  it("does not turn a conflict into a different error", async () => {
    const fake = recorder({ commit: null, deleteFails: true });
    const store = createCompositeStore({
      metadata: fake.metadata,
      documents: fake.documents,
      onOrphan: () => {
        throw new Error("the log sink is down");
      },
    });

    await expect(
      store.save(
        ref,
        { name: "Fleet" },
        { updatedBy: "ana", expectedRevision: 3 },
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("reading", () => {
  it("refuses to serve a document that is not JSON", async () => {
    const fake = recorder({
      row: {
        slug: "fleet",
        name: "Fleet",
        revision: 4,
        documentKey: "acme/corrupt.json",
        updatedAt: "2026-09-02T00:00:00.000Z",
        updatedBy: "ana",
      },
    });
    fake.bodies.set("acme/corrupt.json", new TextEncoder().encode("<html>"));
    const store = createCompositeStore({
      metadata: fake.metadata,
      documents: fake.documents,
    });

    await expect(store.load(ref)).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });

  it("does not put the document's content in the error", async () => {
    const fake = recorder({
      row: {
        slug: "fleet",
        name: "Fleet",
        revision: 4,
        documentKey: "acme/corrupt.json",
        updatedAt: "2026-09-02T00:00:00.000Z",
        updatedBy: "ana",
      },
    });
    // A corrupted document is still tenant data, and this message is logged.
    fake.bodies.set(
      "acme/corrupt.json",
      new TextEncoder().encode("SECRET-CUSTOMER-NAME"),
    );
    const store = createCompositeStore({
      metadata: fake.metadata,
      documents: fake.documents,
    });

    const error = await store.load(ref).then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain("SECRET-CUSTOMER-NAME");
    expect((error as Error).message).toContain("acme/corrupt.json");
  });
});

describe("a save that lands between the two reads of a load", () => {
  const row = (
    revision: number,
    documentKey: string,
  ): DashboardMetadataRow => ({
    slug: "fleet",
    name: "Fleet",
    revision,
    documentKey,
    updatedAt: "2026-09-02T00:00:00.000Z",
    updatedBy: "ana",
  });

  /** Reads return `rows` in order, so the second read sees the newer row. */
  const readingInTurn = (rows: DashboardMetadataRow[]) => {
    let call = 0;
    const metadata = {
      read: () =>
        Promise.resolve(rows[Math.min(call++, rows.length - 1)] ?? null),
      list: () => Promise.resolve([]),
      commit: () => Promise.resolve(null),
      remove: () => Promise.resolve(null),
      getPermissions: () => Promise.resolve([]),
      setPermissions: () => Promise.resolve(),
    } as unknown as DashboardMetadataStore;
    return metadata;
  };

  const onlyHas = (key: string, config: unknown): DashboardDocumentStore => ({
    put: () => Promise.resolve(),
    get: (k) =>
      Promise.resolve(
        k === key ? new TextEncoder().encode(JSON.stringify(config)) : null,
      ),
    delete: () => Promise.resolve(),
  });

  it("follows the document the newer row names", async () => {
    // The save deleted the document this load was about to fetch. That is the
    // ordinary outcome of two clients working at once, not lost data.
    const store = createCompositeStore({
      metadata: readingInTurn([
        row(1, "acme/old.json"),
        row(2, "acme/new.json"),
      ]),
      documents: onlyHas("acme/new.json", { version: 2, name: "Newer" }),
    });

    const loaded = await store.load(ref);
    expect(loaded?.revision).toBe(2);
    expect(loaded?.config).toEqual({ version: 2, name: "Newer" });
  });

  it("still reports a missing document when the row did not move", async () => {
    const store = createCompositeStore({
      metadata: readingInTurn([row(1, "acme/only.json")]),
      documents: onlyHas("acme/somewhere-else.json", {}),
    });

    await expect(store.load(ref)).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });

  it("reports nothing at all when the dashboard was deleted", async () => {
    let call = 0;
    const metadata = {
      read: () =>
        Promise.resolve(call++ === 0 ? row(1, "acme/gone.json") : null),
      list: () => Promise.resolve([]),
      commit: () => Promise.resolve(null),
      remove: () => Promise.resolve(null),
      getPermissions: () => Promise.resolve([]),
      setPermissions: () => Promise.resolve(),
    } as unknown as DashboardMetadataStore;

    const store = createCompositeStore({
      metadata,
      documents: onlyHas("acme/nothing.json", {}),
    });
    expect(await store.load(ref)).toBeNull();
  });
});

describe("the display name", () => {
  it("prefers the config's name", () => {
    expect(dashboardDisplayName({ name: "Fleet" }, "fleet")).toBe("Fleet");
  });

  it.each([
    ["no name", {}],
    ["a blank name", { name: "   " }],
    ["a name that is not a string", { name: 42 }],
    ["not an object at all", "just a string"],
    ["null", null],
  ])("falls back to the slug given %s", (_case, config) => {
    expect(dashboardDisplayName(config, "fleet")).toBe("fleet");
  });
});
