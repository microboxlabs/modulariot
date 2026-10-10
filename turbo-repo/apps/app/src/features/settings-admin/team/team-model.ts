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

/** The most emails the backend accepts in one invite request. */
export const MAX_INVITES_PER_REQUEST = 20;

/** The emails in requests of at most MAX_INVITES_PER_REQUEST each. */
export function inviteBatches(emails: readonly string[]): string[][] {
  const batches: string[][] = [];
  for (let i = 0; i < emails.length; i += MAX_INVITES_PER_REQUEST) {
    batches.push(emails.slice(i, i + MAX_INVITES_PER_REQUEST));
  }
  return batches;
}

/** One email the backend refused, and why. */
export interface InviteFailure {
  email: string;
  message: string;
}

export interface InviteOutcome<T> {
  created: T[];
  failures: InviteFailure[];
  /** Emails a failed request saved: pending afterwards, not before. Their links were not returned. */
  alreadyPending: string[];
  /** Emails of a failed request whose pending invitations could not be checked. */
  unchecked: string[];
}

interface InviteAllOptions<T> {
  /** Creates the invitations for these emails. */
  send: (emails: string[]) => Promise<T[]>;
  /** The emails with a pending invitation now. */
  pendingEmails: () => Promise<Set<string>>;
  /** Whether a failed request refused one of its emails, so the others can be sent alone. */
  isRefusal: (error: unknown) => boolean;
  /** False stops before the next request. */
  keepGoing: () => boolean;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Sends the emails in batches. When a batch fails, the backend may have saved
 * it before failing: emails pending now but not before this call are left
 * out. When the request was refused, the rest are sent one by one, so one
 * refused email does not block the others. Any other failure stops, and the
 * unsent emails are reported as failed.
 */
export async function inviteAll<T>(
  emails: readonly string[],
  options: InviteAllOptions<T>
): Promise<InviteOutcome<T>> {
  const outcome: InviteOutcome<T> = {
    created: [],
    failures: [],
    alreadyPending: [],
    unchecked: [],
  };
  // Read first, so an invitation pending before this call is not taken for one it saved.
  const before = await options.pendingEmails().catch(() => null);
  const batches = inviteBatches(emails);
  for (const [index, batch] of batches.entries()) {
    if (!options.keepGoing()) break;
    try {
      outcome.created.push(...(await options.send(batch)));
      continue;
    } catch (e) {
      const unsaved = await notSaved(batch, before, options, outcome);
      if (options.isRefusal(e)) {
        await retryOneByOne(unsaved, options, outcome);
        continue;
      }
      const message = messageOf(e);
      for (const email of [...unsaved, ...batches.slice(index + 1).flat()]) {
        outcome.failures.push({ email, message });
      }
      break;
    }
  }
  return outcome;
}

/**
 * The batch's emails the failed request did not save. Without both lists the
 * whole batch is reported unchecked, because a retry could invite someone twice.
 */
async function notSaved<T>(
  batch: string[],
  before: Set<string> | null,
  { pendingEmails }: InviteAllOptions<T>,
  outcome: InviteOutcome<T>
): Promise<string[]> {
  const now = before && (await pendingEmails().catch(() => null));
  if (!before || !now) {
    outcome.unchecked.push(...batch);
    return [];
  }
  const unsaved: string[] = [];
  for (const email of batch) {
    if (now.has(email) && !before.has(email)) {
      outcome.alreadyPending.push(email);
    } else {
      unsaved.push(email);
    }
  }
  return unsaved;
}

async function retryOneByOne<T>(
  emails: string[],
  { send, keepGoing }: InviteAllOptions<T>,
  outcome: InviteOutcome<T>
) {
  for (const email of emails) {
    if (!keepGoing()) return;
    try {
      outcome.created.push(...(await send([email])));
    } catch (e) {
      outcome.failures.push({ email, message: messageOf(e) });
    }
  }
}

/** Whether the caller may invite people into this organization. */
export function invitesAllowed(
  can: (permission: string) => boolean,
  membershipSource: string | undefined
): boolean {
  return can("members:invite") && membershipSource === "NATIVE";
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

/** The modulith's `GpsAccessCatalog.PUBLISHER`: the role the organization's application issues tokens to. */
export const GPS_PUBLISHER_ROLE = "GPS_PUBLISHER";

/**
 * The account uses the organization's application (no credential linked) but cannot get a token from it: that
 * application issues tokens only to accounts that may send GPS positions.
 */
export function defaultTokenNeedsGpsRole(account: ServiceAccount): boolean {
  return (
    account.tokenCredentialRef === null &&
    !account.roles.includes(GPS_PUBLISHER_ROLE)
  );
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
