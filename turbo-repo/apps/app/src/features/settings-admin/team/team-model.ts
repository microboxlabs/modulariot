import type {
  AccessCatalog,
  BaseRole,
  CatalogPermission,
  CatalogRole,
} from "./team.types";

export const BASE_ROLES: BaseRole[] = ["OWNER", "ADMIN", "MEMBER"];

/** Permissions every member holds through the Member base role. */
const MEMBER_PERMISSIONS = ["org:read", "members:read"];

/** The permissions each base role gives, as the backend computes them. */
export function basePermissions(
  base: BaseRole,
  permissions: readonly CatalogPermission[]
): Set<string> {
  if (base === "MEMBER") return new Set(MEMBER_PERMISSIONS);
  return new Set(
    permissions
      .filter((p) => !p.explicitOnly)
      .filter((p) => base === "OWNER" || !p.ownerOnly)
      .map((p) => p.key)
  );
}

export interface ModuleGroup<T> {
  module: string;
  items: T[];
}

/** Items grouped by module, in first-seen order. */
export function groupByModule<T extends { module: string }>(
  items: readonly T[]
): ModuleGroup<T>[] {
  const groups: ModuleGroup<T>[] = [];
  for (const item of items) {
    const group = groups.find((g) => g.module === item.module);
    if (group) group.items.push(item);
    else groups.push({ module: item.module, items: [item] });
  }
  return groups;
}

/** The label in the page's language, else Spanish, else the key. */
export function labelOf(
  item: { key: string; label: Record<string, string> } | undefined,
  lang: string,
  fallback = ""
): string {
  if (!item) return fallback;
  return item.label[lang] ?? item.label.es ?? item.key;
}

export interface MatrixColumn {
  key: string;
  label: string;
  base: boolean;
  permissions: Set<string>;
}

/** One column per base role, then one per module role. */
export function matrixColumns(
  catalog: AccessCatalog,
  lang: string,
  baseLabels: Record<BaseRole, string>
): MatrixColumn[] {
  const base = BASE_ROLES.map((role) => ({
    key: role,
    label: baseLabels[role],
    base: true,
    permissions: basePermissions(role, catalog.permissions),
  }));
  const modules = catalog.roles.map((role: CatalogRole) => ({
    key: role.key,
    label: labelOf(role, lang),
    base: false,
    permissions: new Set(role.permissions),
  }));
  return [...base, ...modules];
}

/**
 * Splits pasted emails on commas, semicolons, spaces and new lines, lower-cases
 * them and drops duplicates and blanks.
 */
export function parseEmails(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const email = raw.trim().toLowerCase();
    if (email && !out.includes(email)) out.push(email);
  }
  return out;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function invalidEmails(emails: readonly string[]): string[] {
  return emails.filter((e) => !EMAIL.test(e));
}

/** The base roles the caller may give: Owner only with owners:manage. */
export function assignableBaseRoles(canManageOwners: boolean): BaseRole[] {
  return canManageOwners ? BASE_ROLES : BASE_ROLES.filter((r) => r !== "OWNER");
}

/** One chosen role per module (or none) flattened to the role keys sent. */
export function selectedRoles(byModule: Record<string, string>): string[] {
  return Object.values(byModule).filter((key) => key !== "");
}

/** The roles a member holds, one per module, for an editor that picks one. */
export function rolesByModule(
  roles: readonly string[],
  catalog: readonly CatalogRole[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of roles) {
    const role = catalog.find((r) => r.key === key);
    if (role) out[role.module] = key;
  }
  return out;
}

export function inviteLink(origin: string, lang: string, token: string) {
  return `${origin}/app/${lang}/invite/${encodeURIComponent(token)}`;
}
