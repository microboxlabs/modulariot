import type {
  AccessCatalog,
  ApiKey,
  BaseRole,
  CatalogModule,
  CatalogPermission,
  CatalogRole,
  CreatedInvitation,
  ServiceAccount,
  TeamMember,
} from "./team.types";
import type { InviteLink } from "./invite-links";

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

/** One "@", something before it, and a dot inside the domain; no spaces. */
function isEmail(text: string): boolean {
  const at = text.indexOf("@");
  if (at < 1 || at !== text.lastIndexOf("@") || /\s/.test(text)) return false;
  const dot = text.lastIndexOf(".");
  return dot > at + 1 && dot < text.length - 1;
}

export function invalidEmails(emails: readonly string[]): string[] {
  return emails.filter((e) => !isEmail(e));
}

/** The base roles a caller without owners:manage may give. */
export const NON_OWNER_ROLES: BaseRole[] = BASE_ROLES.filter(
  (r) => r !== "OWNER"
);

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

/** What the invite dialog shows for one created invitation. */
export function inviteLinkOf(
  created: CreatedInvitation,
  origin: string,
  lang: string
): InviteLink {
  return {
    email: created.invitation.email,
    url: inviteLink(origin, lang, created.token),
    delivery: created.delivery ?? null,
  };
}

export function inviteLink(origin: string, lang: string, token: string) {
  return `${origin}/app/${lang}/invite/${encodeURIComponent(token)}`;
}

/** How a key is shown after creation: its public id, the secret elided. */
export function keyDisplay(keyId: string): string {
  return `miot_sk_${keyId}_…`;
}

export type KeyState = "active" | "revoked" | "expired";

export function keyState(key: ApiKey, now: Date): KeyState {
  if (key.revokedAt) return "revoked";
  if (key.expiresAt && new Date(key.expiresAt) <= now) return "expired";
  return "active";
}

/** Each user id as the member's email, else name, else the id itself. */
export function memberLabels(
  userIds: readonly string[],
  members: readonly TeamMember[]
): string[] {
  return userIds.map((id) => {
    const member = members.find((m) => m.userId === id);
    return member?.email ?? member?.name ?? id;
  });
}

export const MAX_KEY_DAYS = 365;

/**
 * The key lifetime typed in a form: blank means it never expires (undefined),
 * a whole number from 1 to 365 is kept, anything else is invalid (null).
 */
export function expiryDays(text: string): number | undefined | null {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  const days = Number(trimmed);
  return Number.isInteger(days) && days >= 1 && days <= MAX_KEY_DAYS
    ? days
    : null;
}

/**
 * The modules that have roles, in catalog order. A module the catalog does
 * not describe still appears, named by its key.
 */
export function catalogModules(catalog: AccessCatalog): CatalogModule[] {
  const out: CatalogModule[] = [...(catalog.modules ?? [])];
  for (const role of catalog.roles) {
    if (!out.some((m) => m.key === role.module)) {
      out.push({ key: role.module, label: {}, description: {}, ai: false });
    }
  }
  return out;
}

/** A per-language text in the page's language, else Spanish, else empty. */
export function textOf(
  text: Record<string, string> | undefined,
  lang: string
): string {
  if (!text) return "";
  return text[lang] ?? text.es ?? "";
}

/** The permissions a member ends up with from the base role and module roles. */
export function effectivePermissions(
  base: BaseRole,
  roles: readonly string[],
  catalog: AccessCatalog
): Set<string> {
  const out = basePermissions(base, catalog.permissions);
  for (const key of roles) {
    const role = catalog.roles.find((r) => r.key === key);
    role?.permissions.forEach((p) => out.add(p));
  }
  return out;
}

/** The given permissions grouped by module, in catalog order. */
export function permissionsByModule(
  keys: ReadonlySet<string>,
  catalog: AccessCatalog
): ModuleGroup<CatalogPermission>[] {
  return groupByModule(catalog.permissions.filter((p) => keys.has(p.key)));
}

/** Two role lists hold the same keys, in any order. */
export function sameRoles(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((key) => b.includes(key));
}

/** Keys of the account that are neither revoked nor expired. */
export function activeKeyCount(account: ServiceAccount, now: Date): number {
  return account.keys.filter((key) => keyState(key, now) === "active").length;
}

/** The latest use of any of the account's keys, or null when none was used. */
export function lastKeyUse(account: ServiceAccount): string | null {
  const used = account.keys
    .map((key) => key.lastUsedAt)
    .filter((at): at is string => at !== null)
    .sort((a, b) => a.localeCompare(b));
  return used.at(-1) ?? null;
}

/** Up to two letters for an avatar: from the name, else the email. */
export function initials(name: string | null, email: string | null): string {
  const source = (name ?? "").trim() || (email ?? "").split("@")[0];
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const letters =
    parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

/** The dictionary key for where a membership came from. */
export function sourceKey(source: string): string {
  if (source === "ALFRESCO") return "sourceALFRESCO";
  if (source === "INVITE") return "sourceINVITE";
  return "sourceNATIVE";
}
