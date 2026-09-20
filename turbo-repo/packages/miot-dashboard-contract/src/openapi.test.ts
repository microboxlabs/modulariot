/**
 * The OpenAPI document and the TypeScript definitions describe one contract.
 *
 * They are written by hand in two languages, so nothing but a test stops them
 * drifting — and a drift here is not cosmetic. A client generated from the
 * document would accept a role the server rejects, or fail to handle an error
 * code the server can send.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { DASHBOARD_ROLES, type DashboardCapabilities } from "./roles";
import { type DashboardErrorCode, type ForbiddenReason } from "./errors";

const SPEC_URL = new URL("../contract/openapi.yaml", import.meta.url);
const ARTIFACT_URL = new URL(
  "../contract/dashboard-config.schema.json",
  import.meta.url,
);

interface SchemaNode {
  type?: unknown;
  enum?: string[];
  properties?: Record<string, SchemaNode>;
  required?: string[];
  oneOf?: { $ref?: string; type?: string }[];
}

const spec = parse(readFileSync(SPEC_URL, "utf8")) as {
  components: { schemas: Record<string, SchemaNode> };
  paths: Record<string, unknown>;
};

/**
 * Listed rather than derived, so that widening a union in TypeScript without
 * touching the document fails here. `satisfies` keeps the list exhaustive.
 */
const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "BAD_REQUEST",
  "CONFLICT",
  "PAYLOAD_TOO_LARGE",
  "UPSTREAM_ERROR",
  "INTERNAL_ERROR",
] as const satisfies readonly DashboardErrorCode[];

const FORBIDDEN_REASONS = [
  "TENANT_SCOPE",
  "EMBED_SCOPE",
  "CAPABILITY",
] as const satisfies readonly ForbiddenReason[];

const CAPABILITY_KEYS = [
  "readOnly",
  "canEdit",
  "canShare",
  "canManagePermissions",
  "canDelete",
] as const satisfies readonly (keyof DashboardCapabilities)[];

describe("the OpenAPI document", () => {
  it("describes the same roles as the role vocabulary", () => {
    expect(spec.components.schemas.Role?.enum).toEqual([...DASHBOARD_ROLES]);
  });

  it("describes the same error codes", () => {
    expect(spec.components.schemas.Error?.properties?.code?.enum).toEqual([
      ...ERROR_CODES,
    ]);
  });

  it("describes the same 403 reasons", () => {
    expect(spec.components.schemas.Error?.properties?.reason?.enum).toEqual([
      ...FORBIDDEN_REASONS,
    ]);
  });

  it("describes the same capabilities, all of them required", () => {
    const capabilities = spec.components.schemas.Capabilities;
    expect(Object.keys(capabilities?.properties ?? {})).toEqual([
      ...CAPABILITY_KEYS,
    ]);
    // Optional here would let an implementation omit one, and a client reading
    // `canEdit === undefined` as falsy would hide an affordance the caller has.
    expect([...(capabilities?.required ?? [])].sort()).toEqual(
      [...CAPABILITY_KEYS].sort(),
    );
  });

  /**
   * The document does not restate the dashboard document; it points at the
   * generated artifact. The reference is relative and unqualified so that it
   * resolves both on disk and over HTTP, where the server serves the two files
   * as siblings — which only works while they stay siblings.
   */
  it("refers to the document schema rather than describing it again", () => {
    const reference = spec.components.schemas.DashboardConfig?.oneOf?.find(
      (member) => member.$ref !== undefined,
    );
    expect(reference?.$ref).toBe(
      "dashboard-config.schema.json#/definitions/DashboardConfig",
    );
  });

  it("points that reference at something that exists", () => {
    const [file, pointer] =
      "dashboard-config.schema.json#/definitions/DashboardConfig".split("#");
    expect(new URL(file ?? "", SPEC_URL).pathname).toBe(ARTIFACT_URL.pathname);
    const artifact = JSON.parse(readFileSync(ARTIFACT_URL, "utf8")) as Record<
      string,
      unknown
    >;
    const resolved = (pointer ?? "")
      .split("/")
      .filter((segment) => segment !== "")
      .reduce<unknown>(
        (node, segment) =>
          typeof node === "object" && node !== null
            ? (node as Record<string, unknown>)[segment]
            : undefined,
        artifact,
      );
    expect(resolved).toBeTypeOf("object");
  });

  it("still allows a slug that has never been saved to answer null", () => {
    const members = spec.components.schemas.DashboardConfig?.oneOf ?? [];
    expect(members.some((member) => member.type === "null")).toBe(true);
  });
});
