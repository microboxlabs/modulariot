/**
 * Credentials seam — how the query proxy obtains a secret without ever
 * exposing one.
 *
 * A BigQuery service-account key or a PgREST token must never reach the
 * browser; that is the whole reason datasource queries are proxied rather
 * than issued client-side. Credentials enter this package only through this
 * seam, are used only to sign an outbound request, and never appear in any
 * response body — including error responses, which is the easier rule to
 * break.
 */

export type DataSourceKind = "POSTGREST" | "BIGQUERY";

export type DataSourceCredential =
  | { kind: "NONE" }
  | { kind: "TOKEN"; token: string }
  | { kind: "BASIC"; username: string; password: string }
  | {
      /** Google service-account JSON, for BigQuery. */
      kind: "SERVICE_ACCOUNT";
      projectId: string;
      clientEmail: string;
      privateKey: string;
    };

/**
 * Non-secret description of a datasource. This is the shape that may be
 * serialized to a client; the credential half never is.
 */
export interface DataSourceDescriptor {
  id: string;
  name: string;
  type: DataSourceKind;
  description?: string;
  isActive: boolean;
  /** Base URL or dataset reference — no embedded credentials. */
  target: string;
}

export interface CredentialsVault {
  /**
   * Resolve the credential for one datasource within one tenant.
   *
   * The `tenantId` argument is not decoration: a datasource id alone must
   * never be enough to obtain a secret, or a caller who learns an id from
   * another tenant can borrow its credential.
   */
  resolve(
    tenantId: string,
    dataSourceId: string,
  ): Promise<DataSourceCredential | null>;
}
