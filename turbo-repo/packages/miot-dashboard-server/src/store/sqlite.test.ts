/**
 * Behaviour that needs a real database: migrations, data surviving a restart,
 * and the document rows the composite store creates and deletes. Behaviour
 * shared with the in-memory store is in `store-contract.test.ts`.
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
import { SQLITE_DIALECT, type SqlDriver } from "./sql/driver";
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
 * The same wiring as `openSqliteStore`, but returning the driver as well: these
 * tests query the tables directly rather than through the store.
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

  it("closes the database even when the document store will not", async () => {
    let closedDocuments = false;
    const opened = await openSqliteStore({
      path: SQLITE_MEMORY,
      documents: {
        put: () => Promise.resolve(),
        get: () => Promise.resolve(null),
        delete: () => Promise.resolve(),
        close: () => {
          closedDocuments = true;
          return Promise.reject(new Error("bucket client hung"));
        },
      },
    });

    await expect(opened.close()).rejects.toThrow("bucket client hung");
    expect(closedDocuments).toBe(true);
    // The database has to be closed even so, or a caller that keeps running
    // after a failed shutdown holds the handle forever.
    await expect(opened.store.list("acme", "ops")).rejects.toThrow();
  });

  it("creates the directory rather than failing on a missing one", async () => {
    const path = join(temporaryDirectory(), "nested", "deeper", "dash.db");
    const opened = await openSqliteStore({ path });
    await opened.close();
  });
});

describe("two processes starting at once", () => {
  it("reads the applied versions inside the transaction", async () => {
    // Two processes starting together both read `schema_migrations` before
    // either writes, both decide version 1 is missing, and the second runs
    // CREATE TABLE on a table that now exists. One process cannot reproduce
    // that with a synchronous driver, so this asserts the ordering that
    // prevents it: nothing is read before the transaction opens.
    const calls: string[] = [];
    const driver: SqlDriver = {
      dialect: SQLITE_DIALECT,
      exec: (sql) => {
        calls.push(`exec:${sql.slice(0, 24)}`);
        return Promise.resolve();
      },
      all: <T>(sql: string) => {
        calls.push(sql.includes("SELECT version") ? "read" : "write");
        return Promise.resolve([] as T[]);
      },
      transaction: async (body) => {
        calls.push("begin");
        const result = await body();
        calls.push("commit");
        return result;
      },
      close: () => Promise.resolve(),
    };

    await runMigrations(driver);
    expect(calls.indexOf("begin")).toBeLessThan(calls.indexOf("read"));
    expect(calls.indexOf("read")).toBeLessThan(calls.indexOf("commit"));
  });

  it("applies the schema once across separate connections", async () => {
    const path = join(temporaryDirectory(), "dashboards.db");
    const first = createSqliteDriver({ path });
    const second = createSqliteDriver({ path });
    try {
      expect(await runMigrations(first)).toEqual(
        MIGRATIONS.map((m) => m.version),
      );
      // Reading the applied versions outside a transaction let this connection
      // decide the same migrations were missing and run CREATE TABLE again.
      expect(await runMigrations(second)).toEqual([]);
    } finally {
      await first.close();
      await second.close();
    }
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
      // Without the delete, the table grows on every edit.
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
      // The rejected save had already written its document.
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
      // Slugs are host-defined and arrive decoded, so this one is valid. It
      // must not become part of a filesystem path.
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

  it("escapes a tenant id that is itself a path segment", async () => {
    const { driver, store } = await assemble();
    try {
      // encodeURIComponent does not touch ".", so ".." survived it intact and
      // the key began "../". Tenant ids are host-defined strings.
      await store.save(
        { tenantId: "..", scopeId: "ops", slug: "fleet" },
        config,
        { updatedBy: "ana" },
      );
      const rows = await driver.all<{ document_key: string }>(
        "SELECT document_key FROM dashboards",
      );
      const key = rows[0]?.document_key ?? "";
      expect(key).not.toContain("..");
      expect(key.startsWith("../")).toBe(false);
      expect(key).toMatch(/^%2E%2E\/[0-9a-f-]{36}\.json$/);
    } finally {
      await driver.close();
    }
  });

  it("says so when a row points at a document that is gone", async () => {
    const { driver, store } = await assemble();
    try {
      await store.save(ref, config, { updatedBy: "ana" });
      await driver.all("DELETE FROM dashboard_documents");
      // Not `null`, which would let the next save overwrite a revision whose
      // document may still be recoverable.
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
      expect(await store.getPermissions(ref)).toEqual([]);
    } finally {
      await driver.close();
    }
  });

  it("takes the last assignment for a repeated authority", async () => {
    const { driver, store } = await assemble();
    try {
      await store.save(ref, config, { updatedBy: "ana" });
      // The primary key would otherwise reject the batch.
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

describe("permissions and deletion", () => {
  it("refuses to write permissions for a dashboard that is gone", async () => {
    const { driver, store } = await assemble();
    try {
      await store.save(ref, config, { updatedBy: "ana" });
      await store.remove(ref);
      // A caller authorized against the dashboard a moment earlier. Writing
      // the assignments anyway leaves rows that a dashboard recreated at the
      // same address would inherit.
      await expect(
        store.setPermissions(ref, [{ authorityId: "bo", role: "Coordinator" }]),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      const rows = await driver.all<{ n: number }>(
        "SELECT COUNT(*) AS n FROM dashboard_permissions",
      );
      expect(Number(rows[0]?.n)).toBe(0);
    } finally {
      await driver.close();
    }
  });

  it("rejects a permission row for a dashboard that does not exist", async () => {
    const { driver } = await assemble();
    try {
      // The foreign key, not the read above it: PostgreSQL readers do not
      // block, so the constraint is what holds when the check races a delete.
      await expect(
        driver.all(
          `INSERT INTO dashboard_permissions
             (tenant_id, scope_id, slug, authority_id, role)
           VALUES (?, ?, ?, ?, ?)`,
          ["acme", "ops", "never-existed", "bo", "Editor"],
        ),
      ).rejects.toThrow();
    } finally {
      await driver.close();
    }
  });

  it("takes a dashboard's permissions with it when it is deleted", async () => {
    const { driver, store } = await assemble();
    try {
      await store.save(ref, config, { updatedBy: "ana" });
      await store.setPermissions(ref, [
        { authorityId: "bo", role: "Coordinator" },
      ]);
      await store.remove(ref);
      await store.save(ref, config, { updatedBy: "ana" });
      // Recreating the same address must not inherit the old assignments.
      expect(await store.getPermissions(ref)).toEqual([]);
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
      // `remove` opens a transaction, so it must work inside another one.
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
