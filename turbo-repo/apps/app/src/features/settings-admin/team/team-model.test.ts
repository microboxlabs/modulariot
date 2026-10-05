import { describe, expect, it } from "vitest";
import {
  assignableBaseRoles,
  basePermissions,
  groupByModule,
  invalidEmails,
  inviteLink,
  labelOf,
  matrixColumns,
  parseEmails,
  rolesByModule,
  selectedRoles,
} from "./team-model";
import type { AccessCatalog } from "./team.types";

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
