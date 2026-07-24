import type { CredentialListItem } from "./credential.types";

export interface CredentialFilters {
  /** Free text matched against name, type and the stored identifier. */
  readonly query: string;
  /** Selected credential type ids; empty means "all". */
  readonly types: readonly string[];
  /** Selected environments; empty means "all". */
  readonly environments: readonly string[];
}

export type CredentialSort =
  | "NAME_ASC"
  | "NAME_DESC"
  | "CREATED_DESC"
  | "UPDATED_DESC";

export const DEFAULT_FILTERS: CredentialFilters = {
  query: "",
  types: [],
  environments: [],
};

export const DEFAULT_SORT: CredentialSort = "UPDATED_DESC";

export function hasActiveFilters(filters: CredentialFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.types.length > 0 ||
    filters.environments.length > 0
  );
}

/**
 * Text match runs over the name, the raw type id and the stored identifier.
 * The type id rather than its translated label keeps this a pure function —
 * "entra" still matches AZURE_ENTRA_CLIENT_CREDENTIALS in either language.
 */
function matchesQuery(credential: CredentialListItem, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [credential.name, credential.typeId, credential.summary].some(
    (field) => field.toLowerCase().includes(needle)
  );
}

/** Empty selection means "no restriction", matching the global filter badges. */
function matchesSelection(value: string, selected: readonly string[]): boolean {
  if (selected.length === 0) return true;
  return selected.some(
    (option) => option.toLowerCase() === value.toLowerCase()
  );
}

export function filterCredentials(
  credentials: readonly CredentialListItem[],
  filters: CredentialFilters
): CredentialListItem[] {
  return credentials.filter(
    (credential) =>
      matchesQuery(credential, filters.query) &&
      matchesSelection(credential.typeId, filters.types) &&
      matchesSelection(credential.environment, filters.environments)
  );
}

/**
 * Returns a new array; the input order is never mutated. Ties fall back to the
 * credential name so the order stays stable between renders.
 */
export function sortCredentials(
  credentials: readonly CredentialListItem[],
  sort: CredentialSort
): CredentialListItem[] {
  const byName = (a: CredentialListItem, b: CredentialListItem) =>
    a.name.localeCompare(b.name);
  const newestFirst = (a: string, b: string) =>
    new Date(b).getTime() - new Date(a).getTime();

  const comparators: Record<
    CredentialSort,
    (a: CredentialListItem, b: CredentialListItem) => number
  > = {
    NAME_ASC: byName,
    NAME_DESC: (a, b) => byName(b, a),
    CREATED_DESC: (a, b) =>
      newestFirst(a.createdAt, b.createdAt) || byName(a, b),
    UPDATED_DESC: (a, b) =>
      newestFirst(a.updatedAt, b.updatedAt) || byName(a, b),
  };

  return [...credentials].sort(comparators[sort]);
}
