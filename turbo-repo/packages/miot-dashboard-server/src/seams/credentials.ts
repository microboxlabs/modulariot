/**
 * Credentials seam — how the query proxy obtains request auth without ever
 * holding a secret it could leak.
 *
 * A BigQuery service-account key or a PgREST token must never reach the
 * browser; that is why datasource queries are proxied rather than issued
 * client-side. Credentials enter this package only through this seam, are
 * used only to sign an outbound request, and never appear in any response
 * body — including error responses, which is the easier rule to break.
 *
 * Two directions, two types. {@link CredentialInput} is what an operator
 * supplies; {@link DataSourceCredential} is what the vault hands back, and it
 * is auth already applied rather than the secret it came from. A host that
 * runs an OAuth2 grant does it on its side and returns the resulting header,
 * so this package never learns the client secret.
 */

/** ISO-8601 instant. */
type Timestamp = string;

// ----------------------------------------------------------- resolving ----

/**
 * The result of resolving a credential: what to put on the outbound request.
 *
 * Not the stored secret. `Authorization: Bearer x` and a client-credentials
 * grant that produced the same header are indistinguishable here, which is
 * what lets a host add an auth type without this package changing.
 */
export type DataSourceCredential =
  | { kind: "NONE" }
  | {
      kind: "HTTP_AUTH";
      headers: Readonly<Record<string, string>>;
      queryParams: Readonly<Record<string, string>>;
      /**
       * When the auth stops working, for a grant that issued a lifetime.
       * Absent for a static credential. A caller may cache until this instant
       * and must not cache past it.
       */
      expiresAt?: Timestamp;
    }
  | {
      /**
       * Google service-account JSON, for BigQuery. The one kind that cannot
       * be reduced to headers: the Google client signs its own assertions and
       * needs the key itself.
       */
      kind: "SERVICE_ACCOUNT";
      projectId: string;
      clientEmail: string;
      privateKey: string;
    };

export interface CredentialsVault {
  /**
   * Resolve one credential within one tenant.
   *
   * The `tenantId` argument is not decoration: a ref alone must never be
   * enough to obtain auth, or a caller who learns a ref from another tenant
   * can borrow its credential.
   *
   * Returns null when the tenant has no such credential. Throwing is for a
   * vault that cannot answer — a host that is down is a 500, a ref that does
   * not exist is not.
   */
  resolve(
    tenantId: string,
    credentialRef: string,
  ): Promise<DataSourceCredential | null>;
}

// ------------------------------------------------------------- writing ----

/**
 * A credential as an operator supplies it. Secret by definition: every
 * variant but `NONE` carries a value that must not be logged or serialized.
 *
 * The kinds mirror what modulariot's credential component persists, minus the
 * grant-running ones. A vault that resolves an OAuth2 client-credentials
 * grant accepts it through its own configuration, not here — running a grant
 * needs a token cache and a clock, and neither belongs behind a write API.
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

/**
 * What may be told about a stored credential. Everything here is safe to
 * serialize; that is the whole point of the type existing separately.
 */
export interface CredentialSummary {
  ref: string;
  kind: CredentialKind;
  /**
   * Enough of the secret to recognize which one this is, never enough to use
   * it — a masked key id, the last four characters. Absent for `NONE`, and
   * absent is always allowed: a vault that will not derive one is correct.
   */
  preview?: string;
  updatedAt: Timestamp;
}

/**
 * A vault that can also be written to.
 *
 * Only some deployments have one. Inside modulariot credentials belong to the
 * Credentials screen and this package's vault is read-only; standalone, the
 * `vault-sql` plugin implements this so the admin API can create and rotate.
 * The routes that write credentials are mounted only when the injected vault
 * satisfies this interface — see {@link isCredentialsStore}.
 */
export interface CredentialsStore extends CredentialsVault {
  listCredentials(tenantId: string): Promise<CredentialSummary[]>;
  describeCredential(
    tenantId: string,
    credentialRef: string,
  ): Promise<CredentialSummary | null>;
  /** Create or replace. The ref is chosen by the caller and is stable. */
  putCredential(
    tenantId: string,
    credentialRef: string,
    input: CredentialInput,
  ): Promise<CredentialSummary>;
  /** Removing a ref a datasource still names is the caller's problem to refuse. */
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
 * Every property name that can carry a secret, across both directions of the
 * seam. The response-shape test walks serialized bodies and fails on any of
 * them, so adding a credential kind with a new secret field means adding it
 * here — and the test is what notices if you forget.
 *
 * Applied only to datasource and credential responses. A dashboard config is
 * arbitrary caller-supplied JSON that may legitimately contain a key named
 * `value`, so running this over one would fail on the caller's data.
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
 * only: every one of them is a fixed header or query parameter, so a vault
 * that stores secrets verbatim needs no per-kind logic of its own.
 *
 * `SERVICE_ACCOUNT` passes through unchanged — see the note on that variant.
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
 * The recognizable, non-secret part of a credential: enough to tell two
 * apart in a list. Never more than the last four characters of anything, and
 * nothing at all for a value short enough that four characters is most of it.
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
