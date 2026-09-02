/**
 * Tests for the test doubles.
 *
 * Unusual, and earned: `memoryStore` shipped with a `list` that returned the
 * third character of its map key instead of the slug, and a key built by
 * concatenating tenant, scope and slug with no separator at all. Neither
 * showed up, because the access-control suite never calls `list` and the
 * seeded ids happened not to collide.
 *
 * A wrong store double produces a green suite for a broken service, so the
 * double gets its own assertions before P2 builds persistence on top of it.
 */

import { describe, expect, it } from "vitest";
import type { ServerDashboardRef } from "../seams/store";
import { memoryStore } from "./fixtures";

const ref = (
  tenantId: string,
  scopeId: string,
  slug: string,
): ServerDashboardRef => ({ tenantId, scopeId, slug });

describe("memoryStore", () => {
  it("lists real slugs, not fragments of the storage key", async () => {
    const store = memoryStore([
      { ref: ref("acme", "ops", "fleet") },
      { ref: ref("acme", "ops", "maintenance"), name: "Maintenance" },
    ]);

    await expect(store.list("acme", "ops")).resolves.toEqual([
      { slug: "fleet", name: "fleet" },
      { slug: "maintenance", name: "Maintenance" },
    ]);
  });

  it("scopes list by tenant and scope", async () => {
    const store = memoryStore([
      { ref: ref("acme", "ops", "fleet") },
      { ref: ref("globex", "ops", "fleet") },
      { ref: ref("acme", "finance", "spend") },
    ]);

    await expect(store.list("acme", "ops")).resolves.toEqual([
      { slug: "fleet", name: "fleet" },
    ]);
    await expect(store.list("globex", "ops")).resolves.toEqual([
      { slug: "fleet", name: "fleet" },
    ]);
    await expect(store.list("acme", "no-such-scope")).resolves.toEqual([]);
  });

  it("keeps references distinct when their parts concatenate to the same string", async () => {
    // "ac"+"meops"+"fleet" and "acme"+"ops"+"fleet" are the same 13 characters.
    // A separator-free key would make these one entry.
    const collide = ref("ac", "meops", "fleet");
    const real = ref("acme", "ops", "fleet");
    const store = memoryStore([
      { ref: collide, record: { updatedBy: "collide" } },
      { ref: real, record: { updatedBy: "real" } },
    ]);

    await expect(store.load(collide)).resolves.toMatchObject({
      updatedBy: "collide",
    });
    await expect(store.load(real)).resolves.toMatchObject({
      updatedBy: "real",
    });
  });

  it("separates entries whose ids contain the characters a key might join on", async () => {
    const slashed = ref("ac/me", "ops", "fleet");
    const spaced = ref("ac me", "ops", "fleet");
    const store = memoryStore([
      { ref: slashed, record: { updatedBy: "slashed" } },
      { ref: spaced, record: { updatedBy: "spaced" } },
    ]);

    await expect(store.load(slashed)).resolves.toMatchObject({
      updatedBy: "slashed",
    });
    await expect(store.load(spaced)).resolves.toMatchObject({
      updatedBy: "spaced",
    });
    await expect(store.load(ref("acme", "ops", "fleet"))).resolves.toBeNull();
  });

  it("returns null and empty permissions for an unseeded reference", async () => {
    const store = memoryStore([{ ref: ref("acme", "ops", "fleet") }]);
    await expect(store.load(ref("acme", "ops", "other"))).resolves.toBeNull();
    await expect(
      store.getPermissions(ref("acme", "ops", "other")),
    ).resolves.toEqual([]);
  });

  it("reports whether anything reached it", async () => {
    const store = memoryStore([{ ref: ref("acme", "ops", "fleet") }]);
    expect(store.touched()).toBe(false);
    await store.load(ref("acme", "ops", "fleet"));
    expect(store.touched()).toBe(true);
  });

  describe("hands back copies, never its own state", () => {
    // This store is published for integrators and dev servers, not only for
    // our tests. A caller holding a reference into the Map can rewrite history
    // — and a real store, which decodes rows, would never let them. Aliases
    // here would let the suite pass against behaviour Postgres cannot
    // reproduce.
    const target = ref("acme", "ops", "fleet");

    it("does not let a mutated load() move the revision counter", async () => {
      const store = memoryStore([{ ref: target }]);
      const loaded = await store.load(target);
      const stored = loaded?.revision;
      expect(stored).toBeTypeOf("number");

      // Exactly the mutation that would break optimistic concurrency: bump
      // the counter under the store and every later If-Match is judged
      // against a number nobody wrote.
      (loaded as { revision: number }).revision = 99;

      await expect(store.load(target)).resolves.toMatchObject({
        revision: stored,
      });
    });

    it("does not let a mutated save() result move it either", async () => {
      const store = memoryStore([{ ref: target }]);
      const saved = await store.save(target, { v: 1 }, { updatedBy: "alice" });
      const written = saved.revision;
      (saved as { revision: number }).revision = 99;

      await expect(store.load(target)).resolves.toMatchObject({
        revision: written,
      });
    });

    it("does not let a pushed getPermissions() grant a role", async () => {
      const store = memoryStore([
        {
          ref: target,
          assignments: [{ authorityId: "alice", role: "Editor" }],
        },
      ]);
      const assignments = await store.getPermissions(target);
      assignments.push({ authorityId: "mallory", role: "Coordinator" });

      await expect(store.getPermissions(target)).resolves.toEqual([
        { authorityId: "alice", role: "Editor" },
      ]);
    });
  });
});
