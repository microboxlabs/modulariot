/**
 * The SQLite backing, and the properties that only exist once a real database
 * is underneath: migrations, durability across a restart, and the document
 * bookkeeping the composite promises but cannot demonstrate on its own.
 *
 * Behaviour shared with every other store lives in `store-contract.test.ts`.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ServerDashboardStore } from "../seams/store";
import { createCompositeStore } from "./composite";
import { createSqlDocumentStore } from "./sql/documents";
import { createSqlMetadataStore } from "./sql/metadata";
import { MIGRATIONS, runMigrations } from "./sql/migrations";
import type { SqlDriver } from "./sql/driver";
import { createSqliteDriver } from "./sqlite-driver";
import { openSqliteStore, SQLITE_MEMORY } from "./sqlite";

const ref = { tenantId: "acme", scopeId: "ops", slug: "fleet" };
const config = { version: 2, name: "Fleet" };

const temporaryDirectories: string[] = [];
function temporaryDirectory(): string {
  const path = mkdtempSync(join(tmpdir(), "miot-store-"));
  temporaryDirectories.push(path);
  return path;
}

afterEach(() => {
  for (const path of temporaryDirectories.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

/**
 * The same assembly `openSqliteStore` performs, with the driver kept in hand.
 *
 * Tests below have to look at the tables the store is managing — how many
 * documents survive a rewrite, what a corrupted row does — and asserting on
 * that through the store's own interface would only prove the store agrees
 * with itself.
 */
async function assemble(): Promise<{
  driver: SqlDriver;
  store: ServerDashboardStore;
}> {
  const driver = createSqliteDriver({ path: SQLITE_MEMORY });
  await runMigrations(driver);
  const documents = createSqlDocumentStore(driver);
  const store = createCompositeStore({
    metadata: createSqlMetadataStore(driver),
    documents,
  });
  return { driver, store };
}

const documentCount = async (driver: SqlDriver): Promise<number> => {
  const rows = await driver.all<{ n: number }>(
    "SELECT COUNT(*) AS n FROM dashboard_documents",
  );
  return Number(rows[0]?.n ?? -1);
};

describe("migrations", () => {
  it("applies everything on a fresh database and nothing on the next open", async () => {
    const path = join(temporaryDirectory(), "dashboards.db");

    const first = await openSqliteStore({ path });
    expect(first.applied).toEqual(MIGRATIONS.map((m) => m.version));
    await first.close();

    const second = await openSqliteStore({ path });
    expect(second.applied).toEqual([]);
    await second.close();
  });

  it("creates the directory rather than failing on a missing one", async () => {
    // "unable to open database file" is all SQLite says about a missing
    // parent, which is a bad first five minutes for anyone.
    const path = join(temporaryDirectory(), "nested", "deeper", "dash.db");
    const opened = await openSqliteStore({ path });
    await opened.close();
  });
});

describe("durability", () => {
  it("still has the dashboard after the process would have restarted", async () => {
    const path = join(temporaryDirectory(), "dashboards.db");

    const first = await openSqliteStore({ path });
    await first.store.save(ref, config, { updatedBy: "ana" });
    await first.store.setPermissions(ref, [
      { authorityId: "bo", role: "Editor" },
    ]);
    await first.close();

    const second = await openSqliteStore({ path });
    const loaded = await second.store.load(ref);
    expect(loaded?.config).toEqual(config);
    expect(loaded?.revision).toBe(1);
    expect(loaded?.createdBy).toBe("ana");
    expect(await second.store.getPermissions(ref)).toEqual([
      { authorityId: "bo", role: "Editor" },
    ]);
    await second.close();
  });
});

