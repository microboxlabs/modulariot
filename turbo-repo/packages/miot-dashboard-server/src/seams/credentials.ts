/**
 * Credentials for datasource queries.
 *
 * A BigQuery service-account key or a PgREST token must not reach the
 * browser, so datasource queries are proxied. Credentials enter this package
 * only through this file, are used only to sign an outbound request, and
 * never appear in a response body, error responses included.
 *
 * {@link CredentialInput} is what an operator supplies.
 * {@link DataSourceCredential} is what the vault returns: auth already
 * applied, not the secret it came from. A host that runs an OAuth2 grant runs
 * it on its own side and returns the resulting header.
 */

/** ISO-8601 instant. */
type Timestamp = string;

// ----------------------------------------------------------- resolving ----

/** What to put on the outbound request. Not the stored secret. */
export type DataSourceCredential =
  | { kind: "NONE" }
  | {
      kind: "HTTP_AUTH";
      headers: Readonly<Record<string, string>>;
      queryParams: Readonly<Record<string, string>>;
      /**
       * When the auth stops working. Absent for a static credential. A caller
       * may cache until this instant and must not cache past it.
       */
      expiresAt?: Timestamp;
    }
  | {
      /**
       * Google service-account JSON, for BigQuery. The Google client signs
       * its own assertions and needs the key itself, so this kind cannot be
       * reduced to headers.
       */
      kind: "SERVICE_ACCOUNT";
      projectId: string;
      clientEmail: string;
      privateKey: string;
    };

export interface CredentialsVault {
  /**
   * Resolve one credential within one tenant. A ref alone must not be enough
   * to obtain auth, or a caller who learns another tenant's ref can borrow
   * its credential.
   *
   * Returns null when the tenant has no such credential. Throw when the vault
   * cannot answer: a host that is down is a 500, a missing ref is not.
   */
  resolve(
    tenantId: string,
    credentialRef: string,
  ): Promise<DataSourceCredential | null>;
}

// ------------------------------------------------------------- writing ----

/**
 * A credential as an operator supplies it. Every variant but `NONE` carries a
 * value that must not be logged or serialized.
 *
 * A vault that resolves an OAuth2 client-credentials grant takes it through
 * its own configuration, not here: running a grant needs a token cache and a
 * clock.
 */
export type CredentialInput =
  | { kind: "NONE" }
  | { kind: "BEARER"; token: string }
  | { kind: "API_KEY_HEADER"; header: string; value: string }
  | { kind: "API_KEY_QUERY"; param: string; value: string }
  | { kind: "BASIC"; username: string; password: string }
  | {
      kind: "SERVICE_ACCOUNT";
      projectId: string;
      clientEmail: string;
      privateKey: string;
    };

export type CredentialKind = CredentialInput["kind"];

/** What may be told about a stored credential. Everything here is safe to serialize. */
export interface CredentialSummary {
  ref: string;
  kind: CredentialKind;
  /**
   * Enough of the secret to recognize which one this is, never enough to use
   * it. Absent for `NONE`, and always allowed to be absent.
   */
  preview?: string;
  updatedAt: Timestamp;
}

/**
 * A vault that can also be written to.
 *
 * Inside modulariot, credentials belong to the Credentials screen and this
 * package's vault is read-only. Standalone, the `vault-sql` plugin implements
 * this so the admin API can create and rotate. The routes that write
 * credentials are mounted only when the injected vault satisfies this
 * interface — see {@link isCredentialsStore}.
 */
export interface CredentialsStore extends CredentialsVault {
  listCredentials(tenantId: string): Promise<CredentialSummary[]>;
  describeCredential(
    tenantId: string,
    credentialRef: string,
  ): Promise<CredentialSummary | null>;
  /** Create or replace. The caller chooses the ref and it is stable. */
  putCredential(
    tenantId: string,
    credentialRef: string,
    input: CredentialInput,
  ): Promise<CredentialSummary>;
  /** Does not check whether a datasource still names the ref. */
  removeCredential(tenantId: string, credentialRef: string): Promise<void>;
}

export function isCredentialsStore(
  vault: CredentialsVault,
): vault is CredentialsStore {
  const candidate = vault as Partial<CredentialsStore>;
  return (
    typeof candidate.listCredentials === "function" &&
    typeof candidate.describeCredential === "function" &&
    typeof candidate.putCredential === "function" &&
    typeof candidate.removeCredential === "function"
  );
}

// ---------------------------------------------------------------- gate ----

/**
 * Every property name that can carry a secret, in either direction. The
 * response-shape test walks serialized bodies and fails on any of them, so a
 * credential kind with a new secret field has to be added here.
 *
 * Applied to datasource and credential responses only. A dashboard config is
 * caller-supplied JSON that may legitimately contain a key named `value`.
 */
export const SECRET_PROPERTY_NAMES: readonly string[] = [
  "token",
  "password",
  "privateKey",
  "value",
  "headers",
  "queryParams",
];

/**
 * Turns a {@link CredentialInput} into the auth it represents. Static kinds
 * only: each one is a fixed header or query parameter, so a vault that stores
 * secrets verbatim needs no per-kind logic. `SERVICE_ACCOUNT` passes through
 * unchanged.
 */
export function applyCredential(input: CredentialInput): DataSourceCredential {
  switch (input.kind) {
    case "NONE":
      return { kind: "NONE" };
    case "BEARER":
      return {
        kind: "HTTP_AUTH",
        headers: { Authorization: `Bearer ${input.token}` },
        queryParams: {},
      };
    case "API_KEY_HEADER":
      return {
        kind: "HTTP_AUTH",
        headers: { [input.header]: input.value },
        queryParams: {},
      };
    case "API_KEY_QUERY":
      return {
        kind: "HTTP_AUTH",
        headers: {},
        queryParams: { [input.param]: input.value },
      };
    case "BASIC": {
      const encoded = Buffer.from(
        `${input.username}:${input.password}`,
        "utf8",
      ).toString("base64");
      return {
        kind: "HTTP_AUTH",
        headers: { Authorization: `Basic ${encoded}` },
        queryParams: {},
      };
    }
    case "SERVICE_ACCOUNT":
      return {
        kind: "SERVICE_ACCOUNT",
        projectId: input.projectId,
        clientEmail: input.clientEmail,
        privateKey: input.privateKey,
      };
  }
}

/**
 * The non-secret part of a credential: enough to tell two apart in a list.
 * At most the last four characters, and nothing at all below 12 characters.
 */
export function previewOf(input: CredentialInput): string | undefined {
  switch (input.kind) {
    case "NONE":
      return undefined;
    case "BEARER":
      return tail(input.token);
    case "API_KEY_HEADER":
      return tail(input.value);
    case "API_KEY_QUERY":
      return tail(input.value);
    case "BASIC":
      return input.username;
    case "SERVICE_ACCOUNT":
      return input.clientEmail;
  }
}

function tail(secret: string): string | undefined {
  return secret.length < 12 ? undefined : `…${secret.slice(-4)}`;
}
