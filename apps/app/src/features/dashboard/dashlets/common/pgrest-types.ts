export interface PgrestParam {
  key: string;
  value: string;
}

export type PgrestHttpMethod = "POST" | "GET";

export interface PgrestParamItem extends PgrestParam {
  _id: string;
}

/** Convert a snake_case PGREST key to a human-readable label. */
export function humanizeKey(key: string): string {
  return key
    .replace(/^[pv]_/, "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function toPgrestParamItems(params: PgrestParam[]): PgrestParamItem[] {
  return params.map((p, i) => ({ ...p, _id: `pp-${i}-${p.key}` }));
}

export function fromPgrestParamItems(items: PgrestParamItem[]): PgrestParam[] {
  return items.map(({ key, value }) => ({ key, value }));
}
