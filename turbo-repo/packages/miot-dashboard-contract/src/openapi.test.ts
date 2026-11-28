/**
 * The OpenAPI document and the TypeScript definitions describe one contract,
 * written by hand in two languages. A drift means a client generated from the
 * document accepts a role the server rejects.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { DASHBOARD_ROLES, type DashboardCapabilities } from "./roles";
import { type DashboardErrorCode, type ForbiddenReason } from "./errors";
import { DASHBOARD_LINT_RULES, type DashboardProblem } from "./lint";
import type { DashboardCatalogParameter } from "./catalog";

const SPEC_URL = new URL("../contract/openapi.yaml", import.meta.url);
const ARTIFACT_URL = new URL(
  "../contract/dashboard-config.schema.json",
  import.meta.url,
);

interface SchemaNode {
  $ref?: string;
  type?: unknown;
  items?: SchemaNode;
  enum?: string[];
  properties?: Record<string, SchemaNode>;
  required?: string[];
  oneOf?: { $ref?: string; type?: string }[];
  additionalProperties?: unknown;
  unevaluatedProperties?: unknown;
}

interface Operation {
  security?: Record<string, string[]>[];
  parameters?: { $ref?: string }[];
  responses?: Record<
    string,
    {
      $ref?: string;
      content?: Record<string, { schema?: SchemaNode }>;
    }
  >;
  requestBody?: {
    content?: Record<string, { schema?: SchemaNode & { $ref?: string } }>;
  };
}

const spec = parse(readFileSync(SPEC_URL, "utf8")) as {
  components: { schemas: Record<string, SchemaNode> };
  paths: Record<string, Record<string, Operation> | undefined>;
};

/**
 * Listed, not derived, so the document has to change when a union does.
 *
 * Written as records rather than arrays: `satisfies readonly X[]` only rejects
 * an entry that is not a member, so adding a member and forgetting this list
 * still compiles. A `Record` keyed by the union does not.
 */
const ERROR_CODE_ORDER = {
  UNAUTHENTICATED: true,
  FORBIDDEN: true,
  NOT_FOUND: true,
  BAD_REQUEST: true,
  CONFLICT: true,
  PAYLOAD_TOO_LARGE: true,
  UPSTREAM_ERROR: true,
  INTERNAL_ERROR: true,
} as const satisfies Record<DashboardErrorCode, true>;
const ERROR_CODES = Object.keys(ERROR_CODE_ORDER);

const FORBIDDEN_REASON_ORDER = {
  TENANT_SCOPE: true,
  EMBED_SCOPE: true,
  CAPABILITY: true,
} as const satisfies Record<ForbiddenReason, true>;
const FORBIDDEN_REASONS = Object.keys(FORBIDDEN_REASON_ORDER);

const CAPABILITY_ORDER = {
  readOnly: true,
  canEdit: true,
  canShare: true,
  canManagePermissions: true,
  canDelete: true,
} as const satisfies Record<keyof DashboardCapabilities, true>;
const CAPABILITY_KEYS = Object.keys(CAPABILITY_ORDER);

