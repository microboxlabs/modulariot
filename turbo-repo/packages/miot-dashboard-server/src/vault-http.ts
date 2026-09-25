/**
 * Credentials resolved by asking the host, for a deployment where they
 * belong to another system.
 *
 * Separate from `./vault-sql` so that importing one does not pull in the
 * other: this needs no database, and that one needs no network.
 */

export { createHttpCredentialsVault } from "./vault/http";
export type { HttpCredentialsVaultOptions } from "./vault/http";
