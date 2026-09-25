/**
 * Credentials stored in this package's own database, encrypted at rest.
 *
 * A separate entry point: nothing in the core imports it, so a deployment
 * that does not import it has no code path that can store a secret.
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
