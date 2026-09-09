/**
 * The pool wiring, against a fake `pg` pool.
 *
 * What is worth testing here is not the SQL — `store-contract.test.ts` runs
 * that against a real engine — but which connection each statement lands on.
 * A transaction whose statements leak onto other pooled connections still
 * passes every single-threaded test and loses writes in production.
 */

import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { createPostgresDriver } from "./postgres-driver";

/** True where the optional peer is actually installed. */
const pgInstalled = ((): boolean => {
  try {
    createRequire(import.meta.url).resolve("pg");
    return true;
  } catch {
    return false;
  }
})();

interface Issued {
  client: number;
  sql: string;
  params: readonly unknown[];
}

/** A pool that hands out numbered clients and records what ran on each. */
function fakePool(options: { rollbackThrows?: boolean } = {}) {
  const issued: Issued[] = [];
  const released: { client: number; destroyed: boolean }[] = [];
  let clients = 0;
  let ended = false;

  const query =
    (client: number) => (sql: string, params?: readonly unknown[]) => {
      issued.push({ client, sql, params: params ?? [] });
      if (options.rollbackThrows === true && sql === "ROLLBACK") {
        return Promise.reject(new Error("connection lost"));
      }
      return Promise.resolve({ rows: [] as unknown[] });
    };

  return {
    issued,
    released,
    clientCount: () => clients,
    ended: () => ended,
    pool: {
      connect: () => {
        const client = ++clients;
        return Promise.resolve({
          query: query(client),
          release: (destroy?: boolean) =>
            released.push({ client, destroyed: destroy === true }),
        });
      },
      // Client 0 is the pool itself: a statement outside any transaction.
      query: query(0),
      end: () => {
        ended = true;
        return Promise.resolve();
      },
    },
  };
}

const open = (fake: ReturnType<typeof fakePool>) =>
  createPostgresDriver({ url: "postgres://ignored", poolImpl: fake.pool });

describe("createPostgresDriver", () => {
  it("runs a statement outside a transaction on the pool", async () => {
    const fake = fakePool();
    await open(fake).all("SELECT 1", ["a"]);
    expect(fake.issued).toEqual([
      { client: 0, sql: "SELECT 1", params: ["a"] },
    ]);
    expect(fake.clientCount()).toBe(0);
  });

  it("runs every statement of a transaction on one checked-out client", async () => {
    const fake = fakePool();
    const driver = open(fake);
    await driver.transaction(async () => {
      await driver.all("INSERT ONE");
      await driver.all("INSERT TWO");
    });
    expect(fake.issued.map((i) => [i.client, i.sql])).toEqual([
      [1, "BEGIN"],
      [1, "INSERT ONE"],
      [1, "INSERT TWO"],
      [1, "COMMIT"],
    ]);
  });

  it("keeps two overlapping transactions on separate clients", async () => {
    const fake = fakePool();
    const driver = open(fake);
    let releaseFirst!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = driver.transaction(async () => {
      await driver.all("FIRST");
      await gate;
    });
    const second = driver.transaction(async () => {
      await driver.all("SECOND");
    });
    await second;
    releaseFirst();
    await first;

    const client = (sql: string) =>
      fake.issued.find((i) => i.sql === sql)?.client;
    expect(client("FIRST")).not.toBe(client("SECOND"));
  });

  it("rolls back and rethrows the original error", async () => {
    const fake = fakePool();
    const driver = open(fake);
    await expect(
      driver.transaction(async () => {
        await driver.all("INSERT ONE");
        throw new Error("the row was rejected");
      }),
    ).rejects.toThrow("the row was rejected");

    expect(fake.issued.map((i) => i.sql)).toEqual([
      "BEGIN",
      "INSERT ONE",
      "ROLLBACK",
    ]);
    expect(fake.released).toEqual([{ client: 1, destroyed: false }]);
  });

  it("destroys the connection when the rollback itself fails", async () => {
    // The transaction is still open on that connection. Returned to the pool
    // it would be handed to the next caller mid-transaction.
    const fake = fakePool({ rollbackThrows: true });
    const driver = open(fake);
    await expect(
      driver.transaction(() => Promise.reject(new Error("the first failure"))),
    ).rejects.toThrow("the first failure");
    expect(fake.released).toEqual([{ client: 1, destroyed: true }]);
  });

  it("joins a transaction already open rather than opening a second", async () => {
    const fake = fakePool();
    const driver = open(fake);
    await driver.transaction(() =>
      driver.transaction(() => driver.all("INNER")),
    );
    expect(fake.issued.filter((i) => i.sql === "BEGIN")).toHaveLength(1);
    expect(fake.issued.filter((i) => i.sql === "COMMIT")).toHaveLength(1);
    expect(fake.clientCount()).toBe(1);
  });

  it("ends the pool on close", async () => {
    const fake = fakePool();
    await open(fake).close();
    expect(fake.ended()).toBe(true);
  });

  // Skipped rather than inverted where the peer is present: the message is
  // what someone sees when it is missing, and there is nothing to assert
  // about it on a machine that has it.
  it.skipIf(pgInstalled)("reports a usable error when pg is absent", () => {
    expect(() => createPostgresDriver({ url: "postgres://host/db" })).toThrow(
      /optional peer dependency and is not installed/,
    );
  });
});
