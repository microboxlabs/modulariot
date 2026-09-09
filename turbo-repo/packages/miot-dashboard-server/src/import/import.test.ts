/**
 * The import runs once, against real data, and is not reversible. Every case
 * here is something that would be discovered too late otherwise.
 */

import { describe, expect, it, vi } from "vitest";
import { createMemoryStore } from "../testing";
import type { ServerDashboardStore } from "../seams/store";
import { importDashboards } from "./import";
import type { LegacyDashboard, LegacyDashboardSource } from "./legacy";

const v2 = (name: string) => ({ version: 2, name, widgets: [] });

const ref = (slug: string, tenantId = "acme", scopeId = "ops") => ({
  tenantId,
  scopeId,
  slug,
});

const sourceOf = (...items: LegacyDashboard[]): LegacyDashboardSource => ({
  read: async function* () {
    for (const item of items) yield item;
  },
});

describe("importDashboards", () => {
  it("writes nothing unless asked, and says what it would do", async () => {
    // The default is the harmless one, because the flag people forget is the
    // one that must not destroy anything.
    const store = createMemoryStore();
    const result = await importDashboards({
      source: sourceOf({ ref: ref("fleet"), config: v2("Fleet") }),
      store,
    });

    expect(result.dryRun).toBe(true);
    expect(result.imported).toEqual(["acme/ops/fleet"]);
    await expect(store.load(ref("fleet"))).resolves.toBeNull();
  });

  it("writes when applied", async () => {
    const store = createMemoryStore();
    const result = await importDashboards({
      source: sourceOf({ ref: ref("fleet"), config: v2("Fleet") }),
      store,
      dryRun: false,
    });

    expect(result.imported).toEqual(["acme/ops/fleet"]);
    const saved = await store.load(ref("fleet"));
    expect(saved?.config).toEqual(v2("Fleet"));
    expect(saved?.revision).toBe(1);
  });

  it("keeps the creator, because it decides who may edit later", async () => {
    // A store takes created_by from the first write and never updates it, and
    // the capability policy lets a Contributor edit what they created. Naming
    // the import here would quietly demote every Contributor in the estate.
    const store = createMemoryStore();
    await importDashboards({
      source: sourceOf({
        ref: ref("fleet"),
        config: v2("Fleet"),
        createdBy: "carl",
        updatedBy: "erin",
      }),
      store,
      dryRun: false,
      importedBy: "migration-job",
    });

    await expect(store.load(ref("fleet"))).resolves.toMatchObject({
      createdBy: "carl",
    });
  });

  it("carries permission assignments across verbatim", async () => {
    // Dropping these publishes a restricted dashboard to its whole scope, and
    // a one-way migration cannot be walked back.
    const store = createMemoryStore();
    await importDashboards({
      source: sourceOf({
        ref: ref("fleet"),
        config: v2("Fleet"),
        assignments: [{ authorityId: "connie", role: "Editor" }],
      }),
      store,
      dryRun: false,
    });

    await expect(store.getPermissions(ref("fleet"))).resolves.toEqual([
      { authorityId: "connie", role: "Editor" },
    ]);
  });

  it("leaves a dashboard that is already there alone", async () => {
    // A second run after a partial one has to be safe, and must not overwrite
    // edits made since.
    const store = createMemoryStore();
    await store.save(ref("fleet"), v2("Edited since"), { updatedBy: "erin" });

    const result = await importDashboards({
      source: sourceOf({ ref: ref("fleet"), config: v2("Old") }),
      store,
      dryRun: false,
    });

    expect(result.skipped).toEqual(["acme/ops/fleet"]);
    expect(result.imported).toEqual([]);
    await expect(store.load(ref("fleet"))).resolves.toMatchObject({
      config: v2("Edited since"),
    });
  });

  it("refuses what it cannot convert, and names why", async () => {
    const store = createMemoryStore();
    const result = await importDashboards({
      source: sourceOf(
        { ref: ref("old"), config: { version: 1, name: "Old" } },
        { ref: ref("none"), config: { name: "No version" } },
        { ref: ref("future"), config: { version: 3, name: "Newer" } },
        { ref: ref("rubbish"), config: "not an object" },
        { ref: ref("fine"), config: v2("Fine") },
      ),
      store,
      dryRun: false,
    });

    expect(result.imported).toEqual(["acme/ops/fine"]);
    expect(result.refused.map((r) => r.ref)).toEqual([
      "acme/ops/old",
      "acme/ops/none",
      "acme/ops/future",
      "acme/ops/rubbish",
    ]);
    expect(result.refused[0]?.reason).toMatch(/version 1/);
    expect(result.refused[1]?.reason).toMatch(/no numeric version/);
    expect(result.refused[2]?.reason).toMatch(/newer/);
    expect(result.refused[3]?.reason).toMatch(/not an object/);

    // Refused means left in the source, not written and not half-written.
    await expect(store.load(ref("old"))).resolves.toBeNull();
  });

  it("keeps going after one dashboard fails, and reports it", async () => {
    // A run against a real estate must not stop at the first bad row, or the
    // operator restarts it repeatedly to get through.
    const store: ServerDashboardStore = {
      ...createMemoryStore(),
      load: () => Promise.resolve(null),
      save: vi
        .fn()
        .mockRejectedValueOnce(new Error("the disk is full"))
        .mockResolvedValue({
          config: {},
          updatedAt: "",
          updatedBy: "",
          revision: 1,
        }),
    };

    const result = await importDashboards({
      source: sourceOf(
        { ref: ref("first"), config: v2("First") },
        { ref: ref("second"), config: v2("Second") },
      ),
      store,
      dryRun: false,
    });

    expect(result.failed).toEqual([
      { ref: "acme/ops/first", reason: "the disk is full" },
    ]);
    expect(result.imported).toEqual(["acme/ops/second"]);
  });

  it("does not write permissions for a dashboard that failed to save", async () => {
    const setPermissions = vi.fn();
    const store: ServerDashboardStore = {
      ...createMemoryStore(),
      load: () => Promise.resolve(null),
      save: () => Promise.reject(new Error("refused")),
      setPermissions,
    };

    await importDashboards({
      source: sourceOf({
        ref: ref("fleet"),
        config: v2("Fleet"),
        assignments: [{ authorityId: "connie", role: "Editor" }],
      }),
      store,
      dryRun: false,
    });

    expect(setPermissions).not.toHaveBeenCalled();
  });

  it("does not overwrite a dashboard created between the check and the write", async () => {
    // The window the existence check cannot close. Another importer, or a
    // person, creates it after the load and before the save; expecting
    // revision zero turns that into a conflict rather than an overwrite of
    // work that is newer than the thing being imported.
    const inner = createMemoryStore();
    const store: ServerDashboardStore = {
      ...inner,
      load: async (r) => {
        const seen = await inner.load(r);
        if (seen === null) {
          // Someone else gets there first, right now.
          await inner.save(r, v2("Written by someone else"), {
            updatedBy: "erin",
          });
        }
        return seen;
      },
    };

    const result = await importDashboards({
      source: sourceOf({ ref: ref("fleet"), config: v2("From the import") }),
      store,
      dryRun: false,
    });

    expect(result.imported).toEqual([]);
    expect(result.failed).toHaveLength(1);
    await expect(inner.load(ref("fleet"))).resolves.toMatchObject({
      config: v2("Written by someone else"),
    });
  });

  it("reports progress per dashboard", async () => {
    const lines: Record<string, unknown>[] = [];
    await importDashboards({
      source: sourceOf(
        { ref: ref("fleet"), config: v2("Fleet") },
        { ref: ref("bad"), config: { version: 1 } },
      ),
      store: createMemoryStore(),
      onProgress: (line) => lines.push(line),
    });

    expect(lines.map((l) => l["msg"])).toEqual(["would import", "refused"]);
  });
});
