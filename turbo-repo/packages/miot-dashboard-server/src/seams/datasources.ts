/**
 * Datasources — what a dashboard names when it asks for data.
 *
 * A datasource is two halves kept apart. The descriptor says where to go and
 * may be serialized to a client; the credential says how to get in and never
 * may. They are joined by `credentialRef`, an opaque string this package
 * stores and never interprets. Only the vault knows what it addresses: a row
 * in modulariot's credential component, an entry in the `vault-sql` table, a
 * key in a file. The same datasource record therefore works in a deployment
 * that keeps secrets in this package's database and in one that keeps them
 * somewhere this package cannot read.
 *
 * A datasource belongs to a tenant, not to a scope. Every dashboard in the
 * tenant can name it, and the capability policy decides who may change one.
 */

export type DataSourceKind = "POSTGREST" | "BIGQUERY";

/** Non-secret description of a datasource. Safe to serialize. */
export interface DataSourceDescriptor {
  id: string;
  name: string;
  type: DataSourceKind;
  description?: string;
  isActive: boolean;
  /** Base URL or dataset reference — no embedded credentials. */
  target: string;
  /**
   * Opaque handle the vault resolves. It addresses a credential and is not
   * one. Absent when the datasource needs no auth.
   */
  credentialRef?: string;
  /** ISO-8601. */
  updatedAt: string;
}

/** What a caller supplies to create or replace a datasource. */
export interface DataSourceInput {
  name: string;
  type: DataSourceKind;
  description?: string;
  isActive: boolean;
  /** Base URL or dataset reference. Never carries embedded credentials. */
  target: string;
  /** Omit for a datasource that needs no credential. */
  credentialRef?: string;
}

export interface DataSourceStore {
  list(tenantId: string): Promise<DataSourceDescriptor[]>;
  get(tenantId: string, id: string): Promise<DataSourceDescriptor | null>;
  /**
   * Create or replace. The caller chooses the id, so a host can migrate
   * records in with the ids they already have.
   */
  put(
    tenantId: string,
    id: string,
    input: DataSourceInput,
  ): Promise<DataSourceDescriptor>;
  remove(tenantId: string, id: string): Promise<void>;
}
