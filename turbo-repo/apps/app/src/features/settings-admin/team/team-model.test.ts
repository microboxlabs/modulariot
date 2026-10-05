import { describe, expect, it } from "vitest";
import {
  assignableBaseRoles,
  basePermissions,
  expiryDays,
  groupByModule,
  invalidEmails,
  inviteLink,
  keyDisplay,
  keyState,
  labelOf,
  matrixColumns,
  memberLabels,
  parseEmails,
  rolesByModule,
  selectedRoles,
  teamOrganizationRoles,
  teamRoleChanges,
} from "./team-model";
import type { AccessCatalog, ApiKey, Binding, TeamMember } from "./team.types";

const catalog: AccessCatalog = {
  baseRoles: ["MEMBER", "ADMIN", "OWNER"],
  permissions: [
    {
      key: "org:read",
      module: "org",
      label: { es: "Ver" },
      explicitOnly: false,
      ownerOnly: false,
    },
    {
      key: "members:read",
      module: "members",
      label: { es: "Ver miembros" },
      explicitOnly: false,
      ownerOnly: false,
    },
    {
      key: "owners:manage",
      module: "owners",
      label: { es: "Propietarios" },
      explicitOnly: false,
      ownerOnly: true,
    },
    {
      key: "content:review.autoapprove",
      module: "content",
      label: { es: "Auto" },
      explicitOnly: true,
      ownerOnly: false,
    },
    {
      key: "controltower:view",
      module: "controltower",
      label: { es: "Ver torre", en: "View tower" },
      explicitOnly: false,
      ownerOnly: false,
    },
  ],
  roles: [
    {
      key: "CONTROL_TOWER_VIEWER",
      module: "controltower",
      label: { es: "Lector", en: "Viewer" },
      permissions: ["controltower:view"],
    },
    {
      key: "CONTENT_REVIEW_AUTO_APPROVER",
      module: "content",
      label: { es: "Aprobador" },
      permissions: ["content:review.autoapprove"],
    },
  ],
};

describe("basePermissions", () => {
  it("gives owners everything but explicit-only permissions", () => {
    const owner = basePermissions("OWNER", catalog.permissions);
    expect(owner.has("owners:manage")).toBe(true);
    expect(owner.has("content:review.autoapprove")).toBe(false);
    expect(owner.has("controltower:view")).toBe(true);
  });

  it("gives admins the owner's set minus owner-only permissions", () => {
    const admin = basePermissions("ADMIN", catalog.permissions);
    expect(admin.has("owners:manage")).toBe(false);
    expect(admin.has("controltower:view")).toBe(true);
  });

  it("gives members only reading the organization and its members", () => {
    expect([...basePermissions("MEMBER", catalog.permissions)]).toEqual([
      "org:read",
      "members:read",
    ]);
  });
});

describe("matrixColumns", () => {
  it("lists the base roles first, then the module roles in the page's language", () => {
    const columns = matrixColumns(catalog, "en", {
      OWNER: "Owner",
      ADMIN: "Admin",
      MEMBER: "Member",
    });
    expect(columns.map((c) => c.label)).toEqual([
      "Owner",
      "Admin",
      "Member",
      "Viewer",
      "Aprobador",
    ]);
    expect(columns[3].permissions.has("controltower:view")).toBe(true);
  });
});

describe("groupByModule", () => {
  it("keeps first-seen module order", () => {
    expect(groupByModule(catalog.roles).map((g) => g.module)).toEqual([
      "controltower",
      "content",
    ]);
  });
});

describe("labelOf", () => {
  it("falls back to Spanish, then the key", () => {
    expect(labelOf(catalog.roles[1], "en")).toBe("Aprobador");
    expect(labelOf({ key: "X", label: {} }, "en")).toBe("X");
    expect(labelOf(undefined, "en", "fallback")).toBe("fallback");
  });
});

describe("emails", () => {
  it("splits, lower-cases and dedupes pasted emails", () => {
    expect(parseEmails("Ana@Ex.cl, bo@ex.cl\nana@ex.cl;  ")).toEqual([
      "ana@ex.cl",
      "bo@ex.cl",
    ]);
  });

  it("reports the invalid ones", () => {
    expect(invalidEmails(["ana@ex.cl", "nope", "x@y"])).toEqual([
      "nope",
      "x@y",
    ]);
  });
});

