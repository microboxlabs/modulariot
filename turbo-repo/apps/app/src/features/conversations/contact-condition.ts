/**
 * The condition of a "contacts from the book" audience as a list of clauses
 * that all must hold, and back. A condition the clauses cannot say (|| or
 * parentheses, other fields) is edited as CEL only.
 */

export type ContactClause =
  | { kind: "tag"; value: string }
  | { kind: "role"; value: string }
  | { kind: "company"; value: string }
  /** The contact's company RUT equals a field of the event, such as carrierRut. */
  | { kind: "companyRutIs"; field: string };

export type ContactClauseKind = ContactClause["kind"];

export const CLAUSE_KINDS: ContactClauseKind[] = [
  "tag",
  "role",
  "company",
  "companyRutIs",
];

const QUOTED = String.raw`(?:'([^'\\]*)'|("(?:[^"\\]|\\.)*"))`;
const PATTERNS: [ContactClauseKind, RegExp][] = [
  ["tag", new RegExp(String.raw`^${QUOTED}\s+in\s+contact\.tags$`)],
  ["role", new RegExp(String.raw`^contact\.role\s*==\s*${QUOTED}$`)],
  ["company", new RegExp(String.raw`^contact\.company\s*==\s*${QUOTED}$`)],
];
const RUT_IS = /^contact\.companyRut\s*==\s*event\.data\.([A-Za-z_]\w*)$/;

export function newClause(kind: ContactClauseKind): ContactClause {
  return kind === "companyRutIs"
    ? { kind, field: "carrierRut" }
    : { kind, value: "" };
}

function quote(value: string) {
  return /['\\]/.test(value) ? JSON.stringify(value) : `'${value}'`;
}

function compileClause(c: ContactClause): string {
  switch (c.kind) {
    case "tag":
      return `${quote(c.value)} in contact.tags`;
    case "role":
      return `contact.role == ${quote(c.value)}`;
    case "company":
      return `contact.company == ${quote(c.value)}`;
    case "companyRutIs":
      return `contact.companyRut == event.data.${c.field}`;
  }
}

export function compileClauses(clauses: ContactClause[]): string {
  return clauses.map(compileClause).join(" && ");
}

function parseClause(text: string): ContactClause | null {
  const rut = RUT_IS.exec(text);
  if (rut) return { kind: "companyRutIs", field: rut[1] };
  for (const [kind, re] of PATTERNS) {
    const m = re.exec(text);
    if (m) {
      try {
        return {
          kind,
          value: m[1] ?? JSON.parse(m[2] ?? '""'),
        } as ContactClause;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** The clauses of a condition joined by &&, or null when it says more than they can. */
export function parseClauses(condition: string): ContactClause[] | null {
  const text = condition.trim();
  if (!text) return [];
  const parts = splitClauses(text);
  if (!parts) return null;
  const out: ContactClause[] = [];
  for (const part of parts) {
    const clause = parseClause(part.trim());
    if (!clause) return null;
    out.push(clause);
  }
  return out;
}

function splitClauses(text: string): string[] | null {
  const parts: string[] = [];
  let start = 0;
  let quote: "'" | '"' | null = null;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (
      ch === "(" ||
      ch === ")" ||
      (ch === "|" && text[i + 1] === "|")
    ) {
      return null;
    } else if (ch === "&" && text[i + 1] === "&") {
      parts.push(text.slice(start, i));
      start = ++i + 1;
    }
  }
  if (quote) return null;
  parts.push(text.slice(start));
  return parts;
}

/** A value the book uses and how many active contacts have it. */
export interface Suggestion {
  value: string;
  count: number;
}

export interface BookValues {
  role?: string | null;
  tags?: string[] | null;
  company?: string | null;
  active?: boolean;
}

/** The tags, roles and companies of the active contacts, most used first; CEL compares exact text. */
export function bookSuggestions(
  contacts: readonly BookValues[]
): Record<"tag" | "role" | "company", Suggestion[]> {
  const counts = {
    tag: new Map<string, Suggestion>(),
    role: new Map<string, Suggestion>(),
    company: new Map<string, Suggestion>(),
  };
  const add = (kind: keyof typeof counts, raw: string | null | undefined) => {
    const value = raw?.trim();
    if (!value) return;
    const s = counts[kind].get(value);
    if (s) s.count += 1;
    else counts[kind].set(value, { value, count: 1 });
  };
  for (const c of contacts) {
    if (c.active === false) continue;
    add("role", c.role);
    add("company", c.company);
    for (const t of new Set((c.tags ?? []).map((x) => x.trim()))) add("tag", t);
  }
  const sorted = (m: Map<string, Suggestion>) =>
    [...m.values()].sort(
      (a, b) => b.count - a.count || a.value.localeCompare(b.value, "es")
    );
  return {
    tag: sorted(counts.tag),
    role: sorted(counts.role),
    company: sorted(counts.company),
  };
}
