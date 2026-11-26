import { afterEach, describe, expect, it } from "vitest";
import { openSqliteStore, SQLITE_MEMORY, type OpenedStore } from "../sqlite";
import { createSqlRecentStore } from "./recents";

const scope = { tenantId: "acme", scopeId: "ops" };
const other = { tenantId: "acme", scopeId: "sales" };

let opened: OpenedStore | null = null;

afterEach(async () => {
  await opened?.close();
  opened = null;
});

async function setup() {
  opened = await openSqliteStore({ path: SQLITE_MEMORY });
  let tick = Date.parse("2026-11-23T12:00:00Z");
  return createSqlRecentStore(opened.driver, {
    now: () => new Date((tick += 1000)),
  });
}

const slugs = (opens: { slug: string }[]) => opens.map((open) => open.slug);

describe("SQL recent store", () => {
  it("keeps each member's opens apart, per scope, newest first", async () => {
    const recents = await setup();
    await recents.record(scope, "ana", "fleet");
    await recents.record(scope, "ana", "alerts");
    await recents.record(scope, "bo", "fleet");
    await recents.record(other, "ana", "sales");

    expect(slugs(await recents.list(scope, "ana", 10))).toEqual([
      "alerts",
      "fleet",
    ]);
    expect(slugs(await recents.list(scope, "bo", 10))).toEqual(["fleet"]);
    expect(slugs(await recents.list(other, "ana", 10))).toEqual(["sales"]);
  });

  it("moves a dashboard opened again to the front, and keeps one row", async () => {
    const recents = await setup();
    await recents.record(scope, "ana", "fleet");
    await recents.record(scope, "ana", "alerts");
    await recents.record(scope, "ana", "fleet");
    const listed = await recents.list(scope, "ana", 10);
    expect(slugs(listed)).toEqual(["fleet", "alerts"]);
    expect(listed[0]!.openedAt).toBe("2026-11-23T12:00:03.000Z");
  });

  it("returns at most the limit", async () => {
    const recents = await setup();
    for (const slug of ["a", "b", "c"])
      await recents.record(scope, "ana", slug);
    expect(slugs(await recents.list(scope, "ana", 2))).toEqual(["c", "b"]);
  });

  it("keeps the latest time when opens arrive out of order", async () => {
    await setup();
    let time = new Date("2026-11-23T12:00:02Z");
    const recents = createSqlRecentStore(opened!.driver, { now: () => time });
    await recents.record(scope, "ana", "fleet");
    time = new Date("2026-11-23T12:00:01Z");
    await recents.record(scope, "ana", "fleet");
    expect(await recents.list(scope, "ana", 10)).toEqual([
      { slug: "fleet", openedAt: "2026-11-23T12:00:02.000Z" },
    ]);
  });

  it("forgets every member's open of a deleted dashboard", async () => {
    const recents = await setup();
    await recents.record(scope, "ana", "fleet");
    await recents.record(scope, "bo", "fleet");
    await recents.record(scope, "bo", "alerts");
    await recents.forget(scope, "fleet");
    expect(await recents.list(scope, "ana", 10)).toEqual([]);
    expect(slugs(await recents.list(scope, "bo", 10))).toEqual(["alerts"]);
  });
});