describe("role selection", () => {
  it("offers Owner only with owners:manage", () => {
    expect(assignableBaseRoles(false)).toEqual(["ADMIN", "MEMBER"]);
    expect(assignableBaseRoles(true)).toEqual(["OWNER", "ADMIN", "MEMBER"]);
  });

  it("maps held roles to one per module and back", () => {
    const byModule = rolesByModule(
      ["CONTROL_TOWER_VIEWER", "UNKNOWN"],
      catalog.roles
    );
    expect(byModule).toEqual({ controltower: "CONTROL_TOWER_VIEWER" });
    expect(selectedRoles({ ...byModule, content: "" })).toEqual([
      "CONTROL_TOWER_VIEWER",
    ]);
  });

  it("builds the invitation link under the app base path", () => {
    expect(inviteLink("https://x.test", "es", "a/b")).toBe(
      "https://x.test/app/es/invite/a%2Fb"
    );
  });
});

function binding(over: Partial<Binding>): Binding {
  return {
    id: "b1",
    principalKind: "TEAM",
    principalId: "t1",
    role: "CONTROL_TOWER_VIEWER",
    scopeKind: "ORGANIZATION",
    subAccount: null,
    expiresAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    createdBy: null,
    ...over,
  };
}

function key(over: Partial<ApiKey>): ApiKey {
  return {
    id: "k1",
    keyId: "abc123",
    name: null,
    createdAt: "2026-01-01T00:00:00Z",
    createdBy: null,
    expiresAt: null,
    lastUsedAt: null,
    revokedAt: null,
    ...over,
  };
}

describe("teams and API keys", () => {
  const bindings = [
    binding({ id: "b1", role: "CONTROL_TOWER_VIEWER" }),
    binding({ id: "b2", role: "HARNESS_TRAINER" }),
    binding({
      id: "b3",
      role: "CONTENT_EDITOR",
      scopeKind: "SUB_ACCOUNT",
      subAccount: "child",
    }),
    binding({ id: "b4", principalId: "t2", role: "CONTENT_EDITOR" }),
    binding({ id: "b5", principalKind: "USER", principalId: "t1" }),
  ];

  it("binds the new roles and unbinds the dropped ones, organization-wide only", () => {
    expect(
      teamRoleChanges(
        "t1",
        ["CONTROL_TOWER_VIEWER", "CONTENT_EDITOR"],
        bindings
      )
    ).toEqual({ add: ["CONTENT_EDITOR"], remove: ["b2"] });
    expect(teamRoleChanges("t1", [], bindings)).toEqual({
      add: [],
      remove: ["b1", "b2"],
    });
  });

  it("reads a team's organization roles from its bindings", () => {
    expect(teamOrganizationRoles("t1", bindings)).toEqual([
      "CONTROL_TOWER_VIEWER",
      "HARNESS_TRAINER",
    ]);
  });

  it("labels members by email, then name, then id", () => {
    const members = [
      { userId: "u1", email: "a@x.test", name: "Ana" },
      { userId: "u2", email: null, name: "Bo" },
    ] as TeamMember[];
    expect(memberLabels(["u1", "u2", "u3"], members)).toEqual([
      "a@x.test",
      "Bo",
      "u3",
    ]);
  });

  it("shows only the public part of a key", () => {
    expect(keyDisplay("abc123")).toBe("miot_sk_abc123_…");
  });

  it("tells revoked and expired keys from active ones", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    expect(keyState(key({}), now)).toBe("active");
    expect(keyState(key({ expiresAt: "2026-07-01T00:00:00Z" }), now)).toBe(
      "active"
    );
    expect(keyState(key({ expiresAt: "2026-05-01T00:00:00Z" }), now)).toBe(
      "expired"
    );
    expect(
      keyState(
        key({
          expiresAt: "2026-05-01T00:00:00Z",
          revokedAt: "2026-04-01T00:00:00Z",
        }),
        now
      )
    ).toBe("revoked");
  });

  it("reads the key lifetime: blank never expires, 1 to 365 days", () => {
    expect(expiryDays("")).toBeUndefined();
    expect(expiryDays(" 30 ")).toBe(30);
    expect(expiryDays("365")).toBe(365);
    expect(expiryDays("0")).toBeNull();
    expect(expiryDays("366")).toBeNull();
    expect(expiryDays("1.5")).toBeNull();
    expect(expiryDays("abc")).toBeNull();
  });
});
