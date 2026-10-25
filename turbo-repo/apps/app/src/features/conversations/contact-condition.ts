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

const QUOTED = String.raw`(?:'([^'\\]*)'|"([^"\\]*)")`;
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
  return `'${value.replace(/['\\]/g, "")}'`;
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
    if (m) return { kind, value: m[1] ?? m[2] ?? "" } as ContactClause;
  }
  return null;
}

/** The clauses of a condition joined by &&, or null when it says more than they can. */
export function parseClauses(condition: string): ContactClause[] | null {
  const text = condition.trim();
  if (!text) return [];
  if (/\|\||[()]/.test(text.replace(QUOTED_ANY, "''"))) return null;
  const out: ContactClause[] = [];
  for (const part of text.split("&&")) {
    const clause = parseClause(part.trim());
    if (!clause) return null;
    out.push(clause);
  }
  return out;
}

const QUOTED_ANY = /'[^']*'|"[^"]*"/g;
