/**
 * These cases are the app's existing rule, restated. The strangle is only
 * safe if this behaves identically, so each one is written against what the
 * app does today rather than what seems reasonable.
 */

import { describe, expect, it } from "vitest";
import {
  createAllowedGroupsPolicy,
  parseAllowedGroups,
} from "./allowed-groups";
import type { CapabilityContext, CapabilityPolicy } from "./capabilities";
import { FULL_CAPABILITIES } from "./roles";
import type { DashboardIdentity } from "../seams/identity";
import type { DashboardRecord } from "../seams/store";

const identity = (groups?: string[]): DashboardIdentity => ({
  userId: "ana",
  kind: "user",
  tenantId: "acme",
  capabilities: FULL_CAPABILITIES,
  ...(groups === undefined ? {} : { groups }),
});

const record = (config: unknown): DashboardRecord => ({
  config,
  updatedAt: "2026-01-01T00:00:00.000Z",
  updatedBy: "ana",
  revision: 1,
});

const context = (config: unknown, groups?: string[]): CapabilityContext => ({
  identity: identity(groups),
  ref: { tenantId: "acme", scopeId: "ops", slug: "fleet" },
  scopeRole: "Editor",
  assignments: [],
  record: config === undefined ? null : record(config),
});

/** Distinguishable from the real policy, so "delegated" is visible. */
const inner: CapabilityPolicy = { resolve: () => FULL_CAPABILITIES };
const policy = createAllowedGroupsPolicy(inner);

describe("parseAllowedGroups", () => {
  it("treats an absent or null list as no restriction", () => {
    for (const value of [undefined, null]) {
      expect(parseAllowedGroups(value)).toEqual({
        valid: true,
        groups: undefined,
      });
    }
  });

  it("takes a list of strings, including an empty one", () => {
    expect(parseAllowedGroups([])).toEqual({ valid: true, groups: [] });
    expect(parseAllowedGroups(["a", "b"])).toEqual({
      valid: true,
      groups: ["a", "b"],
    });
  });

  it.each([["a string"], [42], [{ group: "a" }], [["a", 1]], [[null]]])(
    "refuses %s as malformed",
    (value) => {
      expect(parseAllowedGroups(value)).toEqual({ valid: false });
    },
  );
});

describe("createAllowedGroupsPolicy", () => {
  it("delegates when the config names no audience", async () => {
    expect(await policy.resolve(context({ version: 2 }))).toBe(
      FULL_CAPABILITIES,
    );
  });

  it("delegates when the audience is an empty list", async () => {
    expect(await policy.resolve(context({ allowedGroups: [] }))).toBe(
      FULL_CAPABILITIES,
    );
  });

  it("delegates when the caller holds one of the named groups", async () => {
    const decision = await policy.resolve(
      context({ allowedGroups: ["fleet-team", "ops"] }, ["ops", "other"]),
    );
    expect(decision).toBe(FULL_CAPABILITIES);
  });

  it("denies when the caller holds none of them", async () => {
    const decision = await policy.resolve(
      context({ allowedGroups: ["fleet-team"] }, ["other"]),
    );
    expect(decision).toBeNull();
  });

  it("denies when the caller has no groups at all", async () => {
    expect(
      await policy.resolve(context({ allowedGroups: ["fleet-team"] })),
    ).toBeNull();
  });

  it("denies a malformed audience rather than reading it as open", async () => {
    // The case that matters: something wrote a shape nobody expected, and
    // treating that as "no restriction" publishes a dashboard meant to be
    // restricted — a failure invisible from the outside.
    for (const bad of ["everyone", 1, { a: 1 }, ["ok", 2]]) {
      expect(await policy.resolve(context({ allowedGroups: bad }))).toBeNull();
    }
  });

  it("leaves a dashboard that does not exist yet to the policy underneath", async () => {
    // A first save has no stored audience to enforce.
    expect(await policy.resolve(context(undefined))).toBe(FULL_CAPABILITIES);
  });

  it("does not read an audience out of a config that is not an object", async () => {
    expect(await policy.resolve(context("not an object"))).toBe(
      FULL_CAPABILITIES,
    );
  });

  it("never grants past the policy it wraps", async () => {
    const denying: CapabilityPolicy = { resolve: () => null };
    const wrapped = createAllowedGroupsPolicy(denying);
    expect(
      await wrapped.resolve(context({ allowedGroups: ["ops"] }, ["ops"])),
    ).toBeNull();
  });
});
