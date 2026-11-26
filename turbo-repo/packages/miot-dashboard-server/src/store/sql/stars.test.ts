import { afterEach, describe, expect, it } from "vitest";
import { openSqliteStore, SQLITE_MEMORY, type OpenedStore } from "../sqlite";
import { createSqlStarStore } from "./stars";

const scope = { tenantId: "acme", scopeId: "ops" };
const other = { tenantId: "acme", scopeId: "sales" };

let opened: OpenedStore | null = null;

afterEach(async () => {
  await opened?.close();
  opened = null;
});

async function setup() {
  opened = await openSqliteStore({ path: SQLITE_MEMORY });
  return createSqlStarStore(opened.driver);
}

describe("SQL star store", () => {
  it("keeps each member's stars apart, per scope", async () => {
    const stars = await setup();
    await stars.star(scope, "ana", "fleet");
    await stars.star(scope, "ana", "alerts");
    await stars.star(scope, "bo", "fleet");
    await stars.star(other, "ana", "sales");

    expect(await stars.list(scope, "ana")).toEqual(["alerts", "fleet"]);
    expect(await stars.list(scope, "bo")).toEqual(["fleet"]);
    expect(await stars.list(other, "ana")).toEqual(["sales"]);
  });

  it("stars and unstars idempotently", async () => {
    const stars = await setup();
    await stars.star(scope, "ana", "fleet");
    await stars.star(scope, "ana", "fleet");
    expect(await stars.list(scope, "ana")).toEqual(["fleet"]);
    await stars.unstar(scope, "ana", "fleet");
    await stars.unstar(scope, "ana", "fleet");
    expect(await stars.list(scope, "ana")).toEqual([]);
  });

  it("forgets every member's star on a deleted dashboard", async () => {
    const stars = await setup();
    await stars.star(scope, "ana", "fleet");
    await stars.star(scope, "bo", "fleet");
    await stars.star(scope, "bo", "alerts");
    await stars.forget(scope, "fleet");
    expect(await stars.list(scope, "ana")).toEqual([]);
    expect(await stars.list(scope, "bo")).toEqual(["alerts"]);
  });
});
