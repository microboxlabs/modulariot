import { describe, expect, it } from "vitest";
import {
  activeKeyCount,
  assignableBaseRoles,
  basePermissions,
  catalogModules,
  effectivePermissions,
  expiryDays,
  groupByModule,
  initials,
  invalidEmails,
  inviteLink,
  keyDisplay,
  keyState,
  labelOf,
  lastKeyUse,
  matrixColumns,
  memberLabels,
  parseEmails,
  permissionsByModule,
  rolesByModule,
  sameRoles,
  selectedRoles,
  sourceKey,
  textOf,
} from "./team-model";
import type {
  AccessCatalog,
  ApiKey,
  ServiceAccount,
  TeamMember,
} from "./team.types";

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
  it("counts an account's active keys and finds its latest use", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const account = {
      keys: [
        key({ lastUsedAt: "2026-05-02T00:00:00Z" }),
        key({
          lastUsedAt: "2026-05-20T00:00:00Z",
          revokedAt: "2026-05-21T00:00:00Z",
        }),
        key({ expiresAt: "2026-05-01T00:00:00Z" }),
      ],
    } as ServiceAccount;
    expect(activeKeyCount(account, now)).toBe(1);
    expect(lastKeyUse(account)).toBe("2026-05-20T00:00:00Z");
    expect(lastKeyUse({ keys: [key({})] } as ServiceAccount)).toBeNull();
  });
});

describe("member access page", () => {
  const described: AccessCatalog = {
    ...catalog,
    modules: [
      {
        key: "controltower",
        label: { es: "Torre de control" },
        description: { es: "Casos" },
        ai: false,
      },
    ],
  };

  it("lists described modules first and names the rest by key", () => {
    expect(catalogModules(described).map((m) => m.key)).toEqual([
      "controltower",
      "content",
    ]);
    expect(catalogModules(catalog)[0].label).toEqual({});
  });

  it("reads texts in the page language, falling back to Spanish", () => {
    expect(textOf({ es: "Hola", en: "Hi" }, "en")).toBe("Hi");
    expect(textOf({ es: "Hola" }, "en")).toBe("Hola");
    expect(textOf(undefined, "es")).toBe("");
  });

  it("adds module role permissions to the base role's", () => {
    const member = effectivePermissions(
      "MEMBER",
      ["CONTROL_TOWER_VIEWER"],
      catalog
    );
    expect([...member].sort()).toEqual([
      "controltower:view",
      "members:read",
      "org:read",
    ]);
    // Explicit-only permissions come only from a role, even for owners.
    expect(
      effectivePermissions("OWNER", [], catalog).has(
        "content:review.autoapprove"
      )
    ).toBe(false);
  });

  it("groups permissions by module in catalog order", () => {
    const groups = permissionsByModule(
      new Set(["controltower:view", "org:read"]),
      catalog
    );
    expect(groups.map((g) => g.module)).toEqual(["org", "controltower"]);
  });

  it("compares role lists ignoring order", () => {
    expect(sameRoles(["A", "B"], ["B", "A"])).toBe(true);
    expect(sameRoles(["A"], ["A", "B"])).toBe(false);
  });

  it("builds avatar initials from the name or the email", () => {
    expect(initials("Ana Soto", null)).toBe("AS");
    expect(initials(null, "erick.perez@example.com")).toBe("EP");
    expect(initials(null, "michel@example.com")).toBe("MI");
  });

  it("names where a membership came from", () => {
    expect(sourceKey("ALFRESCO")).toBe("sourceALFRESCO");
    expect(sourceKey("INVITE")).toBe("sourceINVITE");
    expect(sourceKey("NATIVE")).toBe("sourceNATIVE");
  });
});