describe("document bookkeeping", () => {
  it("keeps exactly one document per dashboard across rewrites", async () => {
    const { driver, store } = await assemble();
    try {
      for (let i = 0; i < 5; i++) {
        await store.save(ref, { ...config, i }, { updatedBy: "ana" });
      }
      // Every save writes a new key and then collects the one it replaced.
      // Without that, an inline deployment's database grows with every edit.
      expect(await documentCount(driver)).toBe(1);
    } finally {
      await driver.close();
    }
  });

  it("collects the document of a write that lost the race", async () => {
    const { driver, store } = await assemble();
    try {
      await store.save(ref, config, { updatedBy: "ana" });
      await expect(
        store.save(ref, config, { updatedBy: "bo", expectedRevision: 99 }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      // The loser uploaded before it knew it had lost; nothing points at that
      // document, so it must not be left behind.
      expect(await documentCount(driver)).toBe(1);
    } finally {
      await driver.close();
    }
  });

  it("collects the document when the dashboard is deleted", async () => {
    const { driver, store } = await assemble();
    try {
      await store.save(ref, config, { updatedBy: "ana" });
      await store.remove(ref);
      expect(await documentCount(driver)).toBe(0);
    } finally {
      await driver.close();
    }
  });

  it("puts no caller-supplied text in the document key", async () => {
    const { driver, store } = await assemble();
    try {
      // A slug is host-defined and reaches us decoded, so this one is legal as
      // far as this package is concerned. It must not become a path.
      const hostile = {
        tenantId: "acme",
        scopeId: "../../..",
        slug: "../../etc/passwd",
      };
      await store.save(hostile, config, { updatedBy: "ana" });
      const rows = await driver.all<{ document_key: string }>(
        "SELECT document_key FROM dashboards",
      );
      const key = rows[0]?.document_key ?? "";
      expect(key).toMatch(/^acme\/[0-9a-f-]{36}\.json$/);
      expect(key).not.toContain("..");
    } finally {
      await driver.close();
    }
  });

  it("says so when a row points at a document that is gone", async () => {
    const { driver, store } = await assemble();
    try {
      await store.save(ref, config, { updatedBy: "ana" });
      await driver.all("DELETE FROM dashboard_documents");
      // Not `null`: reporting an empty dashboard would invite the next save to
      // overwrite a revision whose content might still be recoverable.
      await expect(store.load(ref)).rejects.toMatchObject({
        code: "INTERNAL_ERROR",
      });
    } finally {
      await driver.close();
    }
  });
});

describe("permissions in SQL", () => {
  it("drops a role this build does not recognize", async () => {
    const { driver, store } = await assemble();
    try {
      await store.save(ref, config, { updatedBy: "ana" });
      await driver.all(
        `INSERT INTO dashboard_permissions
           (tenant_id, scope_id, slug, authority_id, role)
         VALUES (?, ?, ?, ?, ?)`,
        [ref.tenantId, ref.scopeId, ref.slug, "mallory", "Superuser"],
      );
      // Dropping narrows access; passing it through would widen it, and only
      // one of those is safe to get wrong.
      expect(await store.getPermissions(ref)).toEqual([]);
    } finally {
      await driver.close();
    }
  });

  it("takes the last assignment for a repeated authority", async () => {
    const { driver, store } = await assemble();
    try {
      await store.save(ref, config, { updatedBy: "ana" });
      // The primary key would reject this batch outright, turning a duplicated
      // id in a request into a 500.
      await store.setPermissions(ref, [
        { authorityId: "bo", role: "Consumer" },
        { authorityId: "bo", role: "Coordinator" },
      ]);
      expect(await store.getPermissions(ref)).toEqual([
        { authorityId: "bo", role: "Coordinator" },
      ]);
    } finally {
      await driver.close();
    }
  });
});

describe("the driver", () => {
  it("rolls back a transaction that threw", async () => {
    const driver = createSqliteDriver({ path: SQLITE_MEMORY });
    try {
      await runMigrations(driver);
      await expect(
        driver.transaction(async () => {
          await driver.all(
            `INSERT INTO dashboard_documents (document_key, body)
             VALUES (?, ?)`,
            ["k", "{}"],
          );
          throw new Error("half way");
        }),
      ).rejects.toThrow("half way");
      expect(await documentCount(driver)).toBe(0);
    } finally {
      await driver.close();
    }
  });

  it("lets a nested transaction join the one already open", async () => {
    const driver = createSqliteDriver({ path: SQLITE_MEMORY });
    try {
      await runMigrations(driver);
      // SQLite rejects a second BEGIN outright, so `remove` — which opens one
      // — would fail the moment anything wrapped it in another.
      await driver.transaction(() =>
        driver.transaction(() =>
          driver.all(
            `INSERT INTO dashboard_documents (document_key, body)
             VALUES (?, ?)`,
            ["k", "{}"],
          ),
        ),
      );
      expect(await documentCount(driver)).toBe(1);
    } finally {
      await driver.close();
    }
  });
});
