import { describe, expect, it } from "vitest";
import { createMemoryStore, createMemoryFolderStore } from "../testing";
import type { DashboardFolderStore } from "../seams/folders";

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
const scope = { tenantId: "acme", scopeId: "ops" };
const ref = { ...scope, slug: "late" };

describe("memory transaction lifecycle", () => {
  it("queues work inherited from a completed transaction", async () => {
    const store = createMemoryStore();
    const startLate = gate();
    let late!: Promise<unknown>;
    await store.transaction(async () => {
      late = startLate.promise.then(() =>
        store.save(ref, { version: 2 }, { updatedBy: "writer" }),
      );
    });
    const entered = gate();
    const rollback = gate();
    const second = store.transaction(async () => {
      entered.release();
      await rollback.promise;
      throw new Error("Abort");
    });
    const rejected = expect(second).rejects.toThrow("Abort");
    await entered.promise;
    startLate.release();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(await store.load(ref)).toBeNull();
    rollback.release();
    await rejected;
    await late;
    expect((await store.load(ref))?.updatedBy).toBe("writer");
  });

  it("rolls back an adapter registered inside the transaction", async () => {
    const store = createMemoryStore();
    let folders!: DashboardFolderStore;
    await expect(
      store.transaction(async () => {
        folders = createMemoryFolderStore(store);
        await folders.create(
          scope,
          { name: "Aborted", parentId: null },
          "writer",
        );
        throw new Error("Abort");
      }),
    ).rejects.toThrow("Abort");
    expect(await folders.list(scope)).toEqual([]);
    await folders.create(
      scope,
      { name: "Committed", parentId: null },
      "writer",
    );
    expect(await folders.list(scope)).toHaveLength(1);
  });
});
