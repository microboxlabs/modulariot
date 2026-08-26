/**
 * @microboxlabs/miot-dashboard-server — package entry.
 *
 * P0 surface: the four seams a host implements. Services (persistence,
 * tenancy enforcement, query proxy, embed tokens) land phase by phase behind
 * these interfaces, so a host that implements them today keeps compiling as
 * the package fills in.
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
  type DashboardIdentity,
  type IdentityResolver,
} from "./seams/identity";

// ---- Seam: persistence ----
export type {
  ServerDashboardRef,
  DashboardSummary,
  DashboardRecord,
  SaveOptions,
  DashboardRole,
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