describe("the OpenAPI document", () => {
  it("excludes embed tokens from scope capabilities authentication", () => {
    expect(spec.paths["/tenants/{tenantId}/scopes/{scopeId}/capabilities"]?.get?.security)
      .toEqual([{ bearerAuth: [] }, { ticketAuth: [] }, { devUser: [] }]);
  });

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

  // Relative and unqualified, so it resolves on disk and over HTTP alike.
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

  it("does not let a save send null", () => {
    const put = Object.entries(spec.paths).find(([path]) =>
      path.endsWith("/{slug}"),
    )?.[1]?.put;
    const schema = put?.requestBody?.content?.["application/json"]?.schema;
    // The nullable component is for reading an empty slug. Referencing it here
    // would tell a generated client that `null` is a save.
    expect(schema?.$ref).toBe(
      "dashboard-config.schema.json#/definitions/DashboardConfig",
    );
  });

  it("still allows a slug that has never been saved to answer null", () => {
    const members = spec.components.schemas.DashboardConfig?.oneOf ?? [];
    expect(members.some((member) => member.type === "null")).toBe(true);
  });

  it("closes the two bodies the server refuses unknown fields in", () => {
    // Open by default in JSON Schema. Left open, a generated client accepts
    // the misspelled field that the server answers 400 for.
    expect(spec.components.schemas.DataSourceInput?.additionalProperties).toBe(
      false,
    );
    // `unevaluatedProperties`, because `oneOf` branches are what evaluate
    // these properties; `additionalProperties` here would see none of them.
    expect(spec.components.schemas.CredentialInput?.unevaluatedProperties).toBe(
      false,
    );
  });

  describe("dashboard lint", () => {
    const base = "/tenants/{tenantId}/scopes/{scopeId}/dashboards/{slug}";
    const put = spec.paths[base]?.put;
    const validate = spec.paths[`${base}/validate`]?.post;

    const PROBLEM_KEYS = {
      rule: true,
      path: true,
      message: true,
      severity: true,
    } as const satisfies Record<keyof DashboardProblem, true>;
    const PARAMETER_KEYS = {
      name: true,
      required: true,
      description: true,
    } as const satisfies Record<keyof DashboardCatalogParameter, true>;

    it("serves validate with the auth, parameters and errors of a save", () => {
      expect(validate).toBeDefined();
      expect(validate?.security).toEqual(put?.security);
      expect(validate?.parameters).toEqual(
        put?.parameters?.filter((p) => !p.$ref?.endsWith("/ifMatch")),
      );
      // Invalid documents must reach the linter and receive contract problems.
      expect(validate?.requestBody?.content?.["application/json"]?.schema)
        .toEqual({});
      for (const status of ["400", "401", "403"]) {
        expect(validate?.responses?.[status]).toEqual(put?.responses?.[status]);
      }
    });

    it("answers validate with valid and the problems", () => {
      const data =
        validate?.responses?.["200"]?.content?.["application/json"]?.schema
          ?.properties?.data;
      expect(data?.$ref).toBe("#/components/schemas/ValidationResult");
      const result = spec.components.schemas.ValidationResult;
      expect([...(result?.required ?? [])].sort()).toEqual(["problems", "valid"]);
      expect(result?.properties?.problems?.items?.$ref).toBe(
        "#/components/schemas/DashboardProblem",
      );
    });

    it("describes the problem type, with the severities of the rules", () => {
      const problem = spec.components.schemas.DashboardProblem;
      expect(Object.keys(problem?.properties ?? {})).toEqual(
        Object.keys(PROBLEM_KEYS),
      );
      expect([...(problem?.required ?? [])].sort()).toEqual(
        Object.keys(PROBLEM_KEYS).sort(),
      );
      expect([...(problem?.properties?.severity?.enum ?? [])].sort()).toEqual(
        [...new Set(Object.values(DASHBOARD_LINT_RULES))].sort(),
      );
    });

    it("lets the error envelope carry problems", () => {
      expect(
        spec.components.schemas.Error?.properties?.problems?.items?.$ref,
      ).toBe("#/components/schemas/DashboardProblem");
      expect(spec.components.schemas.Error?.required).not.toContain("problems");
    });

    it("publishes optional operation parameters in the query catalog", () => {
      const catalog = spec.paths[`${base}/query-catalog`]?.get;
      const operation =
        catalog?.responses?.["200"]?.content?.["application/json"]?.schema
          ?.properties?.connections?.items?.properties?.operations?.items;
      expect(operation?.required).toEqual(["id", "label"]);
      expect(operation?.properties?.parameters?.items?.$ref).toBe(
        "#/components/schemas/CatalogParameter",
      );
      const parameter = spec.components.schemas.CatalogParameter;
      expect(Object.keys(parameter?.properties ?? {})).toEqual(
        Object.keys(PARAMETER_KEYS),
      );
      expect(parameter?.required).toEqual(["name"]);
    });
  });
});
