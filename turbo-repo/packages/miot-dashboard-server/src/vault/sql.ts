/**
 * A `CredentialsStore` on the same database as everything else, for a
 * deployment with nowhere else to keep secrets.
 *
 * Opt-in. Nothing in the core imports this module, so whether a deployment
 * stores credentials is answered by whether it imports it. Inside modulariot
 * it is not used: credentials belong to that product's own component and
 * this server reaches them through the callback vault instead.
 *
 * What lands on disk is the encrypted credential and nothing else. `kind`
 * and `preview` are stored in the clear so listing does not need the key,
 * and both are non-secret by construction — a kind tag, and at most the last
 * four characters of a value long enough that four characters give nothing
 * away.
 *
 * The honest limit: the database and the key are both reachable from the
 * process, so anyone holding a copy of the file and the environment holds
 * the credentials. A backup of the database is a backup of secrets.
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

/**
 * Shorter than this and a key is worth guessing. The same number the proxy
 * key uses, for the same reason.
 */
export const MIN_CREDENTIALS_KEY_LENGTH = 32;

/** Its own history table, so these versions never collide with the core's. */
export const CREDENTIALS_HISTORY_TABLE = "credentials_schema_migrations";

export const CREDENTIALS_MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: "datasource credentials",
    statements: [
      // `ciphertext` is null only for kind NONE, which has nothing to
      // encrypt. `key_version` names the scheme the row was written with, so
      // a re-encrypt pass can find the rows it has not reached yet.
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

export interface SqlCredentialsVaultOptions {
  driver: SqlDriver;
  /**
   * At least {@link MIN_CREDENTIALS_KEY_LENGTH} characters, and no default,
   * ever. A vault with a default key is a vault with no key.
   */
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
  if (key.length < MIN_CREDENTIALS_KEY_LENGTH) {
    throw new VaultConfigError(
      `The credentials key is ${key.length} characters. It has to be at ` +
        `least ${MIN_CREDENTIALS_KEY_LENGTH}: it is the only thing between ` +
        "a copy of the database and every credential in it.",
    );
  }

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
        await cipher.decrypt(row.ciphertext),
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
          : await cipher.encrypt(JSON.stringify(input));
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
 * Re-encrypt every row written under an older scheme.
 *
 * Rotating the key itself is a different operation and this does not do it:
 * with one key in configuration there is no moment when both the old and the
 * new one are available, which is what rotating needs. Change the key and
 * the rows become unreadable. This exists for a change of *scheme*, where
 * the key is the same and only the envelope moves.
 */
export async function reencryptCredentials(options: {
  driver: SqlDriver;
  key: string;
  now?: () => Date;
}): Promise<number> {
  const { driver, key } = options;
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

      const plaintext = await cipher.decrypt(current.ciphertext);
      const q = placeholders(driver.dialect);
      await driver.all(
        `UPDATE datasource_credentials
            SET ciphertext = ${q()}, key_version = ${q()}, updated_at = ${q()}
          WHERE tenant_id = ${q()} AND ref = ${q()}`,
        [
          await cipher.encrypt(plaintext),
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
