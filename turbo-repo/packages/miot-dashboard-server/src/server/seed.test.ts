/**
 * Seeding a persistent store, which happens through `save` rather than at
 * construction. The two paths have to produce the same dashboards.
 */

import { describe, expect, it } from "vitest";
import { openSqliteStore, SQLITE_MEMORY } from "../store/sqlite";
import { createMemoryStore, type SeedDashboard } from "../testing";
import { seedDashboards } from "./seed";

const SEED: SeedDashboard[] = [
  {
    ref: { tenantId: "acme", scopeId: "ops", slug: "fleet" },
    record: {
      config: { version: 2, name: "Fleet overview" },
      createdBy: "carl",
    },
    assignments: [{ authorityId: "connie", role: "Editor" }],
  },
  {
    ref: { tenantId: "acme", scopeId: "ops", slug: "spares" },
    record: { config: { version: 2 } },
  },
];

describe("seeding a persistent store", () => {
  it("keeps the creator the seed named", async () => {
    const opened = await openSqliteStore({ path: SQLITE_MEMORY });
    try {
      await seedDashboards(opened.store, SEED);
      // The capability policy reads createdBy to decide whether a Contributor
      // may edit. Seeding through `save` with only updatedBy set made every
      // seeded dashboard belong to "seed" instead.
      const loaded = await opened.store.load(SEED[0]!.ref);
      expect(loaded?.createdBy).toBe("carl");
    } finally {
      await opened.close();
    }
  });

  it("carries the permission assignments", async () => {
    const opened = await openSqliteStore({ path: SQLITE_MEMORY });
    try {
      await seedDashboards(opened.store, SEED);
      expect(await opened.store.getPermissions(SEED[0]!.ref)).toEqual([
        { authorityId: "connie", role: "Editor" },
      ]);
    } finally {
      await opened.close();
    }
  });

  it("lists the same names as the in-memory store given the same seed", async () => {
    const opened = await openSqliteStore({ path: SQLITE_MEMORY });
    try {
      await seedDashboards(opened.store, SEED);
      const memory = createMemoryStore({ seed: SEED });
      expect(await opened.store.list("acme", "ops")).toEqual(
        await memory.list("acme", "ops"),
      );
    } finally {
      await opened.close();
    }
  });

  it("does not overwrite a dashboard that already exists", async () => {
    const opened = await openSqliteStore({ path: SQLITE_MEMORY });
    try {
      await seedDashboards(opened.store, SEED);
      await opened.store.save(
        SEED[0]!.ref,
        { version: 2, name: "Edited since" },
        { updatedBy: "ana" },
      );

      // A second start must not undo that.
      const written = await seedDashboards(opened.store, SEED);
      expect(written).toEqual([]);
      expect((await opened.store.load(SEED[0]!.ref))?.config).toEqual({
        version: 2,
        name: "Edited since",
      });
    } finally {
      await opened.close();
    }
  });
});
