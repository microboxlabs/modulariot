/**
 * A `CredentialsStore` on the same database as everything else, for a
 * deployment with nowhere else to keep secrets. Nothing in the core imports
 * it. modulariot does not use it: credentials belong to that product's own
 * component, which this server reaches through the callback vault.
 *
 * The secret is encrypted. `kind` and `preview` are stored in the clear so
 * listing does not need the key. A preview is the last four characters of a
 * long token, or, for the two kinds that have one, the whole non-secret
 * half of the pair: the BASIC username, the service account's client email.
 * `previewOf` in `seams/credentials.ts` decides this, and the same value
 * already goes to the browser in a `CredentialSummary`.
 *
 * The limit: the database and the key are both reachable from the process.
 * A copy of the database plus the environment is a copy of the credentials,
 * and a backup of the database is a backup of secrets.
 */

import {
  applyCredential,
  previewOf,
  type CredentialInput,
  type CredentialSummary,
  type CredentialsStore,
  type DataSourceCredential,
} from "../seams/credentials";
import {
  placeholders,
  type SqlDriver,
  type SqlValue,
} from "../store/sql/driver";
import { runMigrations, type Migration } from "../store/sql/migrations";
import { CIPHER_VERSION, createCipher, type Cipher } from "./cipher";

/** The same minimum the proxy key uses. */
export const MIN_CREDENTIALS_KEY_LENGTH = 32;

/** Its own history table, so these versions never collide with the core's. */
export const CREDENTIALS_HISTORY_TABLE = "credentials_schema_migrations";

export const CREDENTIALS_MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: "datasource credentials",
    statements: [
      // `ciphertext` is null only for kind NONE. `key_version` is the scheme
      // the row was written with, so a re-encrypt pass can find the rows it
      // has not reached.
      `CREATE TABLE datasource_credentials (
         tenant_id   TEXT NOT NULL,
         ref         TEXT NOT NULL,
         kind        TEXT NOT NULL,
         ciphertext  TEXT,
         preview     TEXT,
         key_version INTEGER NOT NULL,
         updated_at  TEXT NOT NULL,
         PRIMARY KEY (tenant_id, ref)
       )`,
    ],
  },
];

export class VaultConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultConfigError";
  }
}

function requireKey(key: string): void {
  if (key.length < MIN_CREDENTIALS_KEY_LENGTH) {
    throw new VaultConfigError(
      `The credentials key is ${key.length} characters. It has to be at ` +
        `least ${MIN_CREDENTIALS_KEY_LENGTH}. It encrypts every credential ` +
        "in the database.",
    );
  }
}

/**
 * Authenticated with the envelope, so a ciphertext moved to another row
 * fails to decrypt instead of resolving as that row's credential.
 */
function rowContext(tenantId: string, ref: string): string {
  return JSON.stringify([tenantId, ref]);
}

export interface SqlCredentialsVaultOptions {
  driver: SqlDriver;
  /** At least {@link MIN_CREDENTIALS_KEY_LENGTH} characters. No default. */
  key: string;
  now?: () => Date;
  /** Skip the schema check, for a caller that ran the migrations itself. */
  migrate?: boolean;
}

interface RawRow {
  ref: string;
  kind: string;
  ciphertext: string | null;
  preview: string | null;
  updated_at: string;
}

function toSummary(raw: RawRow): CredentialSummary {
  return {
    ref: raw.ref,
    kind: raw.kind as CredentialSummary["kind"],
    ...(raw.preview !== null ? { preview: raw.preview } : {}),
    updatedAt: raw.updated_at,
  };
}

