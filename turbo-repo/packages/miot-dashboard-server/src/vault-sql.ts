/**
 * Credentials stored in this package's own database, encrypted at rest.
 *
 * A separate entry point on purpose: nothing in the core imports it, so a
 * deployment that does not import it has no code path that can store a
 * secret. Enabling it is a decision someone makes, and one a reader can see.
 *
 * Needs the SQL store — pass the same driver.
 */

export {
  createSqlCredentialsVault,
  reencryptCredentials,
  CREDENTIALS_HISTORY_TABLE,
  CREDENTIALS_MIGRATIONS,
  MIN_CREDENTIALS_KEY_LENGTH,
  VaultConfigError,
} from "./vault/sql";
export type { SqlCredentialsVaultOptions } from "./vault/sql";

export { CIPHER_VERSION, CipherError, createCipher } from "./vault/cipher";
export type { Cipher } from "./vault/cipher";
