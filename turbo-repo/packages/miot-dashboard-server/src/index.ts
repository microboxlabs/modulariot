/**
 * @microboxlabs/miot-dashboard-server — package entry.
 *
 * P0 declared the seams a host implements. P1 adds the first service behind
 * them: access control, the single point where identity, tenancy and
 * capabilities are enforced. Later services (persistence, query proxy, embed
 * tokens) land phase by phase and all go through it.
 *
 * Framework adapters are deliberately absent from this entry — `./next`
 * (P2) and `./fastify` (P8) get their own so mounting one never drags in the
 * other.
 */

// ---- Seam: identity & tenancy ----
export {
  NO_CAPABILITIES,
  type DashboardCapabilities,
  type DashboardPrincipalKind,
  type DashboardPrincipal,
  type DashboardIdentity,
  type IdentityResolver,
  type TenantAuthority,
  type ScopeAuthority,
} from "./seams/identity";

// ---- Seam: persistence ----
export type {
  ServerDashboardRef,
  DashboardSummary,
  DashboardRecord,
  SaveOptions,
  PermissionAssignment,
  ServerDashboardStore,
} from "./seams/store";

// ---- Seam: credentials ----
export type {
  DataSourceKind,
  DataSourceCredential,
  DataSourceDescriptor,
  CredentialsVault,
} from "./seams/credentials";

// ---- Seam: audit ----
export {
  noopAuditSink,
  type AuditAction,
  type AuditOutcome,
  type AuditEvent,
  type AuditSink,
} from "./seams/audit";

// ---- Roles & capabilities ----
export {
  DASHBOARD_ROLES,
  FULL_CAPABILITIES,
  isDashboardRole,
  roleAtLeast,
  highestRole,
  capabilitiesForRole,
  intersectCapabilities,
  type DashboardRole,
  type RoleCapabilityOptions,
} from "./access/roles";

export {
  roleCapabilityPolicy,
  type CapabilityContext,
  type CapabilityPolicy,
} from "./access/capabilities";

// ---- Errors ----
export {
  DashboardServerError,
  STATUS_BY_CODE,
  isDashboardServerError,
  toErrorEnvelope,
  type DashboardErrorCode,
  type ForbiddenReason,
  type ErrorEnvelope,
} from "./access/errors";

// ---- Access control ----
export {
  createAccessControl,
  type AccessControl,
  type AccessControlOptions,
  type AccessDecision,
  type AccessTarget,
  type DashboardAccess,
  type DashboardAction,
} from "./access/access-control";

// ---- Capability policies ----
export {
  createAllowedGroupsPolicy,
  configAllowsGroups,
  parseAllowedGroups,
  ALLOWED_GROUPS_FIELD,
} from "./access/allowed-groups";

// ---- One-time import ----
export { importDashboards } from "./import/import";
export type {
  ImportOptions,
  ImportRefusal,
  ImportResult,
} from "./import/import";
export { refLabel } from "./import/legacy";
export type { LegacyDashboard, LegacyDashboardSource } from "./import/legacy";
export { migrateConfig, CURRENT_CONFIG_VERSION } from "./import/migrate";
export type { MigrationResult } from "./import/migrate";