export async function createSqlCredentialsVault(
  options: SqlCredentialsVaultOptions,
): Promise<CredentialsStore> {
  const { driver, key } = options;
  requireKey(key);

  const now = options.now ?? (() => new Date());
  const cipher: Cipher = createCipher(key);

  if (options.migrate !== false) {
    await runMigrations(driver, {
      migrations: CREDENTIALS_MIGRATIONS,
      historyTable: CREDENTIALS_HISTORY_TABLE,
      now,
    });
  }

  async function read(
    tenantId: string,
    ref: string,
  ): Promise<RawRow | undefined> {
    const p = placeholders(driver.dialect);
    const rows = await driver.all<RawRow>(
      `SELECT ref, kind, ciphertext, preview, updated_at
         FROM datasource_credentials
        WHERE tenant_id = ${p()} AND ref = ${p()}`,
      [tenantId, ref],
    );
    return rows[0];
  }

  return {
    async resolve(
      tenantId: string,
      credentialRef: string,
    ): Promise<DataSourceCredential | null> {
      const row = await read(tenantId, credentialRef);
      if (row === undefined) return null;
      if (row.ciphertext === null) return { kind: "NONE" };

      const input = JSON.parse(
        await cipher.decrypt(
          row.ciphertext,
          rowContext(tenantId, credentialRef),
        ),
      ) as CredentialInput;
      return applyCredential(input);
    },

    async listCredentials(tenantId: string): Promise<CredentialSummary[]> {
      const p = placeholders(driver.dialect);
      const rows = await driver.all<RawRow>(
        `SELECT ref, kind, ciphertext, preview, updated_at
           FROM datasource_credentials
          WHERE tenant_id = ${p()}
          ORDER BY ref`,
        [tenantId],
      );
      return rows.map(toSummary);
    },

    async describeCredential(
      tenantId: string,
      credentialRef: string,
    ): Promise<CredentialSummary | null> {
      const row = await read(tenantId, credentialRef);
      return row === undefined ? null : toSummary(row);
    },

    async putCredential(
      tenantId: string,
      credentialRef: string,
      input: CredentialInput,
    ): Promise<CredentialSummary> {
      const preview = previewOf(input) ?? null;
      const ciphertext =
        input.kind === "NONE"
          ? null
          : await cipher.encrypt(
              JSON.stringify(input),
              rowContext(tenantId, credentialRef),
            );
      const updatedAt = now().toISOString();

      const p = placeholders(driver.dialect);
      const values: SqlValue[] = [
        tenantId,
        credentialRef,
        input.kind,
        ciphertext,
        preview,
        CIPHER_VERSION,
        updatedAt,
      ];
      await driver.all(
        `INSERT INTO datasource_credentials
           (tenant_id, ref, kind, ciphertext, preview, key_version, updated_at)
         VALUES (${p()}, ${p()}, ${p()}, ${p()}, ${p()}, ${p()}, ${p()})
         ON CONFLICT (tenant_id, ref) DO UPDATE SET
           kind        = excluded.kind,
           ciphertext  = excluded.ciphertext,
           preview     = excluded.preview,
           key_version = excluded.key_version,
           updated_at  = excluded.updated_at`,
        values,
      );

      return {
        ref: credentialRef,
        kind: input.kind,
        ...(preview !== null ? { preview } : {}),
        updatedAt,
      };
    },

    async removeCredential(
      tenantId: string,
      credentialRef: string,
    ): Promise<void> {
      const p = placeholders(driver.dialect);
      await driver.all(
        `DELETE FROM datasource_credentials
          WHERE tenant_id = ${p()} AND ref = ${p()}`,
        [tenantId, credentialRef],
      );
    },
  };
}

/**
 * Re-encrypt every row written under an older scheme. The key stays the
 * same; only the envelope changes.
 *
 * This does not rotate the key. Rotation needs the old key and the new one
 * at the same time, and configuration holds one. Changing the key makes the
 * existing rows unreadable.
 */
export async function reencryptCredentials(options: {
  driver: SqlDriver;
  key: string;
  now?: () => Date;
}): Promise<number> {
  const { driver, key } = options;
  requireKey(key);
  const cipher = createCipher(key);
  const now = options.now ?? (() => new Date());

  const stale = await driver.all<{ tenant_id: string; ref: string }>(
    `SELECT tenant_id, ref FROM datasource_credentials
      WHERE key_version < ${CIPHER_VERSION} AND ciphertext IS NOT NULL`,
  );

  let rewritten = 0;
  for (const row of stale) {
    await driver.transaction(async () => {
      const p = placeholders(driver.dialect);
      const [current] = await driver.all<{ ciphertext: string | null }>(
        `SELECT ciphertext FROM datasource_credentials
          WHERE tenant_id = ${p()} AND ref = ${p()}` + driver.dialect.rowLock,
        [row.tenant_id, row.ref],
      );
      if (current?.ciphertext == null) return;

      const context = rowContext(row.tenant_id, row.ref);
      const plaintext = await cipher.decrypt(current.ciphertext, context);
      const q = placeholders(driver.dialect);
      await driver.all(
        `UPDATE datasource_credentials
            SET ciphertext = ${q()}, key_version = ${q()}, updated_at = ${q()}
          WHERE tenant_id = ${q()} AND ref = ${q()}`,
        [
          await cipher.encrypt(plaintext, context),
          CIPHER_VERSION,
          now().toISOString(),
          row.tenant_id,
          row.ref,
        ],
      );
      rewritten += 1;
    });
  }
  return rewritten;
}
