/** Server-injected audit metadata field names. These `p_*` parameters are
 *  stamped onto every imported row by /bulk's `buildMetaBody` (`row-body.ts`),
 *  not provided by the user.
 *
 *  Consumers:
 *    - /openapi route filters these out before returning parameters to the
 *      client, so the schema panel doesn't show them as "required missing"
 *      and the autocomplete doesn't suggest them.
 *    - /validate route filters them before running Zod, so user data isn't
 *      forced to provide them.
 *    - /bulk route deliberately KEEPS them in its `allowed` set so that
 *      `buildMetaBody`'s `allowed`-gate lets injected audit fields through.
 *
 *  Keep in sync with the `put(...)` calls in `row-body.ts:buildMetaBody`.
 *  The unit test in `audit-fields.test.ts` asserts the two stay aligned. */
export const AUDIT_FIELD_NAMES: readonly string[] = [
  "p_uploaded_by",
  "p_source_type",
  "p_source_name",
  "p_source_hash",
  "p_timezone",
  "p_client_id",
  "p_schema_version",
  "p_total_rows",
  "p_row_number",
];

export const AUDIT_FIELD_SET: ReadonlySet<string> = new Set(AUDIT_FIELD_NAMES);

export function isAuditField(name: string): boolean {
  return AUDIT_FIELD_SET.has(name);
}
